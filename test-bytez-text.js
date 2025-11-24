import Bytez from "bytez.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const apiKey = process.env.VITE_BYTEZ_API_KEY;

if (!apiKey) {
    console.error("❌ VITE_BYTEZ_API_KEY not found in .env.local");
    process.exit(1);
}

console.log(`✅ Found API Key: ${apiKey.substring(0, 4)}...`);

const bytez = new Bytez(apiKey);

async function testTextGeneration() {
    try {
        const modelId = "Qwen/Qwen3-4B-Instruct-2507";
        console.log(`📝 Testing text generation with model: ${modelId}`);

        const model = bytez.model(modelId);
        const { error, output } = await model.run([
            {
                "role": "user",
                "content": "Write a short haiku about a robot learning to love."
            }
        ]);

        if (error) {
            console.error("❌ Generation failed:", error);
        } else {
            console.log("✅ Generation successful!");
            console.log("Output:", output);
        }
    } catch (e) {
        console.error("❌ Unexpected error:", e);
    }
}

testTextGeneration();
