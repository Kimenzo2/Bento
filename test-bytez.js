import Bytez from "bytez.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Load .env.local manually since dotenv usually loads .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envLocalPath = path.join(__dirname, '.env.local');

if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const key = process.env.VITE_BYTEZ_API_KEY;

if (!key) {
    console.error("❌ VITE_BYTEZ_API_KEY not found in environment!");
    process.exit(1);
}

console.log("✅ Found API Key:", key.substring(0, 5) + "...");

const sdk = new Bytez(key);
const modelId = "google/imagen-4.0-generate-001";
const model = sdk.model(modelId);

console.log(`🚀 Testing model: ${modelId}`);

try {
    const { error, output } = await model.run("A futuristic city with flying cars, cinematic lighting, 8k");

    if (error) {
        console.error("❌ Generation failed:", error);
        process.exit(1);
    }

    console.log("✅ Generation successful!");
    console.log("Output:", output ? (output.substring(0, 50) + "...") : "No output");

} catch (e) {
    console.error("❌ Exception during generation:", e);
    process.exit(1);
}
