import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  resolveStorageBackend,
  supabaseDownload,
  supabaseUpload,
} from "./supabase";

const uploadRoot = () => {
  const configured = process.env.RAG_UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), "uploads");
};

function s3Client(): S3Client {
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

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
    const out = await s3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey })
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }

  return readFile(path.join(uploadRoot(), storageKey));
}

export async function persistUpload(
  storageKey: string,
  data: Buffer,
  mimeType: string
): Promise<void> {
  const backend = resolveStorageBackend();

  if (backend === "supabase") {
    await supabaseUpload(storageKey, data, mimeType);
    return;
  }

  if (backend === "s3") {
    const bucket = process.env.RAG_S3_BUCKET;
    if (!bucket) throw new Error("RAG_S3_BUCKET is required when using S3 storage");
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: data,
        ContentType: mimeType,
      })
    );
    return;
  }

  const dest = path.join(uploadRoot(), storageKey);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, data);
}
