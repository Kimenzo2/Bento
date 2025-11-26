// Test script for Bytez API
import Bytez from 'bytez.js';

const apiKey = "c6b479158eb7ab0acd78466555378366"; // From .env file

async function testBytezAPI() {
    console.log("🔍 Testing Bytez API key...\n");

    if (!apiKey) {
        console.error("❌ API Key is missing");
        return;
    }

    try {
        const bytez = new Bytez(apiKey);
        const modelId = "google/imagen-4.0-generate-001";

        console.log(`🎨 Testing model: ${modelId}`);
        const model = bytez.model(modelId);

        const prompt = "A cute blue robot reading a book, digital art style";
        console.log(`📝 Prompt: "${prompt}"`);
        console.log("⏳ Generating image (this may take a few seconds)...");

        const { error, output } = await model.run(prompt);

        if (error) {
            console.error("❌ Bytez Generation Error:");
            console.error(error);
            return;
        }

        console.log("✅ API Response Received!");
        console.log("Output:", output);

        if (output) {
            console.log("\n✅ Image generation successful!");
        } else {
            console.warn("\n⚠️ Output is empty or null");
        }

    } catch (error) {
        console.error("❌ Test Failed with Exception:");
        console.error(error);
    }
}

testBytezAPI();
