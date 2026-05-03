import { z } from 'zod';

export const AndrewOutlineModeSchema = z.enum(['simple', 'detailed', 'mandala']);
export const AndrewPromptVersionSchema = z.literal('andrew-v2');

export const LifeInColourStartRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(1).max(4000),
  outlineMode: AndrewOutlineModeSchema,
  sourcePath: z.string().trim().min(1),
  sourceMimeType: z.string().trim().min(1),
  sourceFileName: z.string().trim().min(1),
});

export const LifeInColourWorkflowInputSchema = z.object({
  generationId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(1).max(4000),
  outlineMode: AndrewOutlineModeSchema,
  sourcePath: z.string().trim().min(1),
  sourceMimeType: z.string().trim().min(1),
  sourceFileName: z.string().trim().min(1),
});

export const LifeInColourSourceAnalysisSchema = z.object({
  promptVersion: AndrewPromptVersionSchema,
  subjectSummary: z.string(),
  sceneSummary: z.string(),
  compositionSummary: z.string(),
  usefulDetails: z.array(z.string()),
  cautionFlags: z.array(z.string()),
  recommendedOutlineMode: AndrewOutlineModeSchema,
  recommendedDetailLevel: z.enum(['low', 'auto', 'high']),
  lineArtNotes: z.array(z.string()),
});

export const LifeInColourNormalizedPromptSchema = z.object({
  promptVersion: AndrewPromptVersionSchema,
  title: z.string(),
  normalizedBrief: z.string(),
  prompt: z.string(),
  qualityChecklist: z.array(z.string()),
  sourceAnalysisSummary: LifeInColourSourceAnalysisSchema,
});

export const LifeInColourCritiqueSchema = z.object({
  passed: z.boolean(),
  summary: z.string(),
  flags: z.object({
    printableLineClarity: z.boolean(),
    subjectRecognizable: z.boolean(),
    cleanNegativeSpace: z.boolean(),
    familySafe: z.boolean(),
    outlineModeCompatible: z.boolean(),
  }),
  refinements: z.array(z.string()).default([]),
  retryRecommended: z.boolean().default(false),
});

export const LifeInColourGenerationStatusSchema = z.enum([
  'queued',
  'processing',
  'ready',
  'failed',
]);

export const LifeInColourGenerationRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: LifeInColourGenerationStatusSchema,
  title: z.string(),
  brief: z.string(),
  outline_mode: AndrewOutlineModeSchema,
  source_bucket: z.string(),
  source_path: z.string(),
  source_mime_type: z.string().nullable(),
  source_file_name: z.string().nullable(),
  generated_bucket: z.string().nullable(),
  generated_path: z.string().nullable(),
  generated_public_url: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  analysis_model: z.string().nullable(),
  render_model: z.string().nullable(),
  prompt_version: z.string().nullable(),
  retry_count: z.number().int().nonnegative(),
  normalized_prompt: z.string().nullable(),
  source_analysis_summary: z.record(z.string(), z.unknown()).nullable(),
  critique_summary: z.record(z.string(), z.unknown()).nullable(),
  quality_flags: z.record(z.string(), z.unknown()).nullable(),
  fallback_eligible: z.boolean(),
  error_message: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type LifeInColourStartRequest = z.infer<typeof LifeInColourStartRequestSchema>;
export type LifeInColourWorkflowInput = z.infer<typeof LifeInColourWorkflowInputSchema>;
export type LifeInColourSourceAnalysis = z.infer<typeof LifeInColourSourceAnalysisSchema>;
export type LifeInColourNormalizedPrompt = z.infer<typeof LifeInColourNormalizedPromptSchema>;
export type LifeInColourCritique = z.infer<typeof LifeInColourCritiqueSchema>;
export type LifeInColourGenerationRecord = z.infer<typeof LifeInColourGenerationRecordSchema>;
