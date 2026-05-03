import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  AndrewRuntimeRequestContextSchema,
  summarizeAndrewRequestContext,
} from '../lib/andrewRuntime';
import { critiqueGeneratedImage } from '../lib/openai';
import { LifeInColourCritiqueSchema, type LifeInColourCritique } from '../schemas';

export async function critiqueColoringPage(input: {
  sourceDataUrl: string;
  generatedDataUrl: string;
  criteria: string[];
}): Promise<LifeInColourCritique> {
  const raw = await critiqueGeneratedImage(input);
  const parsed = LifeInColourCritiqueSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

export const critiqueColoringPageTool = createTool({
  id: 'critiqueColoringPage',
  description:
    'Critiques a generated coloring page against printability and subject fidelity criteria.',
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    sourceDataUrl: z.string(),
    generatedDataUrl: z.string(),
    criteria: z.array(z.string()),
  }),
  outputSchema: z.object({
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
  execute: async ({ sourceDataUrl, generatedDataUrl, criteria }, context) => {
    const requestContext = context?.requestContext
      ? summarizeAndrewRequestContext(context.requestContext)
      : undefined;

    context?.loggerVNext?.info('Andrew critiqueColoringPage start', {
      ...requestContext,
      criteriaCount: criteria.length,
      sourceDataUrlLength: sourceDataUrl.length,
      generatedDataUrlLength: generatedDataUrl.length,
    });

    const critique = await critiqueColoringPage({ sourceDataUrl, generatedDataUrl, criteria });

    context?.loggerVNext?.info('Andrew critiqueColoringPage complete', {
      ...requestContext,
      passed: critique.passed,
      retryRecommended: critique.retryRecommended,
    });

    return {
      passed: critique.passed,
      summary: critique.summary,
      flags: critique.flags,
      refinements: critique.refinements,
      retryRecommended: critique.retryRecommended,
    };
  },
});
