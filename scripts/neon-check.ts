// Quick Neon connectivity test for the Board-provided DATABASE_URL.
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}
console.log('host:', new URL(url as string).host, '| db:', new URL(url as string).pathname);

async function main() {
  try {
    const client = neon(url as string);
    const rows = await client`select version() as v, current_database() as db, current_user as usr`;
    console.log('OK:', rows[0]);
  } catch (err) {
    console.error('FAIL:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
void main();
