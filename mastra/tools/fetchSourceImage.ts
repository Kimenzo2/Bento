import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  AndrewRuntimeRequestContextSchema,
  summarizeAndrewRequestContext,
} from '../lib/andrewRuntime';
import { downloadPrivateObject, LIFE_IN_COLOUR_SOURCE_BUCKET } from '../lib/supabase';

export async function fetchSourceImageBuffer(sourcePath: string): Promise<Buffer> {
  return downloadPrivateObject(LIFE_IN_COLOUR_SOURCE_BUCKET, sourcePath);
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export const fetchSourceImageTool = createTool({
  id: 'fetchSourceImage',
  description: 'Fetches the uploaded source photo for a Life in Colour generation.',
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    sourcePath: z.string(),
    sourceMimeType: z.string(),
    sourceFileName: z.string(),
  }),
  outputSchema: z.object({
    sourcePath: z.string(),
    sourceMimeType: z.string(),
    sourceFileName: z.string(),
    sourceDataUrl: z.string(),
    byteLength: z.number(),
  }),
  execute: async ({ sourcePath, sourceMimeType, sourceFileName }, context) => {
    const requestContext = context?.requestContext
      ? summarizeAndrewRequestContext(context.requestContext)
      : undefined;

    context?.loggerVNext?.info('Andrew fetchSourceImage start', {
      ...requestContext,
      sourceFileName,
      sourceMimeType,
      sourcePath,
    });

    const buffer = await fetchSourceImageBuffer(sourcePath);

    context?.loggerVNext?.info('Andrew fetchSourceImage complete', {
      ...requestContext,
      sourceFileName,
      byteLength: buffer.byteLength,
    });

    return {
      sourcePath,
      sourceMimeType,
      sourceFileName,
      sourceDataUrl: bufferToDataUrl(buffer, sourceMimeType),
      byteLength: buffer.byteLength,
    };
  },
});
