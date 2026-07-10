import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
  return process.env.RAG_USE_S3 === "1" || process.env.RAG_USE_S3 === "true";
}

function s3Client(): S3Client | null {
  if (!isS3Enabled()) return null;
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

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

  return readFile(path.join(uploadRoot(), storageKey));
}

export async function persistUpload(
  storageKey: string,
  data: Buffer,
  mimeType: string
): Promise<void> {
  const client = s3Client();
  const bucket = process.env.RAG_S3_BUCKET;

  if (client && bucket) {
    await client.send(
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
