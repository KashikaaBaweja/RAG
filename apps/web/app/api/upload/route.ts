import { NextResponse, type NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getIngestionQueue } from "@/lib/queue";
import { persistUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected multipart field `file`." }, { status: 400 });
  }

  const orgField = form.get("orgId");
  const orgId =
    typeof orgField === "string" && orgField.length > 0
      ? orgField
      : req.headers.get("x-org-id") ?? "dev-org";

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = uuidv4();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storageKey = `${orgId}/${docId}-${safeName}`;

  await persistUpload(
    storageKey,
    buffer,
    file.type || "application/octet-stream"
  );

  await getIngestionQueue().add("ingest", {
    storageKey,
    docId,
    orgId,
    mimeType: file.type || "application/octet-stream",
    filename: file.name,
  });

  return NextResponse.json({
    docId,
    orgId,
    status: "queued",
    message: "File stored; ingestion job enqueued.",
  });
}
