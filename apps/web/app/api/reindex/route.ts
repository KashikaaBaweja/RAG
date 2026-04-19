/**
 * Re-queue ingestion for an object already in storage (same payload shape as upload worker).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getIngestionQueue } from "@/lib/queue";

export const runtime = "nodejs";

type Body = {
  storageKey?: string;
  docId?: string;
  orgId?: string;
  mimeType?: string;
  filename?: string;
};

export async function POST(req: NextRequest) {
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

  await getIngestionQueue().add("ingest", {
    storageKey,
    docId,
    orgId,
    mimeType,
    filename,
  });

  return NextResponse.json({ status: "queued", docId });
}
