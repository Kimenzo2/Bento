/**
 * @fileoverview Brand Voice RAG Workflow — Knowledge Base Ingestion & Retrieval
 *
 * ## Pipeline Steps:
 * 1. chunkBrandText  — Split sample text into overlapping chunks (512 tokens, 50 overlap)
 * 2. generateEmbeddings — Embed each chunk via Google text-embedding-004
 * 3. storeInPgVector — Upsert chunks + embeddings into Supabase brand_voice_chunks table
 * 4. confirmIngestion — Return chunk count + brand profile metadata
 *
 * ## Database Requirements
 * Requires a Supabase table `brand_voice_chunks` with pgvector extension:
 * ```sql
 * CREATE EXTENSION IF NOT EXISTS vector;
 * CREATE TABLE brand_voice_chunks (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 *   brand_name text NOT NULL,
 *   chunk_text text NOT NULL,
 *   chunk_index int NOT NULL,
 *   embedding vector(768),
 *   created_at timestamptz DEFAULT now()
 * );
 * CREATE INDEX idx_brand_voice_embedding ON brand_voice_chunks USING ivfflat (embedding vector_cosine_ops);
 * ```
 *
 * @module mastra/workflows/brandVoiceRAGWorkflow
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const BrandVoiceInputSchema = z.object({
  userId: z.string(),
  brandName: z.string(),
  sampleText: z.string().min(50, 'Brand sample text must be at least 50 characters'),
  existingChunkIds: z.array(z.string()).optional().default([]),
});

const ChunkSchema = z.object({
  chunkIndex: z.number(),
  text: z.string(),
  tokenCount: z.number(),
});

const EmbeddedChunkSchema = ChunkSchema.extend({
  embedding: z.array(z.number()),
});

const IngestionResultSchema = z.object({
  chunksStored: z.number(),
  brandName: z.string(),
  userId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

// ─── Constants ───────────────────────────────────────────────────────────────

const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 50;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSION = 768;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getGoogleAI() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Embed an array of texts using Google's text-embedding-004 model.
 * Uses @google/generative-ai directly — no Vercel AI SDK needed.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const genAI = getGoogleAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { parts: [{ text }], role: 'user' },
    })),
  });
  return result.embeddings.map((e) => e.values);
}

/**
 * Embed a single text using Google's text-embedding-004 model.
 */
async function embedSingleText(text: string): Promise<number[]> {
  const genAI = getGoogleAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
  });
  return result.embedding.values;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkText(
  text: string,
  chunkSizeTokens: number = CHUNK_SIZE_TOKENS,
  overlapTokens: number = CHUNK_OVERLAP_TOKENS
): { text: string; tokenCount: number }[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const chunks: { text: string; tokenCount: number }[] = [];

  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > chunkSizeTokens && currentChunk.length > 0) {
      chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });
      const overlapChars = overlapTokens * 4;
      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });
  }

  return chunks;
}

// ─── Step 1: Chunk Brand Text ────────────────────────────────────────────────

const chunkBrandText = createStep({
  id: 'chunkBrandText',
  description: 'Split brand sample text into overlapping chunks (512 tokens, 50 overlap)',
  inputSchema: BrandVoiceInputSchema,
  outputSchema: z.object({
    chunks: z.array(ChunkSchema),
    totalTokens: z.number(),
    userId: z.string(),
    brandName: z.string(),
    existingChunkIds: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const input = inputData as z.infer<typeof BrandVoiceInputSchema> | undefined;
    if (!input) {
      return { chunks: [], totalTokens: 0, userId: '', brandName: '', existingChunkIds: [] };
    }

    const rawChunks = chunkText(input.sampleText, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS);

    const chunks = rawChunks.map((chunk, index) => ({
      chunkIndex: index,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
    }));

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    console.log(`[BrandVoiceRAG] Chunked "${input.brandName}" into ${chunks.length} chunks (${totalTokens} total tokens)`);

    return {
      chunks, totalTokens,
      userId: input.userId, brandName: input.brandName,
      existingChunkIds: input.existingChunkIds ?? [],
    };
  },
});

// ─── Step 2: Generate Embeddings ─────────────────────────────────────────────

const generateEmbeddings = createStep({
  id: 'generateEmbeddings',
  description: `Embed each chunk via Google ${EMBEDDING_MODEL} (dimension: ${EMBEDDING_DIMENSION})`,
  inputSchema: z.object({
    chunks: z.array(ChunkSchema),
    totalTokens: z.number(),
    userId: z.string(),
    brandName: z.string(),
    existingChunkIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    embeddedChunks: z.array(EmbeddedChunkSchema),
    userId: z.string(),
    brandName: z.string(),
    existingChunkIds: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const data = inputData as any;

    if (!data?.chunks?.length) {
      return {
        embeddedChunks: [], userId: data?.userId ?? '',
        brandName: data?.brandName ?? '', existingChunkIds: data?.existingChunkIds ?? [],
      };
    }

    const embeddedChunks: z.infer<typeof EmbeddedChunkSchema>[] = [];

    // Batch embedding calls — process in batches of 100 for API limits
    const batchSize = 100;
    const chunks = data.chunks as z.infer<typeof ChunkSchema>[];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c: any) => c.text);

      try {
        const embeddings = await embedTexts(texts);

        for (let j = 0; j < batch.length; j++) {
          embeddedChunks.push({
            ...batch[j],
            embedding: embeddings[j],
          });
        }
      } catch (err: any) {
        console.error(`[BrandVoiceRAG] Embedding batch ${i / batchSize} failed:`, err);
      }
    }

    console.log(`[BrandVoiceRAG] Generated ${embeddedChunks.length} embeddings (dim: ${EMBEDDING_DIMENSION})`);

    return {
      embeddedChunks,
      userId: data.userId, brandName: data.brandName,
      existingChunkIds: data.existingChunkIds ?? [],
    };
  },
});

// ─── Step 3: Store in pgvector ───────────────────────────────────────────────

const storeInPgVector = createStep({
  id: 'storeInPgVector',
  description: 'Upsert chunk embeddings into Supabase brand_voice_chunks table with pgvector',
  inputSchema: z.object({
    embeddedChunks: z.array(EmbeddedChunkSchema),
    userId: z.string(),
    brandName: z.string(),
    existingChunkIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    stored: z.number(),
    deleted: z.number(),
    userId: z.string(),
    brandName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const data = inputData as any;

    if (!data?.embeddedChunks?.length) {
      return { stored: 0, deleted: 0, userId: data?.userId ?? '', brandName: data?.brandName ?? '' };
    }

    const supabase = getSupabaseAdmin();
    let deletedCount = 0;

    // Step 1: Delete existing chunks for this user + brand
    try {
      const { count } = await supabase
        .from('brand_voice_chunks')
        .delete({ count: 'exact' })
        .eq('user_id', data.userId)
        .eq('brand_name', data.brandName);
      deletedCount = count ?? 0;
    } catch (err) {
      console.warn('[BrandVoiceRAG] Could not delete old chunks:', err);
    }

    // Step 2: Insert new chunks with embeddings
    const rows = data.embeddedChunks.map((chunk: any) => ({
      user_id: data.userId,
      brand_name: data.brandName,
      chunk_text: chunk.text,
      chunk_index: chunk.chunkIndex,
      embedding: JSON.stringify(chunk.embedding),
    }));

    let storedCount = 0;
    try {
      const { error } = await supabase.from('brand_voice_chunks').insert(rows);
      if (error) {
        console.error('[BrandVoiceRAG] Insert error:', error);
      } else {
        storedCount = rows.length;
      }
    } catch (err) {
      console.error('[BrandVoiceRAG] Insert failed:', err);
    }

    console.log(`[BrandVoiceRAG] Stored ${storedCount} chunks, deleted ${deletedCount} old chunks`);

    return { stored: storedCount, deleted: deletedCount, userId: data.userId, brandName: data.brandName };
  },
});

// ─── Step 4: Confirm Ingestion ───────────────────────────────────────────────

const confirmIngestion = createStep({
  id: 'confirmIngestion',
  description: 'Return final ingestion result with chunk count + metadata',
  inputSchema: z.object({
    stored: z.number(),
    deleted: z.number(),
    userId: z.string(),
    brandName: z.string(),
  }),
  outputSchema: IngestionResultSchema,
  execute: async ({ inputData }) => {
    const data = inputData as any;

    if (!data) {
      return { chunksStored: 0, brandName: '', userId: '', success: false, error: 'No input data' };
    }

    return {
      chunksStored: data.stored ?? 0,
      brandName: data.brandName ?? '',
      userId: data.userId ?? '',
      success: (data.stored ?? 0) > 0,
    };
  },
});

// ─── Workflow Definition ─────────────────────────────────────────────────────

export const brandVoiceRAGWorkflow = createWorkflow({
  id: 'brandVoiceRAG',
  inputSchema: BrandVoiceInputSchema,
  outputSchema: IngestionResultSchema,
})
  .then(chunkBrandText)
  .then(generateEmbeddings)
  .then(storeInPgVector)
  .then(confirmIngestion)
  .commit();

// ─── Retrieval Function ──────────────────────────────────────────────────────

/**
 * Retrieve the top-K most relevant brand voice chunks for a given prompt.
 * Used by storyArchitectAgent and storyEditorAgent for brand context.
 */
export async function retrieveBrandContext(
  userId: string,
  prompt: string,
  topK: number = 3
): Promise<{ text: string; similarity: number }[]> {
  try {
    const embedding = await embedSingleText(prompt);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('match_brand_voice_chunks', {
      query_embedding: JSON.stringify(embedding),
      match_count: topK,
      filter_user_id: userId,
    });

    if (error) {
      console.error('[BrandVoiceRAG] Retrieval query error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      text: row.chunk_text,
      similarity: row.similarity,
    }));
  } catch (err) {
    console.error('[BrandVoiceRAG] Retrieval failed:', err);
    return [];
  }
}

// ─── Exported Constants ──────────────────────────────────────────────────────

export {
  CHUNK_SIZE_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  chunkText,
  estimateTokens,
};
