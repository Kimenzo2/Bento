import { RequestContext } from '@mastra/core/di';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { andrewAgent } from '../agents/andrew';
import {
  ANDREW_PROMPT_VERSION,
  AndrewRuntimeRequestContextSchema,
  summarizeAndrewRequestContext,
} from '../lib/andrewRuntime';
import { getAndrewOutlineModeConfig } from '../lib/outlineModes';
import {
  analyzeSourceImage,
  critiqueGeneratedImage,
  generateImageFromReference,
} from '../lib/openai';
import { updateLifeInColourGeneration } from '../lib/supabase';
import {
  LifeInColourCritiqueSchema,
  LifeInColourGenerationRecordSchema,
  LifeInColourNormalizedPromptSchema,
  LifeInColourSourceAnalysisSchema,
  LifeInColourWorkflowInputSchema,
} from '../schemas';
import { fetchSourceImageBuffer } from '../tools/fetchSourceImage';
import { persistGenerationResult } from '../tools/persistGenerationResult';

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function logAndrewWorkflowEvent(
  logger: { info: (message: string, data?: Record<string, unknown>) => void } | undefined,
  requestContext: RequestContext<any> | undefined,
  message: string,
  data: Record<string, unknown> = {}
): void {
  logger?.info(message, {
    ...summarizeAndrewRequestContext(requestContext),
    ...data,
  });
}

const LifeInColourGenerationStartedSchema = LifeInColourWorkflowInputSchema.extend({
  startedAt: z.string(),
});

const LifeInColourSourceLoadedSchema = LifeInColourGenerationStartedSchema.extend({
  sourceDataUrl: z.string(),
  sourceByteLength: z.number().int().nonnegative(),
});

const LifeInColourSourceAnalyzedSchema = LifeInColourSourceLoadedSchema.extend({
  analysisModel: z.literal('gpt-5-nano'),
  sourceAnalysisSummary: LifeInColourSourceAnalysisSchema,
});

const LifeInColourNormalizedContextSchema = LifeInColourSourceAnalyzedSchema.extend({
  promptVersion: z.literal(ANDREW_PROMPT_VERSION),
  normalizedBrief: z.string(),
  prompt: z.string(),
  normalizedPrompt: z.string(),
  qualityChecklist: z.array(z.string()),
});

const LifeInColourRenderedSchema = LifeInColourNormalizedContextSchema.extend({
  model: z.string(),
  renderModel: z.string(),
  base64Png: z.string(),
  critique: LifeInColourCritiqueSchema,
  retryCount: z.number().int().nonnegative(),
});

const beginGenerationStep = createStep({
  id: 'beginGeneration',
  description: 'Marks the Andrew generation as processing and captures the start time.',
  inputSchema: LifeInColourWorkflowInputSchema,
  outputSchema: LifeInColourGenerationStartedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const startedAt = new Date().toISOString();
    await updateLifeInColourGeneration(inputData.generationId, {
      status: 'processing',
      started_at: startedAt,
    });

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew generation started', {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
    });

    return {
      ...inputData,
      startedAt,
    };
  },
});

const loadSourceImageStep = createStep({
  id: 'loadSourceImage',
  description: 'Downloads the source photo and prepares it for analysis and rendering.',
  inputSchema: LifeInColourGenerationStartedSchema,
  outputSchema: LifeInColourSourceLoadedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew source image load requested', {
      generationId: inputData.generationId,
      sourcePath: inputData.sourcePath,
    });

    const buffer = await fetchSourceImageBuffer(inputData.sourcePath);

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew source image loaded', {
      generationId: inputData.generationId,
      sourcePath: inputData.sourcePath,
      sourceByteLength: buffer.byteLength,
    });

    return {
      ...inputData,
      sourceDataUrl: bufferToDataUrl(buffer, inputData.sourceMimeType),
      sourceByteLength: buffer.byteLength,
    };
  },
});

const analyzeSourceImageStep = createStep({
  id: 'analyzeSourceImage',
  description: 'Builds a compact source analysis for Andrew using the uploaded image.',
  inputSchema: LifeInColourSourceLoadedSchema,
  outputSchema: LifeInColourSourceAnalyzedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew source analysis started', {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      sourceByteLength: inputData.sourceByteLength,
    });

    const sourceAnalysisSummary = await analyzeSourceImage({
      title: inputData.title,
      brief: inputData.brief,
      outlineMode: inputData.outlineMode,
      sourceDataUrl: inputData.sourceDataUrl,
      sourceMimeType: inputData.sourceMimeType,
      sourceFileName: inputData.sourceFileName,
    });

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew source analysis complete', {
      generationId: inputData.generationId,
      recommendedOutlineMode: sourceAnalysisSummary.recommendedOutlineMode,
      recommendedDetailLevel: sourceAnalysisSummary.recommendedDetailLevel,
    });

    return {
      ...inputData,
      analysisModel: 'gpt-5-nano' as const,
      sourceAnalysisSummary,
    };
  },
});

const normalizePromptStep = createStep({
  id: 'normalizePrompt',
  description: 'Uses Andrew to convert the source analysis into a production prompt.',
  inputSchema: LifeInColourSourceAnalyzedSchema,
  outputSchema: LifeInColourNormalizedContextSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const outline = getAndrewOutlineModeConfig(inputData.outlineMode);
    const prompt = [
      'Title:',
      inputData.title.trim(),
      '',
      'User brief:',
      inputData.brief.trim(),
      '',
      'Selected outline mode:',
      inputData.outlineMode,
      '',
      'Outline mode guidance:',
      outline.prompt,
      '',
      'Source analysis:',
      JSON.stringify(inputData.sourceAnalysisSummary, null, 2),
      '',
      'Write JSON only using the Andrew schema.',
      'Make the prompt production-ready for a premium black-and-white coloring page.',
    ].join('\n');

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew prompt normalization started', {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      promptVersion: ANDREW_PROMPT_VERSION,
      promptLength: prompt.length,
      sourceByteLength: inputData.sourceByteLength,
    });

    const result = await andrewAgent.generate(prompt, {
      requestContext,
      runId: inputData.generationId,
      maxSteps: 1,
    });

    const parsed = LifeInColourNormalizedPromptSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew prompt normalization complete', {
      generationId: inputData.generationId,
      promptVersion: parsed.data.promptVersion,
      checklistItems: parsed.data.qualityChecklist.length,
      normalizedBriefLength: parsed.data.normalizedBrief.length,
    });

    return {
      ...inputData,
      ...parsed.data,
      normalizedPrompt: parsed.data.prompt,
    };
  },
});

const renderAndCritiqueStep = createStep({
  id: 'renderAndCritique',
  description: 'Generates the page, critiques it, and applies one repair pass when needed.',
  inputSchema: LifeInColourNormalizedContextSchema,
  outputSchema: LifeInColourRenderedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const outline = getAndrewOutlineModeConfig(inputData.outlineMode);
    let retryCount = 0;

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew render started', {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      promptVersion: inputData.promptVersion,
      promptLength: inputData.prompt.length,
    });

    let generated = await generateImageFromReference({
      prompt: inputData.prompt,
      sourceDataUrl: inputData.sourceDataUrl,
      detail: outline.detailLevel,
      model: 'gpt-image-2',
    });

    let critiquePayload = JSON.parse(
      await critiqueGeneratedImage({
        sourceDataUrl: inputData.sourceDataUrl,
        generatedDataUrl: `data:image/png;base64,${generated.base64}`,
        criteria: inputData.qualityChecklist,
      })
    );

    let parsedCritique = LifeInColourCritiqueSchema.safeParse(critiquePayload);
    if (!parsedCritique.success) {
      throw new Error(parsedCritique.error.message);
    }

    let critique = parsedCritique.data;

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew render critique complete', {
      generationId: inputData.generationId,
      model: generated.model,
      passed: critique.passed,
      retryRecommended: critique.retryRecommended,
      retryCount,
    });

    if (!critique.passed && critique.retryRecommended && critique.refinements.length > 0) {
      retryCount = 1;
      const repairPrompt = [
        inputData.prompt,
        '',
        'Repair instructions:',
        ...critique.refinements.map((item: string) => `- ${item}`),
      ].join('\n');

      logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew repair pass started', {
        generationId: inputData.generationId,
        refinementCount: critique.refinements.length,
      });

      generated = await generateImageFromReference({
        prompt: repairPrompt,
        sourceDataUrl: inputData.sourceDataUrl,
        detail: outline.detailLevel,
        model: 'gpt-image-2',
      });

      critiquePayload = JSON.parse(
        await critiqueGeneratedImage({
          sourceDataUrl: inputData.sourceDataUrl,
          generatedDataUrl: `data:image/png;base64,${generated.base64}`,
          criteria: inputData.qualityChecklist,
        })
      );

      parsedCritique = LifeInColourCritiqueSchema.safeParse(critiquePayload);
      if (!parsedCritique.success) {
        throw new Error(parsedCritique.error.message);
      }

      critique = parsedCritique.data;

      logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew repair pass complete', {
        generationId: inputData.generationId,
        model: generated.model,
        passed: critique.passed,
        retryRecommended: critique.retryRecommended,
        retryCount,
      });
    }

    return {
      ...inputData,
      model: generated.model,
      renderModel: generated.model,
      base64Png: generated.base64,
      critique,
      retryCount,
    };
  },
});

const persistGenerationStep = createStep({
  id: 'persistGeneration',
  description: 'Persists the final Andrew result and returns the generation record.',
  inputSchema: LifeInColourRenderedSchema,
  outputSchema: LifeInColourGenerationRecordSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew persistence started', {
      generationId: inputData.generationId,
      retryCount: inputData.retryCount,
      renderModel: inputData.renderModel || inputData.model,
    });

    const result = await persistGenerationResult({
      generationId: inputData.generationId,
      userId: inputData.userId,
      sourceFileName: inputData.sourceFileName,
      base64Png: inputData.base64Png,
      normalizedPrompt: inputData.normalizedPrompt,
      provider: 'openai',
      analysisModel: inputData.analysisModel,
      model: inputData.renderModel || inputData.model,
      promptVersion: inputData.promptVersion,
      retryCount: inputData.retryCount,
      sourceAnalysisSummary: inputData.sourceAnalysisSummary,
      critique: inputData.critique,
    });

    logAndrewWorkflowEvent(loggerVNext, requestContext, 'Andrew persistence complete', {
      generationId: inputData.generationId,
      status: result.status,
      generatedPublicUrl: result.generated_public_url,
      retryCount: result.retry_count,
    });

    return result;
  },
});

export const lifeInColourWorkflow = createWorkflow({
  id: 'lifeInColour',
  description: 'Andrew generates one premium printable coloring page from a source photo.',
  inputSchema: LifeInColourWorkflowInputSchema,
  outputSchema: LifeInColourGenerationRecordSchema,
  requestContextSchema: AndrewRuntimeRequestContextSchema,
})
  .then(beginGenerationStep)
  .then(loadSourceImageStep)
  .then(analyzeSourceImageStep)
  .then(normalizePromptStep)
  .then(renderAndCritiqueStep)
  .then(persistGenerationStep)
  .commit();
