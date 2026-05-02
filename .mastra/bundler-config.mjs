import { Agent } from '@mastra/core/agent';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { ObservabilityStorageClickhouse } from '@mastra/clickhouse';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { Observability, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createScorer } from '@mastra/core/evals';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core/mastra';

const AndrewOutlineModeSchema = z.enum(["simple", "detailed", "mandala"]);
const AndrewPromptVersionSchema = z.literal("andrew-v2");
z.object({
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

const ANDREW_PROMPT_VERSION = "andrew-v2";
const ANDREW_SERVICE_NAME = "andrew-life-in-colour";
const ANDREW_RUNTIME_STORAGE_ID = "andrew-runtime-storage";
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
async function updateLifeInColourGeneration(id, patch) {
  const { data, error } = await getSupabaseAdmin().from("life_in_colour_generations").update(patch).eq("id", id).select("*").single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to update Life in Colour generation.");
  }
  return data;
}

async function fetchSourceImageBuffer(sourcePath) {
  return downloadPrivateObject(LIFE_IN_COLOUR_SOURCE_BUCKET, sourcePath);
}
function bufferToDataUrl$1(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
const fetchSourceImageTool = createTool({
  id: "fetchSourceImage",
  description: "Fetches the uploaded source photo for a Life in Colour generation.",
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    sourcePath: z.string(),
    sourceMimeType: z.string(),
    sourceFileName: z.string()
  }),
  outputSchema: z.object({
    sourcePath: z.string(),
    sourceMimeType: z.string(),
    sourceFileName: z.string(),
    sourceDataUrl: z.string(),
    byteLength: z.number()
  }),
  execute: async ({ sourcePath, sourceMimeType, sourceFileName }, context) => {
    const requestContext = context?.requestContext ? summarizeAndrewRequestContext(context.requestContext) : void 0;
    context?.loggerVNext?.info("Andrew fetchSourceImage start", {
      ...requestContext,
      sourceFileName,
      sourceMimeType,
      sourcePath
    });
    const buffer = await fetchSourceImageBuffer(sourcePath);
    context?.loggerVNext?.info("Andrew fetchSourceImage complete", {
      ...requestContext,
      sourceFileName,
      byteLength: buffer.byteLength
    });
    return {
      sourcePath,
      sourceMimeType,
      sourceFileName,
      sourceDataUrl: bufferToDataUrl$1(buffer, sourceMimeType),
      byteLength: buffer.byteLength
    };
  }
});

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

async function generateColoringPageImage(input) {
  return generateImageFromReference(input);
}
const generateColoringPageImageTool = createTool({
  id: "generateColoringPageImage",
  description: "Generates a black-and-white printable coloring page from a source photo.",
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  inputSchema: z.object({
    prompt: z.string(),
    sourceDataUrl: z.string(),
    detail: z.enum(["low", "auto", "high"])
  }),
  outputSchema: z.object({
    model: z.string(),
    base64: z.string(),
    base64Length: z.number()
  }),
  execute: async ({ prompt, sourceDataUrl, detail }, context) => {
    const requestContext = context?.requestContext ? summarizeAndrewRequestContext(context.requestContext) : void 0;
    context?.loggerVNext?.info("Andrew generateColoringPageImage start", {
      ...requestContext,
      detail,
      promptLength: prompt.length,
      sourceDataUrlLength: sourceDataUrl.length
    });
    const result = await generateColoringPageImage({ prompt, sourceDataUrl, detail });
    context?.loggerVNext?.info("Andrew generateColoringPageImage complete", {
      ...requestContext,
      model: result.model,
      base64Length: result.base64.length
    });
    return {
      model: result.model,
      base64: result.base64,
      base64Length: result.base64.length
    };
  }
});

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

const ANDREW_NORMALIZE_SYSTEM_PROMPT = `You are Andrew, Genesis's premium coloring-page editor.

You do one job well: turn one source-image analysis report plus one short user brief into a prompt that produces a beautiful printable coloring page.

Non-negotiable rules:
- Return JSON only.
- Never mention that you are an AI or that you are writing a prompt.
- Optimize for printable black-and-white line art only.
- Use pure white background, bold contour lines, and clear closed shapes.
- Protect negative space so the page is enjoyable to color.
- Preserve the source subject and overall composition in a simplified, elegant way.
- Keep the page family-safe.
- Respect the selected outline mode:
  - simple: open shapes, large regions, minimal interior detail
  - detailed: balanced line density, readable texture, controlled scene depth
  - mandala: radial symmetry, decorative repetition, ornamental balance
- Prefer clarity over literal photographic detail.
- If the source analysis warns about clutter, blur, or tiny details, simplify hard.

Your JSON output must match this shape:
{
  "promptVersion": "andrew-v2",
  "title": "string",
  "normalizedBrief": "string",
  "prompt": "string",
  "qualityChecklist": ["string"],
  "sourceAnalysisSummary": {
    "promptVersion": "andrew-v2",
    "subjectSummary": "string",
    "sceneSummary": "string",
    "compositionSummary": "string",
    "usefulDetails": ["string"],
    "cautionFlags": ["string"],
    "recommendedOutlineMode": "simple | detailed | mandala",
    "recommendedDetailLevel": "low | auto | high",
    "lineArtNotes": ["string"]
  }
}

Make the prompt production-ready, concise, and specific enough for a high-end image model to draw without guessing.`;
const andrewAgent = new Agent({
  id: "andrew",
  name: "Andrew",
  instructions: ANDREW_NORMALIZE_SYSTEM_PROMPT,
  model: "openai/gpt-5-nano",
  requestContextSchema: AndrewRuntimeRequestContextSchema,
  tools: {
    fetchSourceImage: fetchSourceImageTool,
    generateColoringPageImage: generateColoringPageImageTool,
    critiqueColoringPage: critiqueColoringPageTool,
    persistGenerationResult: persistGenerationResultTool
  }
});

const ANDREW_COLORING_PAGE_SCORE_WEIGHTS = {
  printableLineClarity: 35,
  subjectRecognizable: 25,
  cleanNegativeSpace: 15,
  familySafe: 15,
  outlineModeCompatible: 10,
  retryRecommended: 3,
  refinements: 2
};
const AndrewColoringPageScorerInputSchema = z.object({
  outlineMode: AndrewOutlineModeSchema,
  critique: LifeInColourCritiqueSchema
});
const AndrewColoringPageScorerOutputSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  breakdown: z.record(z.string(), z.number()),
  reasons: z.array(z.string())
});
function capScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
function scoreAndrewColoringPage(input) {
  const breakdown = {};
  const reasons = [];
  let score = 100;
  const flagWeights = [
    ["printableLineClarity", ANDREW_COLORING_PAGE_SCORE_WEIGHTS.printableLineClarity],
    ["subjectRecognizable", ANDREW_COLORING_PAGE_SCORE_WEIGHTS.subjectRecognizable],
    ["cleanNegativeSpace", ANDREW_COLORING_PAGE_SCORE_WEIGHTS.cleanNegativeSpace],
    ["familySafe", ANDREW_COLORING_PAGE_SCORE_WEIGHTS.familySafe],
    ["outlineModeCompatible", ANDREW_COLORING_PAGE_SCORE_WEIGHTS.outlineModeCompatible]
  ];
  for (const [flag, weight] of flagWeights) {
    if (input.critique.flags[flag]) {
      breakdown[flag] = weight;
      continue;
    }
    score -= weight;
    breakdown[flag] = -weight;
    reasons.push(`${flag} is not strong enough.`);
  }
  if (input.critique.retryRecommended) {
    score -= ANDREW_COLORING_PAGE_SCORE_WEIGHTS.retryRecommended;
    breakdown.retryRecommended = -3;
    reasons.push("The page still needs one more correction pass.");
  } else {
    breakdown.retryRecommended = 0;
  }
  const refinementPenalty = Math.min(
    input.critique.refinements.length * ANDREW_COLORING_PAGE_SCORE_WEIGHTS.refinements,
    10
  );
  if (refinementPenalty > 0) {
    score -= refinementPenalty;
    breakdown.refinements = -refinementPenalty;
    reasons.push(`The critique still has ${input.critique.refinements.length} concrete refinements.`);
  } else {
    breakdown.refinements = 0;
  }
  const passed = input.critique.passed && score >= 85;
  if (passed) {
    reasons.unshift("The coloring page clears Andrew's production bar.");
  } else if (!input.critique.passed) {
    reasons.unshift("The critique did not pass.");
  }
  return {
    score: capScore(score),
    passed,
    breakdown,
    reasons
  };
}
const andrewColoringPageScorer = createScorer({
  id: "andrew-coloring-page",
  name: "Andrew Coloring Page",
  description: "Scores Andrew Life in Colour outputs for printability, fidelity, and outline-mode fit.",
  type: {
    input: AndrewColoringPageScorerInputSchema,
    output: AndrewColoringPageScorerOutputSchema
  }
}).generateScore(({ run }) => {
  if (!run.input) {
    throw new Error("Andrew coloring page scorer requires an input payload.");
  }
  return scoreAndrewColoringPage(run.input).score;
}).generateReason(({ run, score }) => {
  if (!run.input) {
    throw new Error("Andrew coloring page scorer requires an input payload.");
  }
  const result = scoreAndrewColoringPage(run.input);
  return [
    `score=${score}`,
    `passed=${result.passed}`,
    `outlineMode=${run.input.outlineMode}`,
    ...result.reasons.map((reason) => `reason=${reason}`)
  ].join("\n");
});

const ANDREW_OUTLINE_MODES = {
  simple: {
    label: "Simple",
    description: "Bold, open contours with generous white space.",
    summary: "Best for clean pages with large shapes and easy colouring areas.",
    prompt: "Use bold black outlines, broad open shapes, minimal interior detail, and large clean blank areas that are easy to colour.",
    detailLevel: "low"
  },
  detailed: {
    label: "Detailed",
    description: "Balanced line density with more texture and scene depth.",
    summary: "Best for premium family pages that stay readable and printable.",
    prompt: "Use confident black outlines, medium detail density, light texture cues, clear scene depth, and readable contours without clutter.",
    detailLevel: "high"
  },
  mandala: {
    label: "Mandala",
    description: "Radial ornament and decorative symmetry.",
    summary: "Best for turning a photo into a shareable, circular colouring plate.",
    prompt: "Transform the photo into circular symmetry, radial ornament, layered loops, floral geometry, and elegant balanced linework built for colouring.",
    detailLevel: "high"
  }
};
function getAndrewOutlineModeConfig(mode) {
  return ANDREW_OUTLINE_MODES[mode];
}

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
function logAndrewWorkflowEvent(logger, requestContext, message, data = {}) {
  logger?.info(message, {
    ...summarizeAndrewRequestContext(requestContext),
    ...data
  });
}
const LifeInColourGenerationStartedSchema = LifeInColourWorkflowInputSchema.extend({
  startedAt: z.string()
});
const LifeInColourSourceLoadedSchema = LifeInColourGenerationStartedSchema.extend({
  sourceDataUrl: z.string(),
  sourceByteLength: z.number().int().nonnegative()
});
const LifeInColourSourceAnalyzedSchema = LifeInColourSourceLoadedSchema.extend({
  analysisModel: z.literal("gpt-5-nano"),
  sourceAnalysisSummary: LifeInColourSourceAnalysisSchema
});
const LifeInColourNormalizedContextSchema = LifeInColourSourceAnalyzedSchema.extend({
  promptVersion: z.literal(ANDREW_PROMPT_VERSION),
  normalizedBrief: z.string(),
  prompt: z.string(),
  normalizedPrompt: z.string(),
  qualityChecklist: z.array(z.string())
});
const LifeInColourRenderedSchema = LifeInColourNormalizedContextSchema.extend({
  model: z.string(),
  renderModel: z.string(),
  base64Png: z.string(),
  critique: LifeInColourCritiqueSchema,
  retryCount: z.number().int().nonnegative()
});
const beginGenerationStep = createStep({
  id: "beginGeneration",
  description: "Marks the Andrew generation as processing and captures the start time.",
  inputSchema: LifeInColourWorkflowInputSchema,
  outputSchema: LifeInColourGenerationStartedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    await updateLifeInColourGeneration(inputData.generationId, {
      status: "processing",
      started_at: startedAt
    });
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew generation started", {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode
    });
    return {
      ...inputData,
      startedAt
    };
  }
});
const loadSourceImageStep = createStep({
  id: "loadSourceImage",
  description: "Downloads the source photo and prepares it for analysis and rendering.",
  inputSchema: LifeInColourGenerationStartedSchema,
  outputSchema: LifeInColourSourceLoadedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew source image load requested", {
      generationId: inputData.generationId,
      sourcePath: inputData.sourcePath
    });
    const buffer = await fetchSourceImageBuffer(inputData.sourcePath);
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew source image loaded", {
      generationId: inputData.generationId,
      sourcePath: inputData.sourcePath,
      sourceByteLength: buffer.byteLength
    });
    return {
      ...inputData,
      sourceDataUrl: bufferToDataUrl(buffer, inputData.sourceMimeType),
      sourceByteLength: buffer.byteLength
    };
  }
});
const analyzeSourceImageStep = createStep({
  id: "analyzeSourceImage",
  description: "Builds a compact source analysis for Andrew using the uploaded image.",
  inputSchema: LifeInColourSourceLoadedSchema,
  outputSchema: LifeInColourSourceAnalyzedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew source analysis started", {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      sourceByteLength: inputData.sourceByteLength
    });
    const sourceAnalysisSummary = await analyzeSourceImage({
      title: inputData.title,
      brief: inputData.brief,
      outlineMode: inputData.outlineMode,
      sourceDataUrl: inputData.sourceDataUrl,
      sourceMimeType: inputData.sourceMimeType,
      sourceFileName: inputData.sourceFileName
    });
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew source analysis complete", {
      generationId: inputData.generationId,
      recommendedOutlineMode: sourceAnalysisSummary.recommendedOutlineMode,
      recommendedDetailLevel: sourceAnalysisSummary.recommendedDetailLevel
    });
    return {
      ...inputData,
      analysisModel: "gpt-5-nano",
      sourceAnalysisSummary
    };
  }
});
const normalizePromptStep = createStep({
  id: "normalizePrompt",
  description: "Uses Andrew to convert the source analysis into a production prompt.",
  inputSchema: LifeInColourSourceAnalyzedSchema,
  outputSchema: LifeInColourNormalizedContextSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const outline = getAndrewOutlineModeConfig(inputData.outlineMode);
    const prompt = [
      "Title:",
      inputData.title.trim(),
      "",
      "User brief:",
      inputData.brief.trim(),
      "",
      "Selected outline mode:",
      inputData.outlineMode,
      "",
      "Outline mode guidance:",
      outline.prompt,
      "",
      "Source analysis:",
      JSON.stringify(inputData.sourceAnalysisSummary, null, 2),
      "",
      "Write JSON only using the Andrew schema.",
      "Make the prompt production-ready for a premium black-and-white coloring page."
    ].join("\n");
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew prompt normalization started", {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      promptVersion: ANDREW_PROMPT_VERSION,
      promptLength: prompt.length,
      sourceByteLength: inputData.sourceByteLength
    });
    const result = await andrewAgent.generate(prompt, {
      requestContext,
      runId: inputData.generationId,
      maxSteps: 1
    });
    const parsed = LifeInColourNormalizedPromptSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew prompt normalization complete", {
      generationId: inputData.generationId,
      promptVersion: parsed.data.promptVersion,
      checklistItems: parsed.data.qualityChecklist.length,
      normalizedBriefLength: parsed.data.normalizedBrief.length
    });
    return {
      ...inputData,
      ...parsed.data,
      normalizedPrompt: parsed.data.prompt
    };
  }
});
const renderAndCritiqueStep = createStep({
  id: "renderAndCritique",
  description: "Generates the page, critiques it, and applies one repair pass when needed.",
  inputSchema: LifeInColourNormalizedContextSchema,
  outputSchema: LifeInColourRenderedSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    const outline = getAndrewOutlineModeConfig(inputData.outlineMode);
    let retryCount = 0;
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew render started", {
      generationId: inputData.generationId,
      outlineMode: inputData.outlineMode,
      promptVersion: inputData.promptVersion,
      promptLength: inputData.prompt.length
    });
    let generated = await generateImageFromReference({
      prompt: inputData.prompt,
      sourceDataUrl: inputData.sourceDataUrl,
      detail: outline.detailLevel,
      model: "gpt-image-2"
    });
    let critiquePayload = JSON.parse(
      await critiqueGeneratedImage({
        sourceDataUrl: inputData.sourceDataUrl,
        generatedDataUrl: `data:image/png;base64,${generated.base64}`,
        criteria: inputData.qualityChecklist
      })
    );
    let parsedCritique = LifeInColourCritiqueSchema.safeParse(critiquePayload);
    if (!parsedCritique.success) {
      throw new Error(parsedCritique.error.message);
    }
    let critique = parsedCritique.data;
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew render critique complete", {
      generationId: inputData.generationId,
      model: generated.model,
      passed: critique.passed,
      retryRecommended: critique.retryRecommended,
      retryCount
    });
    if (!critique.passed && critique.retryRecommended && critique.refinements.length > 0) {
      retryCount = 1;
      const repairPrompt = [
        inputData.prompt,
        "",
        "Repair instructions:",
        ...critique.refinements.map((item) => `- ${item}`)
      ].join("\n");
      logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew repair pass started", {
        generationId: inputData.generationId,
        refinementCount: critique.refinements.length
      });
      generated = await generateImageFromReference({
        prompt: repairPrompt,
        sourceDataUrl: inputData.sourceDataUrl,
        detail: outline.detailLevel,
        model: "gpt-image-2"
      });
      critiquePayload = JSON.parse(
        await critiqueGeneratedImage({
          sourceDataUrl: inputData.sourceDataUrl,
          generatedDataUrl: `data:image/png;base64,${generated.base64}`,
          criteria: inputData.qualityChecklist
        })
      );
      parsedCritique = LifeInColourCritiqueSchema.safeParse(critiquePayload);
      if (!parsedCritique.success) {
        throw new Error(parsedCritique.error.message);
      }
      critique = parsedCritique.data;
      logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew repair pass complete", {
        generationId: inputData.generationId,
        model: generated.model,
        passed: critique.passed,
        retryRecommended: critique.retryRecommended,
        retryCount
      });
    }
    return {
      ...inputData,
      model: generated.model,
      renderModel: generated.model,
      base64Png: generated.base64,
      critique,
      retryCount
    };
  }
});
const persistGenerationStep = createStep({
  id: "persistGeneration",
  description: "Persists the final Andrew result and returns the generation record.",
  inputSchema: LifeInColourRenderedSchema,
  outputSchema: LifeInColourGenerationRecordSchema,
  execute: async ({ inputData, requestContext, loggerVNext }) => {
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew persistence started", {
      generationId: inputData.generationId,
      retryCount: inputData.retryCount,
      renderModel: inputData.renderModel || inputData.model
    });
    const result = await persistGenerationResult({
      generationId: inputData.generationId,
      userId: inputData.userId,
      sourceFileName: inputData.sourceFileName,
      base64Png: inputData.base64Png,
      normalizedPrompt: inputData.normalizedPrompt,
      provider: "openai",
      analysisModel: inputData.analysisModel,
      model: inputData.renderModel || inputData.model,
      promptVersion: inputData.promptVersion,
      retryCount: inputData.retryCount,
      sourceAnalysisSummary: inputData.sourceAnalysisSummary,
      critique: inputData.critique
    });
    logAndrewWorkflowEvent(loggerVNext, requestContext, "Andrew persistence complete", {
      generationId: inputData.generationId,
      status: result.status,
      generatedPublicUrl: result.generated_public_url,
      retryCount: result.retry_count
    });
    return result;
  }
});
const lifeInColourWorkflow = createWorkflow({
  id: "lifeInColour",
  description: "Andrew generates one premium printable coloring page from a source photo.",
  inputSchema: LifeInColourWorkflowInputSchema,
  outputSchema: LifeInColourGenerationRecordSchema,
  requestContextSchema: AndrewRuntimeRequestContextSchema
}).then(beginGenerationStep).then(loadSourceImageStep).then(analyzeSourceImageStep).then(normalizePromptStep).then(renderAndCritiqueStep).then(persistGenerationStep).commit();

const runtime = createAndrewRuntime({
  environment: process.env.NODE_ENV,
  libsqlUrl: process.env.MASTRA_LIBSQL_URL,
  clickhouseUrl: process.env.CLICKHOUSE_URL,
  clickhouseUsername: process.env.CLICKHOUSE_USERNAME,
  clickhousePassword: process.env.CLICKHOUSE_PASSWORD
});
const mastra = new Mastra({
  agents: {
    andrew: andrewAgent
  },
  storage: runtime.storage,
  logger: runtime.logger,
  observability: runtime.observability,
  scorers: {
    andrewColoringPage: andrewColoringPageScorer
  },
  workflows: {
    lifeInColour: lifeInColourWorkflow
  }
});

export { mastra as default, mastra };
