/**
 * Integration Tests for Algolia, Arcjet, Resend, and Mux
 * Run with: npx tsx scripts/test-integrations.ts
 */

import { config } from 'dotenv';
config();

// ============ ALGOLIA TEST ============
async function testAlgolia(): Promise<boolean> {
  console.log('\n🔍 Testing Algolia Search...');

  const appId = process.env.VITE_ALGOLIA_APP_ID;
  const searchKey = process.env.VITE_ALGOLIA_SEARCH_KEY;
  const writeKey = process.env.VITE_ALGOLIA_WRITE_KEY;

  if (!appId || !searchKey) {
    console.error('  ❌ Algolia credentials not configured');
    return false;
  }

  console.log(`  App ID: ${appId}`);
  console.log(`  Search Key: ${searchKey.substring(0, 10)}...`);
  console.log(`  Write Key: ${writeKey ? writeKey.substring(0, 10) + '...' : 'Not set'}`);

  try {
    // Test search API connectivity
    const response = await fetch(`https://${appId}-dsn.algolia.net/1/indexes`, {
      headers: {
        'X-Algolia-API-Key': writeKey || searchKey,
        'X-Algolia-Application-Id': appId,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Connected! Found ${data.items?.length || 0} indexes`);
      if (data.items?.length > 0) {
        console.log(`  Indexes: ${data.items.map((i: any) => i.name).join(', ')}`);
      }
      return true;
    } else {
      console.error(`  ❌ API error: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Connection error:', error);
    return false;
  }
}

// ============ ARCJET TEST ============
async function testArcjet(): Promise<boolean> {
  console.log('\n🛡️ Testing Arcjet Security...');

  const arcjetKey = process.env.ARCJET_KEY || process.env.VITE_ARCJET_KEY;

  if (!arcjetKey) {
    console.error('  ❌ Arcjet key not configured');
    return false;
  }

  console.log(`  Key: ${arcjetKey.substring(0, 15)}...`);
  console.log(`  Environment: ${process.env.ARCJET_ENV || 'development'}`);

  // Arcjet is validated at runtime when requests are made
  // We can only verify the key format here
  if (arcjetKey.startsWith('ajkey_')) {
    console.log('  ✅ Key format valid (ajkey_...)');
    console.log('  ℹ️  Arcjet validates at runtime with actual requests');
    return true;
  } else {
    console.error('  ❌ Invalid key format (should start with ajkey_)');
    return false;
  }
}

// ============ RESEND TEST ============
async function testResend(): Promise<boolean> {
  console.log('\n📧 Testing Resend Email API...');

  const apiKey = process.env.VITE_RESEND_API_KEY;

  if (!apiKey) {
    console.error('  ❌ Resend API key not configured');
    return false;
  }

  console.log(`  API Key: ${apiKey.substring(0, 10)}...`);

  try {
    // Test API connectivity by fetching domains
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Connected! Found ${data.data?.length || 0} domains`);
      if (data.data?.length > 0) {
        data.data.forEach((d: any) => {
          console.log(`    - ${d.name} (${d.status})`);
        });
      }
      return true;
    } else if (response.status === 401) {
      console.error('  ❌ Invalid API key');
      return false;
    } else {
      const error = await response.text();
      console.error(`  ❌ API error: ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Connection error:', error);
    return false;
  }
}

// ============ MUX TEST ============
async function testMux(): Promise<boolean> {
  console.log('\n🎬 Testing Mux Video Streaming...');

  const tokenId = process.env.VITE_MUX_TOKEN_ID || process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.VITE_MUX_TOKEN_SECRET || process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    console.error('  ❌ Mux credentials not configured');
    return false;
  }

  console.log(`  Token ID: ${tokenId.substring(0, 15)}...`);
  console.log(`  Token Secret: ${tokenSecret.substring(0, 10)}...`);

  try {
    // Create Basic auth header
    const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');

    // Test API connectivity by listing assets
    const response = await fetch('https://api.mux.com/video/v1/assets?limit=1', {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Connected! Total assets: ${data.data?.length || 0}`);
      return true;
    } else if (response.status === 401) {
      console.error('  ❌ Invalid credentials');
      return false;
    } else {
      const error = await response.text();
      console.error(`  ❌ API error: ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Connection error:', error);
    return false;
  }
}

// ============ RUN ALL TESTS ============
async function runAllTests() {
  console.log('🧪 Testing Integrations...\n');
  console.log('='.repeat(50));

  const results: Record<string, boolean> = {};

  results.algolia = await testAlgolia();
  results.arcjet = await testArcjet();
  results.resend = await testResend();
  results.mux = await testMux();

  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Results Summary:\n');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([name, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${name.charAt(0).toUpperCase() + name.slice(1)}`);
  });

  console.log(`\n  Total: ${passed}/${total} passed`);

  if (passed === total) {
    console.log('\n🎉 All integrations working!');
  } else {
    console.log('\n⚠️  Some integrations need attention.');
  }

  process.exit(passed === total ? 0 : 1);
}

runAllTests();
