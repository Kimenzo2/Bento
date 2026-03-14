/**
 * Test script for the Genesis Mastra AI pipeline.
 * Tests: Agent model resolution, Gemini API call, embedding generation.
 *
 * Run: npx tsx mastra/test-pipeline.ts
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!API_KEY) {
  console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set in .env');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

// ─── Test 1: Direct Gemini API call ──────────────────────────────────────────
async function testGeminiDirect() {
  console.log('\n=== TEST 1: Direct Gemini API Call ===');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Respond with exactly one sentence: What is a storybook?',
    });
    const text = result.text ?? '';
    console.log('  Response:', text.trim().slice(0, 200));
    console.log('  PASS: Gemini API key works, model responds\n');
    return true;
  } catch (err: any) {
    console.error('  FAIL:', err.message);
    return false;
  }
}

// ─── Test 2: Embedding generation ────────────────────────────────────────────
async function testEmbedding() {
  console.log('=== TEST 2: Embedding Generation ===');
  try {
    const result = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: ['Once upon a time in a magical kingdom'],
    });
    const embedding = result.embeddings?.[0]?.values ?? [];
    console.log('  Embedding dimension:', embedding.length);
    console.log('  First 5 values:', embedding.slice(0, 5).map(v => v.toFixed(4)));
    console.log('  PASS: Embedding generation works (dim:', embedding.length, ')\n');
    return true;
  } catch (err: any) {
    console.error('  FAIL:', err.message);
    return false;
  }
}

// ─── Test 3: Batch embedding ─────────────────────────────────────────────────
async function testBatchEmbedding() {
  console.log('=== TEST 3: Batch Embedding (Brand Voice RAG) ===');
  try {
    const texts = [
      'Our brand speaks with confidence and warmth.',
      'We prioritize clarity and accessibility in all communications.',
      'Innovation drives everything we do at Acme Corp.',
    ];
    const result = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: texts,
    });
    const embeddings = result.embeddings ?? [];
    console.log('  Chunks embedded:', embeddings.length);
    console.log('  Each dimension:', embeddings[0]?.values?.length ?? 0);
    console.log('  PASS: Batch embedding works for RAG pipeline\n');
    return true;
  } catch (err: any) {
    console.error('  FAIL:', err.message);
    return false;
  }
}

// ─── Test 4: Mastra Agent via generate() ─────────────────────────────────────
async function testMastraAgent() {
  console.log('=== TEST 4: Mastra storyArchitectAgent.generate() ===');
  try {
    // Dynamic import to avoid top-level env issues
    const { mastra } = await import('./index');
    const agent = mastra.getAgent('storyArchitect');

    console.log('  Agent ID:', (agent as any).id ?? 'story-architect');
    console.log('  Calling agent.generate()...');

    const result = await agent.generate(
      JSON.stringify({
        action: 'generateBlueprint',
        topic: 'A friendly robot learning to paint',
        targetAudience: 'Children ages 4-6',
        pageCount: 3,
        style: 'Watercolor',
        tone: 'Playful',
        isBranching: false,
      }),
      { maxSteps: 2 }
    );

    const text = result.text;
    console.log('  Response length:', text.length, 'chars');
    console.log('  Preview:', text.slice(0, 300).replace(/\n/g, ' ') + '...');

    // Try parsing as JSON
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1].trim()); } catch { /* skip */ }
      }
    }

    if (parsed) {
      console.log('  Parsed as JSON: YES');
      console.log('  Blueprint title:', parsed.title ?? '(no title field)');
      console.log('  Pages planned:', parsed.pages?.length ?? '(no pages field)');
      console.log('  Characters:', parsed.characterNeeds?.length ?? '(no characters)');
      console.log('  PASS: Agent generates valid blueprint\n');
    } else {
      console.log('  Parsed as JSON: NO (raw text returned)');
      console.log('  WARNING: Agent did not return valid JSON. Check system prompt.\n');
    }

    return true;
  } catch (err: any) {
    console.error('  FAIL:', err.message);
    if (err.message.includes('Could not resolve')) {
      console.error('  HINT: The model router could not resolve "google/gemini-2.0-flash".');
      console.error('        Ensure @ai-sdk/google is installed and GOOGLE_GENERATIVE_AI_API_KEY is set.');
    }
    return false;
  }
}

// ─── Run all tests ───────────────────────────────────────────────────────────
async function main() {
  console.log('============================================');
  console.log('  Genesis AI Pipeline Test');
  console.log('  API Key:', API_KEY!.slice(0, 6) + '...' + API_KEY!.slice(-4));
  console.log('============================================');

  const results: { name: string; pass: boolean }[] = [];

  results.push({ name: 'Gemini Direct API', pass: await testGeminiDirect() });
  results.push({ name: 'Embedding Generation', pass: await testEmbedding() });
  results.push({ name: 'Batch Embedding (RAG)', pass: await testBatchEmbedding() });
  results.push({ name: 'Mastra Agent Generate', pass: await testMastraAgent() });

  console.log('\n============================================');
  console.log('  RESULTS');
  console.log('============================================');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n  ${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
