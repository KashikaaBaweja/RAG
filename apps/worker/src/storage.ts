import { readFile } from "fs/promises";
import path from "path";
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const uploadRoot = () =>
  process.env.RAG_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function useS3(): boolean {
  return (
    process.env.RAG_USE_S3 === "1" ||
    process.env.RAG_USE_S3 === "true"
  );
}

function s3Client(): S3Client | null {
  if (!useS3()) return null;
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

/** Mirrors `apps/web/lib/storage.ts` read path so jobs resolve the same objects. */
export async function readUpload(storageKey: string): Promise<Buffer> {
  const client = s3Client();
  const bucket = process.env.RAG_S3_BUCKET;

  if (client && bucket) {
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
