
import { analyzeContent } from '../services/generator/contentAnalyzer';
import { EbookRequest } from '../types/generator';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testRequest: EbookRequest = {
    topic: "How to Use Claude Skills",
    targetAudience: "Tech professionals and beginners",
    pageCount: 10,
    style: "Modern Infographic with Cartoon Characters",
    tone: "Friendly, educational, and approachable",
    brandProfile: {
        name: "Genesis AI",
        colors: ["#7C3AED", "#06B6D4"],
        guidelines: "Use a friendly robot mascot named Claude. Keep it clean and modern."
    }
};

async function runTest() {
    console.log("🧠 Testing Content Analyzer (The Brain)...");
    try {
        const blueprint = await analyzeContent(testRequest);
        console.log("\n✨ Ebook Blueprint Generated Successfully! ✨\n");
        console.log(JSON.stringify(blueprint, null, 2));

        // Basic validation
        if (!blueprint.narrativeArc) throw new Error("Missing Narrative Arc");
        if (!blueprint.visualStrategy) throw new Error("Missing Visual Strategy");
        if (!blueprint.colorPalette) throw new Error("Missing Color Palette");
        if (!blueprint.pages || blueprint.pages.length === 0) throw new Error("Missing Pages");

        console.log("\n✅ Verification Passed: All required fields present.");
    } catch (error) {
        console.error("\n❌ Test Failed:", error);
    }
}

runTest();
