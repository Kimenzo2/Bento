import { createTool } from '@mastra/core/tools';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AndrewRuntimeRequestContextSchema, summarizeAndrewRequestContext } from '../lib/andrewRuntime';
import { uploadPublicPng, updateLifeInColourGeneration } from '../lib/supabase';
import type {
  LifeInColourCritique,
  LifeInColourGenerationRecord,
  LifeInColourSourceAnalysis,
} from '../schemas';
import {
  LifeInColourGenerationRecordSchema,
  LifeInColourSourceAnalysisSchema,
} from '../schemas';

export async function persistGenerationResult(input: {
  generationId: string;
  userId: string;
  sourceFileName: string;
  base64Png: string;
  normalizedPrompt: string;
  provider: string;
  analysisModel: string;
  model: string;
  promptVersion: string;
  retryCount: number;
  sourceAnalysisSummary: LifeInColourSourceAnalysis;
  critique: LifeInColourCritique;
}): Promise<LifeInColourGenerationRecord> {
  const safeStem = input.sourceFileName
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'life-in-colour';

  const path = `${input.userId}/${input.generationId}/${safeStem}-${randomUUID()}.png`;
  const buffer = Buffer.from(input.base64Png, 'base64');
  const publicUrl = await uploadPublicPng(path, buffer);

  return updateLifeInColourGeneration(input.generationId, {
    status: 'ready',
    generated_bucket: 'life-in-colour-pages',
    generated_path: path,
    generated_public_url: publicUrl,
    provider: input.provider,
    analysis_model: input.analysisModel,
    model: input.model,
    render_model: input.model,
    prompt_version: input.promptVersion,
    retry_count: input.retryCount,
    normalized_prompt: input.normalizedPrompt,
    source_analysis_summary: input.sourceAnalysisSummary,
    critique_summary: {
      summary: input.critique.summary,
      refinements: input.critique.refinements,
      passed: input.critique.passed,
      retryRecommended: input.critique.retryRecommended,
    },
    quality_flags: input.critique.flags,
    completed_at: new Date().toISOString(),
  });
}

export const persistGenerationResultTool = createTool({
  id: 'persistGenerationResult',
  description: 'Persists a generated Life in Colour image and writes metadata back to Supabase.',
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    generationId: z.string().uuid(),
    userId: z.string().uuid(),
    sourceFileName: z.string(),
    base64Png: z.string(),
    normalizedPrompt: z.string(),
    provider: z.string(),
    analysisModel: z.string(),
    model: z.string(),
    promptVersion: z.string(),
    retryCount: z.number().int().nonnegative(),
    sourceAnalysisSummary: LifeInColourSourceAnalysisSchema,
    critique: z.object({
      passed: z.boolean(),
      summary: z.string(),
      flags: z.object({
        printableLineClarity: z.boolean(),
        subjectRecognizable: z.boolean(),
        cleanNegativeSpace: z.boolean(),
        familySafe: z.boolean(),
        outlineModeCompatible: z.boolean(),
      }),
      refinements: z.array(z.string()),
      retryRecommended: z.boolean(),
    }),
  }),
  outputSchema: LifeInColourGenerationRecordSchema,
  execute: async (input, context) => {
    const requestContext = context?.requestContext
      ? summarizeAndrewRequestContext(context.requestContext)
      : undefined;

    context?.loggerVNext?.info('Andrew persistGenerationResult start', {
      ...requestContext,
      generationId: input.generationId,
      retryCount: input.retryCount,
      promptVersion: input.promptVersion,
      critiquePassed: input.critique.passed,
      sourceAnalysisSummary: {
        promptVersion: input.sourceAnalysisSummary.promptVersion,
        recommendedOutlineMode: input.sourceAnalysisSummary.recommendedOutlineMode,
        recommendedDetailLevel: input.sourceAnalysisSummary.recommendedDetailLevel,
      },
    });

    const record = await persistGenerationResult(input);
    if (!record.generated_public_url) {
      throw new Error('Generated public URL was not persisted.');
    }

    context?.loggerVNext?.info('Andrew persistGenerationResult complete', {
      ...requestContext,
      generationId: input.generationId,
      status: record.status,
      generatedBucket: record.generated_bucket,
      generatedPath: record.generated_path,
    });

    return record;
  },
});
