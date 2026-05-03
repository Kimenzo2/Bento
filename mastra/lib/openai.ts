import { AndrewPromptVersionSchema, LifeInColourSourceAnalysisSchema } from '../schemas';
import type { LifeInColourSourceAnalysis } from '../schemas';

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
  /\/+$/,
  ''
);

const DEFAULT_TEXT_MODEL = 'gpt-5-nano';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

interface ChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface ResponseApiPayload {
  model?: string;
  output?: Array<{
    type?: string;
    result?: string;
  }>;
}

export interface OpenAITextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface OpenAIImageInput {
  url: string;
  detail?: 'low' | 'auto' | 'high';
}

export interface GeneratedAndrewImage {
  base64: string;
  model: string;
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY_1?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  return apiKey;
}

export async function generateStructuredText(input: {
  model?: string;
  system: string;
  user: string;
  images?: OpenAIImageInput[];
}): Promise<string> {
  const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: input.user }];
  for (const image of input.images || []) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: image.url,
        detail: image.detail || 'auto',
      },
    });
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_TEXT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.system },
        {
          role: 'user',
          content: userContent.length === 1 ? input.user : userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI text request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('OpenAI returned an empty structured response.');
  }

  return text;
}

export async function analyzeSourceImage(input: {
  title: string;
  brief: string;
  outlineMode: 'simple' | 'detailed' | 'mandala';
  sourceDataUrl: string;
  sourceMimeType: string;
  sourceFileName: string;
}): Promise<LifeInColourSourceAnalysis> {
  const raw = await generateStructuredText({
    model: DEFAULT_TEXT_MODEL,
    system:
      "You are Andrew, Genesis's expert source-image analyst for premium printable coloring pages. Return JSON only.",
    user: [
      'Inspect the uploaded image and summarize only the details that matter for a premium black-and-white coloring page.',
      'Focus on silhouettes, dominant shapes, negative space, readability, and any clutter or tiny details that should be simplified.',
      'Return JSON with keys:',
      '{',
      '  "promptVersion": "andrew-v2",',
      '  "subjectSummary": "string",',
      '  "sceneSummary": "string",',
      '  "compositionSummary": "string",',
      '  "usefulDetails": ["string"],',
      '  "cautionFlags": ["string"],',
      '  "recommendedOutlineMode": "simple | detailed | mandala",',
      '  "recommendedDetailLevel": "low | auto | high",',
      '  "lineArtNotes": ["string"]',
      '}',
      `Title: ${input.title.trim()}`,
      `Brief: ${input.brief.trim()}`,
      `Selected outline mode: ${input.outlineMode}`,
      `Source file name: ${input.sourceFileName}`,
      `Source mime type: ${input.sourceMimeType}`,
      'Do not describe color. Do not describe photographic lighting except when it affects line art clarity.',
    ].join('\n'),
    images: [{ url: input.sourceDataUrl, detail: 'high' }],
  });

  const parsed = LifeInColourSourceAnalysisSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return parsed.data;
}

export async function generateImageFromReference(input: {
  prompt: string;
  sourceDataUrl: string;
  detail: 'low' | 'auto' | 'high';
  model?: string;
}): Promise<GeneratedAndrewImage> {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_IMAGE_MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: input.prompt },
            {
              type: 'input_image',
              image_url: input.sourceDataUrl,
              detail: input.detail,
            },
          ],
        },
      ],
      tools: [{ type: 'image_generation' }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI image request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as ResponseApiPayload;
  const imageBase64 = Array.isArray(payload.output)
    ? payload.output.find((item: { type?: string }) => item.type === 'image_generation_call')
        ?.result
    : undefined;

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    throw new Error('OpenAI did not return image data.');
  }

  return {
    base64: imageBase64,
    model: payload?.model || input.model || DEFAULT_IMAGE_MODEL,
  };
}

export async function critiqueGeneratedImage(input: {
  sourceDataUrl: string;
  generatedDataUrl: string;
  criteria: string[];
}): Promise<string> {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_TEXT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "You are Andrew's strict quality reviewer for printable black-and-white coloring pages. Return JSON only.",
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Compare the source photo and the generated coloring page.',
                'Judge the output against these criteria:',
                ...input.criteria.map((criterion) => `- ${criterion}`),
                'Return JSON with: passed, summary, flags, refinements, retryRecommended.',
                'The flags object must include printableLineClarity, subjectRecognizable, cleanNegativeSpace, familySafe, and outlineModeCompatible.',
                'Be strict. If the page is close but still would benefit from a clean correction pass, set retryRecommended to true and include concrete refinements.',
              ].join('\n'),
            },
            { type: 'image_url', image_url: { url: input.sourceDataUrl } },
            { type: 'image_url', image_url: { url: input.generatedDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI critique request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('OpenAI returned an empty critique response.');
  }

  return text;
}
