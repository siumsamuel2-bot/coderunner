import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 is S3-compatible. Env-gated so the app builds without creds.

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

let client: S3Client | null = null;

export function isStorageEnabled(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

function getClient(): S3Client | null {
  if (!isStorageEnabled()) return null;
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    });
  }
  return client;
}

export async function uploadObject(options: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}): Promise<boolean> {
  const s3 = getClient();
  if (!s3) {
    console.warn('[r2] storage not configured - skipping upload of', options.key);
    return false;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
    })
  );
  return true;
}

export async function uploadEvidence(options: {
  runId: string;
  filename: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}): Promise<{ key: string; url: string | null }> {
  const key = `evidence/${options.runId}/${options.filename}`;
  await uploadObject({ key, body: options.body, contentType: options.contentType });
  return { key, url: await getEvidenceUrl(key) };
}

export async function getEvidenceUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const s3 = getClient();
  if (!s3) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteObject(key: string): Promise<boolean> {
  const s3 = getClient();
  if (!s3) return false;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return true;
}
