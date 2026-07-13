import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StorageBackend = "supabase" | "s3" | "local";

export function resolveStorageBackend(): StorageBackend {
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

  // Priority: Supabase → S3 → local disk
  if (hasSupabase) return "supabase";
  if (hasS3) return "s3";
  return "local";
}

export function supabaseBucket(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is required");
  return bucket;
}

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function supabaseUpload(
  storageKey: string,
  data: Buffer,
  mimeType: string
): Promise<void> {
  const client = supabaseAdmin();
  const bucket = supabaseBucket();
  const { error } = await client.storage.from(bucket).upload(storageKey, data, {
    contentType: mimeType || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
}

export async function supabaseDownload(storageKey: string): Promise<Buffer> {
  const client = supabaseAdmin();
  const bucket = supabaseBucket();
  const { data, error } = await client.storage.from(bucket).download(storageKey);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  if (!data) throw new Error("Empty Supabase object");
  return Buffer.from(await data.arrayBuffer());
}
