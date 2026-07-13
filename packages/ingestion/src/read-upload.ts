import { readFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const uploadRoot = () => {
  const configured = process.env.RAG_UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  // Vercel serverless runtime cannot read/write inside /var/task.
  if (process.env.VERCEL) return "/tmp/uploads";
  return path.join(process.cwd(), "uploads");
};

type StorageBackend = "supabase" | "s3" | "local";

function resolveStorageBackend(): StorageBackend {
  const explicit = process.env.RAG_STORAGE_PROVIDER?.trim().toLowerCase();
  const hasSupabase = Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      process.env.SUPABASE_STORAGE_BUCKET?.trim()
  );
  const hasS3 =
    (process.env.RAG_USE_S3 === "1" || process.env.RAG_USE_S3 === "true") &&
    Boolean(process.env.RAG_S3_BUCKET?.trim());

  if (explicit === "supabase" || explicit === "s3" || explicit === "local") {
    return explicit;
  }
  if (hasSupabase) return "supabase";
  if (hasS3) return "s3";
  return "local";
}

async function supabaseDownload(storageKey: string): Promise<Buffer> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !key || !bucket) {
    throw new Error("Supabase storage env vars are required");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.storage.from(bucket).download(storageKey);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  if (!data) throw new Error("Empty Supabase object");
  return Buffer.from(await data.arrayBuffer());
}

/** Read object written by upload API (Supabase, S3, or local disk). */
export async function readUpload(storageKey: string): Promise<Buffer> {
  const backend = resolveStorageBackend();

  if (backend === "supabase") {
    try {
      return await supabaseDownload(storageKey);
    } catch (e) {
      // Older uploads predate Supabase and still live on local disk.
      try {
        return await readFile(path.join(uploadRoot(), storageKey));
      } catch {
        throw e;
      }
    }
  }

  if (backend === "s3") {
    const bucket = process.env.RAG_S3_BUCKET;
    if (!bucket) throw new Error("RAG_S3_BUCKET is required when using S3 storage");
    const client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const out = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey })
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }

  const src = path.join(uploadRoot(), storageKey);
  return readFile(src);
}
