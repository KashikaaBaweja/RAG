/**
 * Re-queue ingestion for an object already in storage (same payload shape as upload worker).
 */
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions, assertOrgInToken } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ingestStoredUploadNow, shouldRunIngestionNow } from "@/lib/ingestion/run-now";
import { getIngestionQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  storageKey?: string;
  docId?: string;
  orgId?: string;
  mimeType?: string;
  filename?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { storageKey, docId, orgId, mimeType, filename } = body;
  if (
    typeof storageKey !== "string" ||
    typeof docId !== "string" ||
    typeof orgId !== "string" ||
    typeof mimeType !== "string" ||
    typeof filename !== "string"
  ) {
    return NextResponse.json(
      { error: "storageKey, docId, orgId, mimeType, and filename are required" },
      { status: 400 }
    );
  }

  try {
    assertOrgInToken(session.user.memberships, orgId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.findFirst({
    where: { orgId, docId, storageKey },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found for org" }, { status: 404 });
  }

  await prisma.document.updateMany({
    where: { orgId, docId },
    data: { status: "PENDING" },
  });

  if (shouldRunIngestionNow()) {
    try {
      await ingestStoredUploadNow({
        storageKey,
        docId,
        orgId,
        mimeType,
        filename,
      });
      await prisma.document.updateMany({
        where: { orgId, docId },
        data: { status: "READY" },
      });
      return NextResponse.json({ status: "ready", docId });
    } catch (e) {
      await prisma.document.updateMany({
        where: { orgId, docId },
        data: { status: "FAILED" },
      });
      const message = e instanceof Error ? e.message : "Re-index failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    await getIngestionQueue().add(
      "ingest",
      {
        storageKey,
        docId,
        orgId,
        mimeType,
        filename,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
    );
    return NextResponse.json({ status: "queued", docId });
  } catch {
    try {
      await ingestStoredUploadNow({
        storageKey,
        docId,
        orgId,
        mimeType,
        filename,
      });
      await prisma.document.updateMany({
        where: { orgId, docId },
        data: { status: "READY" },
      });
      return NextResponse.json({ status: "ready", docId });
    } catch (e) {
      await prisma.document.updateMany({
        where: { orgId, docId },
        data: { status: "FAILED" },
      });
      const message = e instanceof Error ? e.message : "Re-index failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
