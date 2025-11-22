// Quick API Key Test
// Run with: node test-api-key.js

const apiKey = process.env.API_KEY;

console.log("=== API Key Diagnostic ===");
console.log("API Key exists:", !!apiKey);
console.log("API Key length:", apiKey ? apiKey.length : 0);
console.log("API Key starts with 'AIza':", apiKey ? apiKey.startsWith('AIza') : false);
console.log("First 10 chars:", apiKey ? apiKey.substring(0, 10) + "..." : "MISSING");

if (!apiKey) {
    console.error("\n❌ ERROR: API_KEY environment variable is not set!");
    console.log("\nTo fix:");
    console.log("1. Create/edit .env.local file");
    console.log("2. Add: API_KEY=your-key-here");
    console.log("3. Restart dev server");
} else {
    console.log("\n✅ API Key appears to be set correctly");
}
