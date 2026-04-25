import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function getS3Bucket(): string {
  const bucket = process.env.RAG_S3_BUCKET;
  if (!bucket) {
    throw new Error("RAG_S3_BUCKET is required for presigned uploads");
  }
  return bucket;
}

/** S3 key prefixing every object with `orgId/` for multi-tenant isolation. */
export function orgObjectKey(orgId: string, ...segments: string[]): string {
  return [orgId, ...segments].join("/");
}

export function s3Client(): S3Client {
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

/**
 * Presigned PUT for browser-direct uploads. Caller must authorize org + filename.
 */
export async function presignPutUpload(params: {
  orgId: string;
  docId: string;
  filename: string;
  contentType: string;
  /** seconds */
  expiresIn?: number;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const bucket = getS3Bucket();
  const safe = params.filename.replace(/[^\w.-]+/g, "_");
  const storageKey = orgObjectKey(params.orgId, `${params.docId}-${safe}`);
  const client = s3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: params.contentType || "application/octet-stream",
  });
  // Smithy minor version skew between S3 client and presigner packages in the monorepo.
  type SignUrl = typeof getSignedUrl;
  const uploadUrl = await getSignedUrl(
    client as unknown as Parameters<SignUrl>[0],
    cmd as unknown as Parameters<SignUrl>[1],
    { expiresIn: params.expiresIn ?? 900 }
  );
  return { uploadUrl, storageKey };
}
