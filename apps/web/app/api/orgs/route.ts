import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions, assertRole } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";

/** List orgs for the signed-in user. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.org.findMany({
    where: {
      memberships: { some: { userId: session.user.id } },
    },
    include: {
      memberships: {
        where: { userId: session.user.id },
        take: 1,
      },
      knowledgeBases: { select: { id: true, name: true, _count: { select: { documents: true } } } },
      _count: { select: { documents: true, queries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: o.memberships[0]?.role,
      knowledgeBases: o.knowledgeBases,
      stats: { documents: o._count.documents, queries: o._count.queries },
    })),
  });
}

type CreateBody = { type: "create"; name: string; slug: string };
type InviteBody = {
  type: "invite";
  orgId: string;
  email: string;
  role?: "OWNER" | "ADMIN" | "MEMBER";
};
type JoinBody = { type: "join"; token: string };

type PostBody = CreateBody | InviteBody | JoinBody;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Org provisioning + invite + accept invite (single route per roadmap). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    const raw = (await req.json()) as unknown;
    if (!isRecord(raw) || typeof raw.type !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    body = raw as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.type === "create") {
      const name = body.name?.trim();
      const slug = body.slug?.trim().toLowerCase();
      if (!name || !slug) {
        return NextResponse.json({ error: "name and slug required" }, { status: 400 });
      }
      const exists = await prisma.org.findUnique({ where: { slug } });
      if (exists) {
        return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
      }

      const org = await prisma.$transaction(async (tx) => {
        const o = await tx.org.create({ data: { name, slug } });
        await tx.membership.create({
          data: { userId: session.user.id, orgId: o.id, role: "OWNER" },
        });
        await tx.knowledgeBase.create({ data: { orgId: o.id, name: "Default" } });
        return o;
      });

      return NextResponse.json({ org: { id: org.id, name: org.name, slug: org.slug } });
    }

    if (body.type === "invite") {
      assertRole(session.user.memberships, body.orgId, "ADMIN");
      const email = body.email?.toLowerCase().trim();
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const role = body.role ?? "MEMBER";
      if (role === "OWNER") {
        return NextResponse.json({ error: "Cannot invite as OWNER" }, { status: 400 });
      }

      const token = randomBytes(28).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

      const invite = await prisma.invite.create({
        data: {
          orgId: body.orgId,
          email,
          role,
          token,
          expiresAt,
          invitedById: session.user.id,
        },
      });

      return NextResponse.json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          token: invite.token,
        },
        message: "Share join token with the invitee; they POST { type: \"join\", token } while logged in.",
      });
    }

    if (body.type === "join") {
      const token = body.token?.trim();
      if (!token) {
        return NextResponse.json({ error: "token required" }, { status: 400 });
      }
      const invite = await prisma.invite.findUnique({ where: { token } });
      if (!invite || invite.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Signed-in email must match the invite email" },
          { status: 403 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.membership.upsert({
          where: { userId_orgId: { userId: user.id, orgId: invite.orgId } },
          create: { userId: user.id, orgId: invite.orgId, role: invite.role },
          update: { role: invite.role },
        });
        await tx.invite.delete({ where: { id: invite.id } });
      });

      return NextResponse.json({ ok: true, orgId: invite.orgId });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    const status = msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
