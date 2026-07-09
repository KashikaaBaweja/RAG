import { readFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const uploadRoot = () => {
  const configured = process.env.RAG_UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), "uploads");
};

function isS3Enabled(): boolean {
  return (
    process.env.RAG_USE_S3 === "1" ||
    process.env.RAG_USE_S3 === "true"
  );
}

function s3Client(): S3Client | null {
  if (!isS3Enabled()) return null;
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

/** Read object written by upload API (local disk or S3). */
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
