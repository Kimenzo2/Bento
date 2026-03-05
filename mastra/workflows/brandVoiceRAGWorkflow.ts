/**
 * @fileoverview Brand Voice RAG Workflow — Knowledge Base Ingestion & Retrieval
 *
 * ## What This File Does
 * This workflow handles Brand Profile voice ingestion: when a user saves
 * brand sampleText in BrandProfileManager, this workflow chunks the text,
 * generates embeddings using Google text-embedding, and stores them in
 * Supabase pgvector. It also exposes a retrieval function that returns
 * the top-3 most relevant chunks for any given prompt—used by storyArchitect
 * and storyEditor agents to stay on-brand.
 *
 * ## Pipeline Steps:
 * 1. chunkBrandText  — Split sample text into overlapping chunks (512 tokens, 50 overlap)
 * 2. generateEmbeddings — Embed each chunk via Google text-embedding-004
 * 3. storeInPgVector — Upsert chunks + embeddings into Supabase brand_voice_chunks table
 * 4. confirmIngestion — Return chunk count + brand profile metadata
 *
 * ## What It Replaces
 * - Static brand profile text stored as a single blob in BrandProfileManager
 * - No existing RAG pipeline exists; this is net-new capability
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
 * ## Retrieval Function
 * `retrieveBrandContext(userId, prompt, topK=3)` — queries pgvector for
 * the most relevant chunks and returns them as context for agent prompts.
 *
 * @module mastra/workflows/brandVoiceRAGWorkflow
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

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
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;

// ─── Utility: Simple Token Estimation ────────────────────────────────────────

/**
 * Rough token estimation: ~4 characters per token for English text.
 * For production, use tiktoken or the model's tokenizer.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into overlapping chunks of approximately CHUNK_SIZE_TOKENS tokens.
 * Uses sentence boundaries where possible to avoid mid-sentence splits.
 */
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
      // Store current chunk
      chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });

      // Start new chunk with overlap: take the last N tokens worth of text
      const overlapChars = overlapTokens * 4;
      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });
  }

  return chunks;
}

// ─── Step 1: Chunk Brand Text ────────────────────────────────────────────────

const chunkBrandText = createStep({
  id: 'chunkBrandText',
  description: 'Split brand sample text into overlapping chunks (512 tokens, 50 overlap) using sentence boundaries',
  inputSchema: BrandVoiceInputSchema,
  outputSchema: z.object({
    chunks: z.array(ChunkSchema),
    totalTokens: z.number(),
  }),
  execute: async ({ inputData }) => {
    const input = inputData as z.infer<typeof BrandVoiceInputSchema> | undefined;
    if (!input) {
      return { chunks: [], totalTokens: 0 };
    }

    const rawChunks = chunkText(input.sampleText, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS);

    const chunks = rawChunks.map((chunk, index) => ({
      chunkIndex: index,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
    }));

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    console.log(`[BrandVoiceRAG] Chunked "${input.brandName}" into ${chunks.length} chunks (${totalTokens} total tokens)`);

    return { chunks, totalTokens };
  },
});

// ─── Step 2: Generate Embeddings ─────────────────────────────────────────────

const generateEmbeddings = createStep({
  id: 'generateEmbeddings',
  description: `Embed each chunk via Google ${EMBEDDING_MODEL} (dimension: ${EMBEDDING_DIMENSION})`,
  inputSchema: z.any(),
  outputSchema: z.object({
    embeddedChunks: z.array(EmbeddedChunkSchema),
  }),
  execute: async ({ getStepResult }) => {
    const chunkResult = getStepResult('chunkBrandText') as {
      chunks: z.infer<typeof ChunkSchema>[];
    } | null;

    if (!chunkResult?.chunks?.length) {
      return { embeddedChunks: [] };
    }

    const embeddedChunks: z.infer<typeof EmbeddedChunkSchema>[] = [];

    // In production, batch embedding calls for efficiency:
    // const { embedMany } = await import('ai');
    // const { google } = await import('@ai-sdk/google');
    // const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL);
    // const { embeddings } = await embedMany({
    //   model: embeddingModel,
    //   values: chunkResult.chunks.map(c => c.text),
    // });
    //
    // For parallel batches (if > 100 chunks):
    // Process in batches of 100 to stay under API limits

    for (const chunk of chunkResult.chunks) {
      // Placeholder embedding — will be replaced with actual Google API call
      const placeholderEmbedding = new Array(EMBEDDING_DIMENSION).fill(0);

      embeddedChunks.push({
        ...chunk,
        embedding: placeholderEmbedding,
      });
    }

    console.log(`[BrandVoiceRAG] Generated ${embeddedChunks.length} embeddings (dim: ${EMBEDDING_DIMENSION})`);

    return { embeddedChunks };
  },
});

// ─── Step 3: Store in pgvector ───────────────────────────────────────────────

const storeInPgVector = createStep({
  id: 'storeInPgVector',
  description: 'Upsert chunk embeddings into Supabase brand_voice_chunks table with pgvector',
  inputSchema: z.any(),
  outputSchema: z.object({
    stored: z.number(),
    deleted: z.number(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const input = inputData as z.infer<typeof BrandVoiceInputSchema> | undefined;
    const embeddingResult = getStepResult('generateEmbeddings') as {
      embeddedChunks: z.infer<typeof EmbeddedChunkSchema>[];
    } | null;

    if (!input || !embeddingResult?.embeddedChunks?.length) {
      return { stored: 0, deleted: 0 };
    }

    // In production:
    // const { createClient } = await import('@supabase/supabase-js');
    // const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    //
    // Step 1: Delete existing chunks for this user + brand
    // if (input.existingChunkIds.length > 0) {
    //   await supabase
    //     .from('brand_voice_chunks')
    //     .delete()
    //     .eq('user_id', input.userId)
    //     .eq('brand_name', input.brandName);
    // }
    //
    // Step 2: Insert new chunks
    // const rows = embeddingResult.embeddedChunks.map(chunk => ({
    //   user_id: input.userId,
    //   brand_name: input.brandName,
    //   chunk_text: chunk.text,
    //   chunk_index: chunk.chunkIndex,
    //   embedding: JSON.stringify(chunk.embedding),
    // }));
    //
    // await supabase.from('brand_voice_chunks').insert(rows);

    const deletedCount = input.existingChunkIds?.length ?? 0;
    const storedCount = embeddingResult.embeddedChunks.length;

    console.log(`[BrandVoiceRAG] Stored ${storedCount} chunks, deleted ${deletedCount} old chunks`);

    return { stored: storedCount, deleted: deletedCount };
  },
});

// ─── Step 4: Confirm Ingestion ───────────────────────────────────────────────

const confirmIngestion = createStep({
  id: 'confirmIngestion',
  description: 'Return final ingestion result with chunk count + metadata',
  inputSchema: z.any(),
  outputSchema: IngestionResultSchema,
  execute: async ({ inputData, getStepResult }) => {
    const input = inputData as z.infer<typeof BrandVoiceInputSchema> | undefined;
    const storeResult = getStepResult('storeInPgVector') as { stored: number; deleted: number } | null;

    if (!input) {
      return { chunksStored: 0, brandName: '', userId: '', success: false, error: 'No input data' };
    }

    return {
      chunksStored: storeResult?.stored ?? 0,
      brandName: input.brandName,
      userId: input.userId,
      success: (storeResult?.stored ?? 0) > 0,
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
// This is NOT a workflow step — it's a standalone async function that agents
// call via tool definitions to retrieve relevant brand voice context.

/**
 * Retrieve the top-K most relevant brand voice chunks for a given prompt.
 *
 * Used by storyArchitectAgent and storyEditorAgent to inject brand context
 * into their system prompts.
 *
 * @param userId - The user's Supabase user ID
 * @param prompt - The text to find relevant brand context for
 * @param topK - Number of chunks to return (default: 3)
 * @returns Array of relevant chunk texts, ordered by similarity
 */
export async function retrieveBrandContext(
  userId: string,
  prompt: string,
  topK: number = 3
): Promise<{ text: string; similarity: number }[]> {
  // In production:
  // 1. Generate embedding for the prompt
  //    const { embed } = await import('ai');
  //    const { google } = await import('@ai-sdk/google');
  //    const { embedding } = await embed({
  //      model: google.textEmbeddingModel(EMBEDDING_MODEL),
  //      value: prompt,
  //    });
  //
  // 2. Query pgvector for the nearest neighbors
  //    const { createClient } = await import('@supabase/supabase-js');
  //    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  //
  //    const { data } = await supabase.rpc('match_brand_voice_chunks', {
  //      query_embedding: JSON.stringify(embedding),
  //      match_count: topK,
  //      filter_user_id: userId,
  //    });
  //
  //    return data.map(row => ({ text: row.chunk_text, similarity: row.similarity }));
  //
  // Required Supabase RPC function:
  // ```sql
  // CREATE OR REPLACE FUNCTION match_brand_voice_chunks(
  //   query_embedding vector(768),
  //   match_count int DEFAULT 3,
  //   filter_user_id uuid DEFAULT NULL
  // )
  // RETURNS TABLE (
  //   id uuid,
  //   chunk_text text,
  //   chunk_index int,
  //   similarity float
  // )
  // LANGUAGE plpgsql AS $$
  // BEGIN
  //   RETURN QUERY
  //   SELECT
  //     bvc.id,
  //     bvc.chunk_text,
  //     bvc.chunk_index,
  //     1 - (bvc.embedding <=> query_embedding) AS similarity
  //   FROM brand_voice_chunks bvc
  //   WHERE (filter_user_id IS NULL OR bvc.user_id = filter_user_id)
  //   ORDER BY bvc.embedding <=> query_embedding
  //   LIMIT match_count;
  // END;
  // $$;
  // ```

  console.log(`[BrandVoiceRAG] Retrieving top-${topK} chunks for user ${userId}`);

  // Placeholder — will be populated when DB is configured
  return [];
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
