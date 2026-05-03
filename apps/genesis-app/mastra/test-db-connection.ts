import pg from 'pg';
const { Client } = pg;

const password = '406Jayze$$nzo';

// Try with explicit params to avoid any URL encoding issues
const regions = [
  'eu-west-1',
  'us-east-1',
  'ap-southeast-1',
  'eu-central-1',
  'us-west-1',
  'ap-south-1',
  'eu-west-2',
  'eu-north-1',
  'ap-northeast-1',
  'ca-central-1',
  'sa-east-1',
];

console.log(`Password: "${password}" (length: ${password.length})`);
console.log(`URL-encoded: "${encodeURIComponent(password)}"`);
console.log('');

// Transaction pooler (6543) with explicit params
for (const region of regions) {
  const client = new Client({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: 'postgres.qjjocfnqwtccuxbnoult',
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() as db');
    console.log(`CONNECTED (tx-6543): ${region} - ${JSON.stringify(r.rows)}`);
    await client.end();
    process.exit(0);
  } catch (e: any) {
    const msg = e.message.slice(0, 60);
    if (!msg.includes('Tenant')) console.log(`tx-6543 ${region}: ${msg}`);
    try {
      await client.end();
    } catch {}
  }
}

// Session pooler (5432) with explicit params
for (const region of regions) {
  const client = new Client({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: 'postgres.qjjocfnqwtccuxbnoult',
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() as db');
    console.log(`CONNECTED (session-5432): ${region} - ${JSON.stringify(r.rows)}`);
    await client.end();
    process.exit(0);
  } catch (e: any) {
    const msg = e.message.slice(0, 60);
    if (!msg.includes('Tenant')) console.log(`session-5432 ${region}: ${msg}`);
    try {
      await client.end();
    } catch {}
  }
}

// Direct host with IPv4 forced
const client = new Client({
  host: 'db.qjjocfnqwtccuxbnoult.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  console.log('CONNECTED (direct)');
  await client.end();
} catch (e: any) {
  console.log(`direct: ${e.message.slice(0, 100)}`);
  try {
    await client.end();
  } catch {}
}

console.log('\nAll failed.');
