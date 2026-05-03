import { createTool } from '@mastra/core/tools';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { ObservabilityStorageClickhouse } from '@mastra/clickhouse';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { Observability, SensitiveDataFilter } from '@mastra/observability';
import { createClient } from '@supabase/supabase-js';

"use strict";
const AndrewOutlineModeSchema = z.enum(["simple", "detailed", "mandala"]);
const AndrewPromptVersionSchema = z.literal("andrew-v2");
const LifeInColourStartRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(1).max(4e3),
  outlineMode: AndrewOutlineModeSchema,
  sourcePath: z.string().trim().min(1),
  sourceMimeType: z.string().trim().min(1),
  sourceFileName: z.string().trim().min(1)
});
const LifeInColourWorkflowInputSchema = z.object({
  generationId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(1).max(4e3),
  outlineMode: AndrewOutlineModeSchema,
  sourcePath: z.string().trim().min(1),
  sourceMimeType: z.string().trim().min(1),
  sourceFileName: z.string().trim().min(1)
});
const LifeInColourSourceAnalysisSchema = z.object({
  promptVersion: AndrewPromptVersionSchema,
  subjectSummary: z.string(),
  sceneSummary: z.string(),
  compositionSummary: z.string(),
  usefulDetails: z.array(z.string()),
  cautionFlags: z.array(z.string()),
  recommendedOutlineMode: AndrewOutlineModeSchema,
  recommendedDetailLevel: z.enum(["low", "auto", "high"]),
  lineArtNotes: z.array(z.string())
});
const LifeInColourNormalizedPromptSchema = z.object({
  promptVersion: AndrewPromptVersionSchema,
  title: z.string(),
  normalizedBrief: z.string(),
  prompt: z.string(),
  qualityChecklist: z.array(z.string()),
  sourceAnalysisSummary: LifeInColourSourceAnalysisSchema
});
const LifeInColourCritiqueSchema = z.object({
  passed: z.boolean(),
  summary: z.string(),
  flags: z.object({
    printableLineClarity: z.boolean(),
    subjectRecognizable: z.boolean(),
    cleanNegativeSpace: z.boolean(),
    familySafe: z.boolean(),
    outlineModeCompatible: z.boolean()
  }),
  refinements: z.array(z.string()).default([]),
  retryRecommended: z.boolean().default(false)
});
const LifeInColourGenerationStatusSchema = z.enum(["queued", "processing", "ready", "failed"]);
const LifeInColourGenerationRecordSchema = z.object({
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
  updated_at: z.string()
});

"use strict";
const ANDREW_PROMPT_VERSION = "andrew-v2";
const ANDREW_SERVICE_NAME = "andrew-life-in-colour";
const ANDREW_RUNTIME_STORAGE_ID = "andrew-runtime-storage";
const ANDREW_OBSERVABILITY_STORAGE_ID = "andrew-observability-storage";
const ANDREW_REQUEST_CONTEXT_KEYS = ["userId", "generationId", "outlineMode", "promptVersion"];
const AndrewRuntimeRequestContextSchema = z.object({
  userId: z.string().uuid(),
  generationId: z.string().uuid(),
  outlineMode: AndrewOutlineModeSchema,
  promptVersion: AndrewPromptVersionSchema
});
function normalizeEnvironment(environment) {
  return environment === "production" ? "production" : "development";
}
function buildAndrewRuntimeProfile(options = {}) {
  const environment = normalizeEnvironment(options.environment);
  return {
    environment,
    observabilityBackend: environment === "production" ? "clickhouse" : "duckdb",
    serviceName: ANDREW_SERVICE_NAME,
    loggingLevel: environment === "production" ? "info" : "debug",
    requestContextKeys: ANDREW_REQUEST_CONTEXT_KEYS
  };
}
function createAndrewRequestContext(input) {
  return new RequestContext([
    ["userId", input.userId],
    ["generationId", input.generationId],
    ["outlineMode", input.outlineMode],
    ["promptVersion", input.promptVersion]
  ]);
}
function summarizeAndrewRequestContext(requestContext) {
  if (!requestContext) {
    return {};
  }
  return {
    userId: requestContext.get("userId"),
    generationId: requestContext.get("generationId"),
    outlineMode: requestContext.get("outlineMode"),
    promptVersion: requestContext.get("promptVersion")
  };
}
function createAndrewLogger() {
  return new PinoLogger();
}
function createAndrewStorage(options = {}) {
  const profile = buildAndrewRuntimeProfile(options);
  const libsqlUrl = options.libsqlUrl ?? process.env.MASTRA_LIBSQL_URL ?? "file:./.mastra/andrew.db";
  const clickhouseUrl = options.clickhouseUrl ?? process.env.CLICKHOUSE_URL ?? "";
  const clickhouseUsername = options.clickhouseUsername ?? process.env.CLICKHOUSE_USERNAME ?? "default";
  const clickhousePassword = options.clickhousePassword ?? process.env.CLICKHOUSE_PASSWORD ?? "";
  if (profile.observabilityBackend === "clickhouse" && !clickhouseUrl) {
    throw new Error("CLICKHOUSE_URL is required when Andrew observability runs in production.");
  }
  const observabilityStore = profile.observabilityBackend === "clickhouse" ? new ObservabilityStorageClickhouse({
    url: clickhouseUrl,
    username: clickhouseUsername,
    password: clickhousePassword
  }) : new DuckDBStore().observability;
  return new MastraCompositeStore({
    id: ANDREW_RUNTIME_STORAGE_ID,
    default: new LibSQLStore({
      id: "andrew-libsql",
      url: libsqlUrl
    }),
    domains: {
      observability: observabilityStore
    }
  });
}
function createAndrewObservability(options = {}) {
  const profile = buildAndrewRuntimeProfile(options);
  return new Observability({
    configs: {
      default: {
        serviceName: profile.serviceName,
        requestContextKeys: [...profile.requestContextKeys],
        logging: {
          enabled: true,
          level: profile.loggingLevel
        },
        spanOutputProcessors: [new SensitiveDataFilter()]
      }
    }
  });
}
function createAndrewRuntime(options = {}) {
  return {
    profile: buildAndrewRuntimeProfile(options),
    logger: createAndrewLogger(),
    storage: createAndrewStorage(options),
    observability: createAndrewObservability(options)
  };
}

"use strict";
const LIFE_IN_COLOUR_SOURCE_BUCKET = "life-in-colour-sources";
const LIFE_IN_COLOUR_PAGE_BUCKET = "life-in-colour-pages";
let adminClient = null;
function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }
  adminClient = createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return adminClient;
}
async function downloadPrivateObject(bucket, path) {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || `Failed to download ${bucket}/${path}`);
  }
  return Buffer.from(await data.arrayBuffer());
}
async function uploadPublicPng(path, buffer) {
  const storage = getSupabaseAdmin().storage.from(LIFE_IN_COLOUR_PAGE_BUCKET);
  const { error } = await storage.upload(path, buffer, {
    upsert: true,
    contentType: "image/png"
  });
  if (error) {
    throw new Error(error.message);
  }
  return storage.getPublicUrl(path).data.publicUrl;
}
async function insertLifeInColourGeneration(input) {
  const { data, error } = await getSupabaseAdmin().from("life_in_colour_generations").insert({
    user_id: input.userId,
    status: "queued",
    title: input.title,
    brief: input.brief,
    outline_mode: input.outlineMode,
    source_bucket: LIFE_IN_COLOUR_SOURCE_BUCKET,
    source_path: input.sourcePath,
    source_mime_type: input.sourceMimeType,
    source_file_name: input.sourceFileName
  }).select("*").single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to create Life in Colour generation.");
  }
  return data;
}
async function getLifeInColourGeneration(id, userId) {
  const { data, error } = await getSupabaseAdmin().from("life_in_colour_generations").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ?? null;
}
async function listLifeInColourGenerations(userId, limit = 8) {
  const { data, error } = await getSupabaseAdmin().from("life_in_colour_generations").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
async function updateLifeInColourGeneration(id, patch) {
  const { data, error } = await getSupabaseAdmin().from("life_in_colour_generations").update(patch).eq("id", id).select("*").single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to update Life in Colour generation.");
  }
  return data;
}

"use strict";
async function persistGenerationResult(input) {
  const safeStem = input.sourceFileName.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "life-in-colour";
  const path = `${input.userId}/${input.generationId}/${safeStem}-${randomUUID()}.png`;
  const buffer = Buffer.from(input.base64Png, "base64");
  const publicUrl = await uploadPublicPng(path, buffer);
  return updateLifeInColourGeneration(input.generationId, {
    status: "ready",
    generated_bucket: "life-in-colour-pages",
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
      retryRecommended: input.critique.retryRecommended
    },
    quality_flags: input.critique.flags,
    completed_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
const persistGenerationResultTool = createTool({
  id: "persistGenerationResult",
  description: "Persists a generated Life in Colour image and writes metadata back to Supabase.",
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
        outlineModeCompatible: z.boolean()
      }),
      refinements: z.array(z.string()),
      retryRecommended: z.boolean()
    })
  }),
  outputSchema: LifeInColourGenerationRecordSchema,
  execute: async (input, context) => {
    const requestContext = context?.requestContext ? summarizeAndrewRequestContext(context.requestContext) : void 0;
    context?.loggerVNext?.info("Andrew persistGenerationResult start", {
      ...requestContext,
      generationId: input.generationId,
      retryCount: input.retryCount,
      promptVersion: input.promptVersion,
      critiquePassed: input.critique.passed,
      sourceAnalysisSummary: {
        promptVersion: input.sourceAnalysisSummary.promptVersion,
        recommendedOutlineMode: input.sourceAnalysisSummary.recommendedOutlineMode,
        recommendedDetailLevel: input.sourceAnalysisSummary.recommendedDetailLevel
      }
    });
    const record = await persistGenerationResult(input);
    if (!record.generated_public_url) {
      throw new Error("Generated public URL was not persisted.");
    }
    context?.loggerVNext?.info("Andrew persistGenerationResult complete", {
      ...requestContext,
      generationId: input.generationId,
      status: record.status,
      generatedBucket: record.generated_bucket,
      generatedPath: record.generated_path
    });
    return record;
  }
});

export { persistGenerationResult, persistGenerationResultTool };
