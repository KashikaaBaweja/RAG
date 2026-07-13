/**
 * Multipart upload → object storage → BullMQ `ingestion` job (async pipeline).
 * Requires session + org membership (JWT). Creates `Document` row in Postgres.
 */
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authOptions, assertOrgInToken } from "@/lib/auth";
import {
  createDocumentRecord,
  getDefaultKnowledgeBase,
  updateDocumentStatus,
} from "@/lib/db/knowledgeBase";
import { ingestBufferNow, shouldRunIngestionNow } from "@/lib/ingestion/run-now";
import { getIngestionQueue } from "@/lib/queue";
import { persistUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected multipart field `file`." }, { status: 400 });
  }

  const orgField = form.get("orgId");
  const orgId =
    typeof orgField === "string" && orgField.length > 0
      ? orgField
      : req.headers.get("x-org-id") ?? "";

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  try {
    assertOrgInToken(session.user.memberships, orgId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const docId = uuidv4();
    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const storageKey = `${orgId}/${docId}-${safeName}`;
    const mimeType = file.type || "application/octet-stream";

    await persistUpload(storageKey, buffer, mimeType);

    const kb = await getDefaultKnowledgeBase(orgId);
    await createDocumentRecord({
      orgId,
      knowledgeBaseId: kb.id,
      docId,
      storageKey,
      filename: file.name,
      mimeType,
      status: "PENDING",
    });

    const runNow = shouldRunIngestionNow();

    if (runNow) {
      try {
        await ingestBufferNow({
          buffer,
          docId,
          orgId,
          mimeType,
          filename: file.name,
        });
        await updateDocumentStatus(orgId, docId, "READY");
      } catch (ingestErr) {
        await updateDocumentStatus(orgId, docId, "FAILED");
        const message =
          ingestErr instanceof Error
            ? ingestErr.message
            : "Uploaded, but ingestion failed. Check model provider configuration.";
        return NextResponse.json(
          {
            docId,
            orgId,
            filename: file.name,
            storageKey,
            mimeType,
            status: "failed",
            message,
          },
          { status: 200 }
        );
      }
    } else {
      try {
        await getIngestionQueue().add(
          "ingest",
          {
            storageKey,
            docId,
            orgId,
            mimeType,
            filename: file.name,
          },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
        );
      } catch {
        try {
          await ingestBufferNow({
            buffer,
            docId,
            orgId,
            mimeType,
            filename: file.name,
          });
          await updateDocumentStatus(orgId, docId, "READY");
        } catch (ingestErr) {
          await updateDocumentStatus(orgId, docId, "FAILED");
          const message =
            ingestErr instanceof Error
              ? ingestErr.message
              : "Uploaded, but ingestion failed. Check model provider configuration.";
          return NextResponse.json(
            {
              docId,
              orgId,
              filename: file.name,
              storageKey,
              mimeType,
              status: "failed",
              message,
            },
            { status: 200 }
          );
        }
      }
    }

    return NextResponse.json({
      docId,
      orgId,
      filename: file.name,
      storageKey,
      mimeType,
      status: runNow ? "ready" : "queued",
      message: runNow
        ? "File uploaded and indexed."
        : "File stored; ingestion job enqueued.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("[upload]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
