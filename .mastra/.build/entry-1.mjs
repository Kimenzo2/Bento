import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { ObservabilityStorageClickhouse } from '@mastra/clickhouse';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { Observability, SensitiveDataFilter } from '@mastra/observability';

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
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const DEFAULT_TEXT_MODEL = "gpt-5-nano";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY_1?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return apiKey;
}
async function generateStructuredText(input) {
  const userContent = [{ type: "text", text: input.user }];
  for (const image of input.images || []) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: image.url,
        detail: image.detail || "auto"
      }
    });
  }
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        {
          role: "user",
          content: userContent.length === 1 ? input.user : userContent
        }
      ]
    })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI text request failed (${response.status}): ${details}`);
  }
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("OpenAI returned an empty structured response.");
  }
  return text;
}
async function analyzeSourceImage(input) {
  const raw = await generateStructuredText({
    model: DEFAULT_TEXT_MODEL,
    system: "You are Andrew, Genesis's expert source-image analyst for premium printable coloring pages. Return JSON only.",
    user: [
      "Inspect the uploaded image and summarize only the details that matter for a premium black-and-white coloring page.",
      "Focus on silhouettes, dominant shapes, negative space, readability, and any clutter or tiny details that should be simplified.",
      "Return JSON with keys:",
      "{",
      '  "promptVersion": "andrew-v2",',
      '  "subjectSummary": "string",',
      '  "sceneSummary": "string",',
      '  "compositionSummary": "string",',
      '  "usefulDetails": ["string"],',
      '  "cautionFlags": ["string"],',
      '  "recommendedOutlineMode": "simple | detailed | mandala",',
      '  "recommendedDetailLevel": "low | auto | high",',
      '  "lineArtNotes": ["string"]',
      "}",
      `Title: ${input.title.trim()}`,
      `Brief: ${input.brief.trim()}`,
      `Selected outline mode: ${input.outlineMode}`,
      `Source file name: ${input.sourceFileName}`,
      `Source mime type: ${input.sourceMimeType}`,
      "Do not describe color. Do not describe photographic lighting except when it affects line art clarity."
    ].join("\n"),
    images: [{ url: input.sourceDataUrl, detail: "high" }]
  });
  const parsed = LifeInColourSourceAnalysisSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}
async function generateImageFromReference(input) {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_IMAGE_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: input.prompt },
            {
              type: "input_image",
              image_url: input.sourceDataUrl,
              detail: input.detail
            }
          ]
        }
      ],
      tools: [{ type: "image_generation" }]
    })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI image request failed (${response.status}): ${details}`);
  }
  const payload = await response.json();
  const imageBase64 = Array.isArray(payload.output) ? payload.output.find((item) => item.type === "image_generation_call")?.result : void 0;
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new Error("OpenAI did not return image data.");
  }
  return {
    base64: imageBase64,
    model: payload?.model || input.model || DEFAULT_IMAGE_MODEL
  };
}
async function critiqueGeneratedImage(input) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Andrew's strict quality reviewer for printable black-and-white coloring pages. Return JSON only."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Compare the source photo and the generated coloring page.",
                "Judge the output against these criteria:",
                ...input.criteria.map((criterion) => `- ${criterion}`),
                "Return JSON with: passed, summary, flags, refinements, retryRecommended.",
                "The flags object must include printableLineClarity, subjectRecognizable, cleanNegativeSpace, familySafe, and outlineModeCompatible.",
                "Be strict. If the page is close but still would benefit from a clean correction pass, set retryRecommended to true and include concrete refinements."
              ].join("\n")
            },
            { type: "image_url", image_url: { url: input.sourceDataUrl } },
            { type: "image_url", image_url: { url: input.generatedDataUrl } }
          ]
        }
      ]
    })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI critique request failed (${response.status}): ${details}`);
  }
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("OpenAI returned an empty critique response.");
  }
  return text;
}

"use strict";
async function critiqueColoringPage(input) {
  const raw = await critiqueGeneratedImage(input);
  const parsed = LifeInColourCritiqueSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}
const critiqueColoringPageTool = createTool({
  id: "critiqueColoringPage",
  description: "Critiques a generated coloring page against printability and subject fidelity criteria.",
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    sourceDataUrl: z.string(),
    generatedDataUrl: z.string(),
    criteria: z.array(z.string())
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ sourceDataUrl, generatedDataUrl, criteria }, context) => {
    const requestContext = context?.requestContext ? summarizeAndrewRequestContext(context.requestContext) : void 0;
    context?.loggerVNext?.info("Andrew critiqueColoringPage start", {
      ...requestContext,
      criteriaCount: criteria.length,
      sourceDataUrlLength: sourceDataUrl.length,
      generatedDataUrlLength: generatedDataUrl.length
    });
    const critique = await critiqueColoringPage({ sourceDataUrl, generatedDataUrl, criteria });
    context?.loggerVNext?.info("Andrew critiqueColoringPage complete", {
      ...requestContext,
      passed: critique.passed,
      retryRecommended: critique.retryRecommended
    });
    return {
      passed: critique.passed,
      summary: critique.summary,
      flags: critique.flags,
      refinements: critique.refinements,
      retryRecommended: critique.retryRecommended
    };
  }
});

export { critiqueColoringPage, critiqueColoringPageTool };
