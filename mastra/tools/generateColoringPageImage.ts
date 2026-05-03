import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  AndrewRuntimeRequestContextSchema,
  summarizeAndrewRequestContext,
} from '../lib/andrewRuntime';
import { generateImageFromReference } from '../lib/openai';

export async function generateColoringPageImage(input: {
  prompt: string;
  sourceDataUrl: string;
  detail: 'low' | 'auto' | 'high';
}): Promise<{ base64: string; model: string }> {
  return generateImageFromReference(input);
}

export const generateColoringPageImageTool = createTool({
  id: 'generateColoringPageImage',
  description: 'Generates a black-and-white printable coloring page from a source photo.',
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    prompt: z.string(),
    sourceDataUrl: z.string(),
    detail: z.enum(['low', 'auto', 'high']),
  }),
  outputSchema: z.object({
    model: z.string(),
    base64: z.string(),
    base64Length: z.number(),
  }),
  execute: async ({ prompt, sourceDataUrl, detail }, context) => {
    const requestContext = context?.requestContext
      ? summarizeAndrewRequestContext(context.requestContext)
      : undefined;

    context?.loggerVNext?.info('Andrew generateColoringPageImage start', {
      ...requestContext,
      detail,
      promptLength: prompt.length,
      sourceDataUrlLength: sourceDataUrl.length,
    });

    const result = await generateColoringPageImage({ prompt, sourceDataUrl, detail });

    context?.loggerVNext?.info('Andrew generateColoringPageImage complete', {
      ...requestContext,
      model: result.model,
      base64Length: result.base64.length,
    });

    return {
      model: result.model,
      base64: result.base64,
      base64Length: result.base64.length,
    };
  },
});
