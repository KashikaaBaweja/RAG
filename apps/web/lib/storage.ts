import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readUpload } from "@rag/ingestion";

export { readUpload };

const uploadRoot = () =>
  process.env.RAG_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function shouldUseS3(): boolean {
  return (
    process.env.RAG_USE_S3 === "1" ||
    process.env.RAG_USE_S3 === "true"
  );
}

function s3Client(): S3Client | null {
  if (!shouldUseS3()) return null;
  const region = process.env.AWS_REGION ?? "us-east-1";
  return new S3Client({ region });
}

export async function persistUpload(
  storageKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = s3Client();
  const bucket = process.env.RAG_S3_BUCKET;

  if (client && bucket) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: body,
        ContentType: contentType || "application/octet-stream",
      })
    );
    return;
  }

  const dest = path.join(uploadRoot(), storageKey);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
}
