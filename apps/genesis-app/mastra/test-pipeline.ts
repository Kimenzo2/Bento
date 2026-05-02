/**
 * Test script for the Genesis Mastra AI pipeline.
 * Tests: Mastra text generation, embedding generation, agent model routing.
 *
 * Run: bunx tsx mastra/test-pipeline.ts
 */

import 'dotenv/config';
import {
  generateEmbeddingVector,
  generateEmbeddings,
  generateTextFromRequest,
} from './lib/aiGateway';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in .env');
  process.exit(1);
}

// ─── Test 1: Text generation via Mastra gateway ─────────────────────────────
async function testMastraText() {
  console.log('\n=== TEST 1: Mastra Text Generation ===');
  try {
    const result = await generateTextFromRequest({
      model: 'openai/gpt-4o-mini',
      prompt: 'Respond with exactly one sentence: What is a storybook?',
      generationConfig: {
        maxOutputTokens: 128,
      },
    });

    console.log('  Response:', result.text.trim().slice(0, 200));
    console.log('  Model:', result.model);
    console.log('  PASS: Mastra-backed text generation works\n');
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
    const embedding = await generateEmbeddingVector('Once upon a time in a magical kingdom');
    console.log('  Embedding dimension:', embedding.length);
    console.log('  First 5 values:', embedding.slice(0, 5).map((v) => v.toFixed(4)));
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
    const embeddings = await generateEmbeddings(texts);
    console.log('  Chunks embedded:', embeddings.length);
    console.log('  Each dimension:', embeddings[0]?.length ?? 0);
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

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
        } catch {
          // skip
        }
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
      console.error('  HINT: The model router could not resolve "openai/gpt-4o-mini".');
      console.error('        Ensure OPENAI_API_KEY is set and accessible to Mastra.');
    }
    return false;
  }
}

// ─── Run all tests ───────────────────────────────────────────────────────────
async function main() {
  console.log('============================================');
  console.log('  Genesis AI Pipeline Test');
  console.log('  API Key:', OPENAI_API_KEY!.slice(0, 6) + '...' + OPENAI_API_KEY!.slice(-4));
  console.log('============================================');

  const results: { name: string; pass: boolean }[] = [];

  results.push({ name: 'Mastra Text Generation', pass: await testMastraText() });
  results.push({ name: 'Embedding Generation', pass: await testEmbedding() });
  results.push({ name: 'Batch Embedding (RAG)', pass: await testBatchEmbedding() });
  results.push({ name: 'Mastra Agent Generate', pass: await testMastraAgent() });

  console.log('\n============================================');
  console.log('  RESULTS');
  console.log('============================================');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  ${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

