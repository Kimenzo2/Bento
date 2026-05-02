import { RequestContext } from '@mastra/core/di';
import { mastra } from '../index';
import { updateLifeInColourGeneration } from '../lib/supabase';
import type { AndrewRuntimeRequestContext } from '../lib/andrewRuntime';
import type { LifeInColourGenerationRecord, LifeInColourWorkflowInput } from '../schemas';

function toWorkflowInput(record: LifeInColourGenerationRecord): LifeInColourWorkflowInput {
  return {
    generationId: record.id,
    userId: record.user_id,
    title: record.title,
    brief: record.brief,
    outlineMode: record.outline_mode,
    sourcePath: record.source_path,
    sourceMimeType: record.source_mime_type || 'image/jpeg',
    sourceFileName: record.source_file_name || 'life-in-colour-source.png',
  };
}

export async function runLifeInColourGeneration(
  record: LifeInColourGenerationRecord,
  options?: {
    requestContext?: RequestContext<AndrewRuntimeRequestContext>;
  }
): Promise<LifeInColourGenerationRecord> {
  const workflow = mastra.getWorkflow('lifeInColour') as any;
  const result = await workflow.start({
    inputData: toWorkflowInput(record),
    requestContext: options?.requestContext,
  });

  if (result.status !== 'success') {
    throw result.error || new Error('Life in Colour generation failed.');
  }

  return result.result;
}

export async function failLifeInColourGeneration(
  generationId: string,
  message: string
): Promise<LifeInColourGenerationRecord> {
  return updateLifeInColourGeneration(generationId, {
    status: 'failed',
    error_message: message,
    completed_at: new Date().toISOString(),
  });
}
