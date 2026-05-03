/**
 * Mastra-side AI gateway for Genesis.
 *
 * This module replaces the old provider-specific proxy layer with a small,
 * server-only gateway that can:
 * - normalize legacy text-generation requests
 * - route text generation to OpenAI
 * - generate embeddings with OpenAI at a fixed dimension
 * - proxy image generation to Bytez
 *
 * The rest of the app can keep sending the old request shapes during the
 * first cutover pass while the runtime path settles on Mastra.
 */

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
  /\/+$/,
  ''
);
const BYTEZ_BASE_URL = 'https://api.bytez.com/models/v2/run';

const DEFAULT_TEXT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_BOOK_MODEL = 'openai/gpt-4o';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 768;
const DEFAULT_BYTEZ_IMAGE_MODEL = 'google/imagen-4.0-generate-001';

type LegacyMessageRole = 'user' | 'assistant' | 'system';

type LegacyMessagePart = {
  text?: string;
};

type LegacyMessageContent = {
  role?: string;
  parts?: LegacyMessagePart[];
};

type LegacyGenerationConfig = {
  temperature?: number;
  topP?: number;
  top_p?: number;
  topK?: number;
  top_k?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
};

export interface LegacyTextGenerationRequest {
  model?: string;
  prompt?: string;
  contents?: LegacyMessageContent[];
  messages?: Array<{ role: LegacyMessageRole | string; content: string }>;
  systemInstruction?: string | { parts?: LegacyMessagePart[] };
  config?: LegacyGenerationConfig;
  generationConfig?: LegacyGenerationConfig;
  maxTokens?: number;
}

export interface LegacyTextGenerationResult {
  text: string;
  raw: unknown;
  model: string;
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY_1?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return apiKey;
}

function getBytezApiKey(): string | null {
  return process.env.BYTEZ_API_KEY_1?.trim() || process.env.BYTEZ_API_KEY?.trim() || null;
}

function extractSystemInstruction(
  systemInstruction?: LegacyTextGenerationRequest['systemInstruction']
): string | undefined {
  if (!systemInstruction) return undefined;

  if (typeof systemInstruction === 'string') {
    return systemInstruction.trim() || undefined;
  }

  const text = systemInstruction.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  return text || undefined;
}

function coerceContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }

  if (value && typeof value === 'object' && 'text' in value) {
    return String((value as { text?: unknown }).text ?? '');
  }

  return '';
}

function legacyContentsToMessages(
  contents: LegacyMessageContent[] | undefined
): Array<{ role: LegacyMessageRole; content: string }> {
  if (!Array.isArray(contents)) {
    return [];
  }

  return contents
    .map((item) => {
      const role: LegacyMessageRole =
        item.role === 'model' ? 'assistant' : item.role === 'system' ? 'system' : 'user';
      return {
        role,
        content: coerceContent(item.parts),
      };
    })
    .filter((message) => message.content.trim().length > 0);
}

function appendSystemInstruction(
  messages: Array<{ role: LegacyMessageRole; content: string }>,
  systemInstruction?: string
): Array<{ role: LegacyMessageRole; content: string }> {
  const instruction = systemInstruction?.trim();

  if (!instruction) {
    return messages;
  }

  const systemIndex = messages.findIndex((message) => message.role === 'system');
  if (systemIndex >= 0) {
    const nextMessages = [...messages];
    nextMessages[systemIndex] = {
      role: 'system',
      content: `${instruction}\n\n${nextMessages[systemIndex].content}`.trim(),
    };
    return nextMessages;
  }

  return [{ role: 'system', content: instruction }, ...messages];
}

export function resolveOpenAIModelId(model?: string, fallback = DEFAULT_TEXT_MODEL): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return fallback.replace(/^openai\//, '');
  }

  if (trimmed.startsWith('openai/')) {
    return trimmed.slice('openai/'.length);
  }

  if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
    return trimmed;
  }

  if (
    trimmed.includes('gemini-2.5-pro') ||
    trimmed.includes('gemini-1.5-pro') ||
    trimmed.includes('gemini-pro')
  ) {
    return 'gpt-4o';
  }

  if (
    trimmed.includes('gemini-2.0-flash') ||
    trimmed.includes('gemini-2.0-flash-lite') ||
    trimmed.includes('gemini-2.5-flash') ||
    trimmed.includes('gemini-1.5-flash') ||
    trimmed.includes('gemini')
  ) {
    return 'gpt-4o-mini';
  }

  return trimmed;
}

export function normalizeTextModel(model = DEFAULT_TEXT_MODEL): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_TEXT_MODEL;
  }

  if (trimmed.includes('/')) {
    if (trimmed.startsWith('openai/')) {
      return trimmed;
    }

    if (trimmed.startsWith('google/')) {
      return `openai/${resolveOpenAIModelId(trimmed, DEFAULT_BOOK_MODEL)}`;
    }

    return trimmed;
  }

  return `openai/${resolveOpenAIModelId(trimmed)}`;
}

function resolveGenerationConfig(request: LegacyTextGenerationRequest): {
  temperature?: number;
  top_p?: number;
  max_completion_tokens?: number;
  stop?: string[];
  response_format?: { type: 'json_object' };
  presence_penalty?: number;
  frequency_penalty?: number;
} {
  const config = request.generationConfig ?? request.config ?? {};
  const responseMimeType = config.responseMimeType?.toLowerCase();

  const resolved: {
    temperature?: number;
    top_p?: number;
    max_completion_tokens?: number;
    stop?: string[];
    response_format?: { type: 'json_object' };
    presence_penalty?: number;
    frequency_penalty?: number;
  } = {};

  if (typeof config.temperature === 'number') {
    resolved.temperature = config.temperature;
  }

  const topP =
    typeof config.topP === 'number'
      ? config.topP
      : typeof config.top_p === 'number'
        ? config.top_p
        : undefined;
  if (typeof topP === 'number') {
    resolved.top_p = topP;
  }

  const maxTokens =
    typeof request.maxTokens === 'number'
      ? request.maxTokens
      : typeof config.maxOutputTokens === 'number'
        ? config.maxOutputTokens
        : undefined;
  if (typeof maxTokens === 'number') {
    resolved.max_completion_tokens = maxTokens;
  }

  if (Array.isArray(config.stopSequences) && config.stopSequences.length > 0) {
    resolved.stop = config.stopSequences.filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    );
  }

  if (responseMimeType === 'application/json') {
    resolved.response_format = { type: 'json_object' };
  }

  if (typeof config.presencePenalty === 'number') {
    resolved.presence_penalty = config.presencePenalty;
  }

  if (typeof config.frequencyPenalty === 'number') {
    resolved.frequency_penalty = config.frequencyPenalty;
  }

  return resolved;
}

function resolveTextMessages(
  request: LegacyTextGenerationRequest
): Array<{ role: LegacyMessageRole; content: string }> {
  const systemInstruction = extractSystemInstruction(request.systemInstruction);

  if (Array.isArray(request.messages) && request.messages.length > 0) {
    const messages = request.messages
      .map((message) => ({
        role: (message.role === 'assistant'
          ? 'assistant'
          : message.role === 'system'
            ? 'system'
            : 'user') as LegacyMessageRole,
        content: coerceContent(message.content),
      }))
      .filter((message) => message.content.trim().length > 0);

    return appendSystemInstruction(messages, systemInstruction);
  }

  const legacyMessages = legacyContentsToMessages(request.contents);
  if (legacyMessages.length > 0) {
    return appendSystemInstruction(legacyMessages, systemInstruction);
  }

  if (typeof request.prompt === 'string' && request.prompt.trim().length > 0) {
    return appendSystemInstruction(
      [{ role: 'user', content: request.prompt.trim() }],
      systemInstruction
    );
  }

  throw new Error('Missing required fields: provide prompt, messages, or contents.');
}

async function callOpenAIChatCompletion(
  request: LegacyTextGenerationRequest
): Promise<LegacyTextGenerationResult> {
  const apiKey = getOpenAIApiKey();
  const modelId = resolveOpenAIModelId(request.model, DEFAULT_BOOK_MODEL);
  const messages = resolveTextMessages(request);
  const generationConfig = resolveGenerationConfig(request);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        ...generationConfig,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${details}`);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const rawText = choice?.message?.content;
    const text =
      typeof rawText === 'string'
        ? rawText
        : Array.isArray(rawText)
          ? rawText.map((part: { text?: string }) => part.text ?? '').join('')
          : '';

    if (!text.trim()) {
      throw new Error('OpenAI returned an empty response.');
    }

    return {
      text,
      raw: payload,
      model: modelId,
    };
  } finally {
    clearTimeout(deadline);
  }
}

export async function generateTextFromRequest(
  request: LegacyTextGenerationRequest
): Promise<LegacyTextGenerationResult> {
  return callOpenAIChatCompletion(request);
}

export async function generateEmbeddingVector(
  text: string,
  options?: { dimensions?: number; model?: string }
): Promise<number[]> {
  const apiKey = getOpenAIApiKey();
  const model = (options?.model || DEFAULT_EMBEDDING_MODEL).trim();
  const dimensions = options?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('OpenAI returned an empty embedding.');
  }

  return embedding;
}

export async function generateEmbeddings(
  texts: string[],
  options?: { dimensions?: number; model?: string }
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = getOpenAIApiKey();
  const model = (options?.model || DEFAULT_EMBEDDING_MODEL).trim();
  const dimensions = options?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const embeddings = Array.isArray(payload?.data)
    ? [...payload.data]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding)
    : [];

  if (embeddings.length === 0) {
    throw new Error('OpenAI returned no embeddings.');
  }

  return embeddings;
}

export async function generateBytezImage(input: {
  model: string;
  prompt: string;
}): Promise<string | null> {
  const apiKey = getBytezApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(BYTEZ_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_BYTEZ_IMAGE_MODEL,
      input: input.prompt,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Bytez request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const raw =
    payload?.imageUrl ?? (Array.isArray(payload?.output) ? payload.output[0] : payload?.output);
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export {
  DEFAULT_TEXT_MODEL,
  DEFAULT_BOOK_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_BYTEZ_IMAGE_MODEL,
  legacyContentsToMessages,
};
