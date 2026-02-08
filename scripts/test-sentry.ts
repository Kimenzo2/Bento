/**
 * Sentry Connection Test
 * Run with: npx tsx scripts/test-sentry.ts
 */

// Load environment variables
import { config } from 'dotenv';
config();

const SENTRY_DSN = process.env.VITE_SENTRY_DSN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;

console.log('🔍 Testing Sentry Configuration...\n');

// Check configuration
console.log('Configuration:');
console.log(`  DSN: ${SENTRY_DSN ? SENTRY_DSN.substring(0, 50) + '...' : '❌ Not set'}`);
console.log(`  Organization: ${SENTRY_ORG || '❌ Not set'}`);
console.log(`  Project: ${SENTRY_PROJECT || '❌ Not set'}`);

if (!SENTRY_DSN || SENTRY_DSN.includes('your-key')) {
  console.error('\n❌ Sentry DSN is not configured!');
  process.exit(1);
}

// Parse DSN to extract project ID
const dsnMatch = SENTRY_DSN.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
if (!dsnMatch) {
  console.error('\n❌ Invalid DSN format!');
  process.exit(1);
}

const [, publicKey, host, projectId] = dsnMatch;

console.log(`\n  Public Key: ${publicKey.substring(0, 10)}...`);
console.log(`  Host: ${host}`);
console.log(`  Project ID: ${projectId}`);

// Test sending an event to Sentry
async function testSentryConnection() {
  console.log('\n📡 Testing Sentry API connection...');

  const storeUrl = `https://${host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;

  const testEvent = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'info',
    logger: 'test',
    message: {
      formatted: '[TEST] Genesis Sentry connection test - ' + new Date().toISOString(),
    },
    environment: 'development',
    tags: {
      test: 'true',
      source: 'test-script',
    },
    extra: {
      test_run: true,
      timestamp: Date.now(),
    },
  };

  try {
    const response = await fetch(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test event sent successfully!');
      console.log(`  Event ID: ${result.id || testEvent.event_id}`);
      console.log(`\n🔗 View in Sentry: https://${SENTRY_ORG}.sentry.io/issues/`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to send event: ${response.status}`);
      console.error(`  Response: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection error:', error);
    return false;
  }
}

// Run test
testSentryConnection().then((success) => {
  if (success) {
    console.log('\n🎉 Sentry is configured correctly!');
    console.log('\nNext steps:');
    console.log('  1. Check your Sentry dashboard for the test event');
    console.log('  2. The app will now capture errors automatically');
    console.log('  3. Use captureException() for manual error reporting');
  } else {
    console.log('\n⚠️  Sentry test failed. Check your configuration.');
  }
  process.exit(success ? 0 : 1);
});
