import { hash } from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/** Bootstrap account + personal org (dev-friendly; add rate limits before production). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      orgName?: string;
    };
    const email = body.email?.toLowerCase().trim();
    const password = body.password;
    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Valid email and password (8+ chars) required" },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const baseSlug = email.split("@")[0]!.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "org";
    let slug = baseSlug;
    let n = 0;
    while (await prisma.org.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name: body.name?.trim() || null },
      });
      const org = await tx.org.create({
        data: {
          name: body.orgName?.trim() || `${email.split("@")[0]}'s org`,
          slug,
        },
      });
      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: "OWNER" },
      });
      await tx.knowledgeBase.create({
        data: { orgId: org.id, name: "Default" },
      });
    });

    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
