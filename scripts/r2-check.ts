import 'dotenv/config';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID as string;
const bucket = process.env.R2_BUCKET as string;
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function main() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log('Created bucket:', bucket);
  } catch (err) {
    console.error(
      'CREATE FAIL:',
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    process.exit(1);
  }
}
void main();
