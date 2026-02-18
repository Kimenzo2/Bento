import { GoogleGenAI } from '@google/genai';
import type { BookProject } from '../types';
import { callAIService } from './infrastructure/externalServiceWrapper';

// Helper to safely get env vars in both Vite and Node environments
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

// Gemini API keys for text generation (shared pool with geminiService)
const geminiApiKeys = [
  getEnv('VITE_GEMINI_API_KEY_1'),
  getEnv('VITE_GEMINI_API_KEY_2'),
  getEnv('VITE_GEMINI_API_KEY_3'),
  getEnv('VITE_GEMINI_API_KEY_4'),
  getEnv('VITE_GEMINI_API_KEY_5'),
  getEnv('VITE_GEMINI_API_KEY_6'),
  getEnv('VITE_GEMINI_API_KEY_7'),
  getEnv('VITE_GEMINI_API_KEY_8'),
  getEnv('VITE_GEMINI_API_KEY_9'),
  getEnv('VITE_GEMINI_API_KEY_10'),
  getEnv('VITE_GEMINI_API_KEY_11'),
].filter((key) => key && key.length > 0);

const TEXT_MODEL = 'gemini-2.0-flash';

let currentKeyIndex = 0;

// Validate API keys at module load
if (geminiApiKeys.length === 0) {
  if (import.meta.env.DEV) {
    console.warn('⚠️ No Gemini API keys found. AI features will not work.');
  }
} else {
  console.log(`✅ Grok service: Using Gemini API with ${geminiApiKeys.length} key(s)`);
}

function getNextKey(): string {
  if (geminiApiKeys.length === 0) throw new Error('No Gemini API keys available');
  const key = geminiApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % geminiApiKeys.length;
  return key;
}

/**
 * Check if the Gemini API is available (replaces old Grok/Bytez check)
 */
export const isGrokAvailable = (): boolean => {
  return geminiApiKeys.length > 0;
};

export interface GrokMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Helper function to make API calls using Google Gemini API (gemini-2.0-flash)
 * ENFORCED: All calls go through circuit breaker for resilience
 */
export async function callAPI(messages: GrokMessage[]): Promise<string> {
  const result = await callAIService('gemini', 'callAPI', async () => {
    const maxRetries = geminiApiKeys.length;
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const client = new GoogleGenAI({ apiKey: getNextKey() });

        // Build the prompt from messages
        const systemMessage = messages.find((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');

        // Build contents for Gemini
        const contents = conversationMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        // Prepend system instruction to first user message if present
        if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
          contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
        }

        const response = await client.models.generateContent({
          model: TEXT_MODEL,
          contents,
          config: {
            maxOutputTokens: 8192,
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
          },
        });

        const text = response.text;
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response received from Gemini API');
        }

        if (import.meta.env.DEV) console.log('✅ Gemini API response received (grokService)');
        return text.trim();
      } catch (error: any) {
        lastError = error;
        const status = error?.status || error?.httpStatusCode || error?.code;
        if (status && ![429, 403, 500, 502, 503].includes(status)) {
          throw error; // Don't retry on non-retriable errors
        }
        console.warn(`⚠️ Gemini key #${currentKeyIndex} failed in grokService, trying next...`);
      }
    }

    throw lastError || new Error('All Gemini API keys exhausted in grokService');
  });

  if (result.success) {
    return result.data;
  }

  throw result.error;
}

/**
 * Feature #1: AI Story Improvement
 * Improves text based on tone and audience
 */
export async function improveText(
  text: string,
  tone: string,
  targetAudience: string
): Promise<string> {
  if (geminiApiKeys.length === 0) {
    throw new Error(
      'Gemini API keys are not configured. Please add VITE_GEMINI_API_KEY_* to your environment.'
    );
  }

  try {
    const messages: GrokMessage[] = [
      {
        role: 'system',
        content: `You are a professional children's book editor. Your task is to improve story text while preserving its core meaning and charm.`,
      },
      {
        role: 'user',
        content: `Please improve this text for a ${targetAudience} audience with a ${tone} tone. Keep the same approximate length but make it more engaging and polished.

Original Text:
"${text}"

Return ONLY the improved text, no explanations.`,
      },
    ];

    return await callAPI(messages);
  } catch (error) {
    console.error('Failed to improve text:', error);
    throw error;
  }
}

/**
 * Feature #2: Character Consistency Checker
 * Analyzes the entire book for character inconsistencies
 */
export async function checkCharacterConsistency(project: BookProject): Promise<{
  characters: Array<{
    name: string;
    inconsistencies: string[];
    suggestions: string[];
  }>;
  overallScore: number;
}> {
  if (geminiApiKeys.length === 0) {
    throw new Error(
      'Gemini API keys are not configured. Please add VITE_GEMINI_API_KEY_* to your environment.'
    );
  }

  try {
    // Collect all text from the book
    const allPages = project.chapters.flatMap((ch) => ch.pages);
    const bookText = allPages.map((p, i) => `Page ${p.pageNumber}: ${p.text}`).join('\n\n');

    // Get character names
    const characterNames =
      project.characters?.map((c) => c.name).join(', ') || 'Unknown characters';

    const messages: GrokMessage[] = [
      {
        role: 'system',
        content: `You are a story consistency analyst. Analyze the book for character consistency issues. Always respond with valid JSON only.`,
      },
      {
        role: 'user',
        content: `Analyze this children's book for character consistency issues.

Characters: ${characterNames}

Full Book Text:
${bookText}

Return a JSON object in this EXACT format (no markdown, no code blocks):
{
  "characters": [
    {
      "name": "Character Name",
      "inconsistencies": ["List any inconsistencies found"],
      "suggestions": ["List suggestions to fix them"]
    }
  ],
  "overallScore": 85
}

The overallScore should be 0-100 (100 = perfectly consistent).`,
      },
    ];

    const content = await callAPI(messages);

    // Parse JSON response (remove markdown code blocks if present)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to check character consistency:', error);
    throw error;
  }
}

/**
 * Feature #3: Real-Time Writing Suggestions
 * Provides inline suggestions as users type
 */
export async function getWritingSuggestions(
  text: string,
  context: string
): Promise<
  Array<{
    type: 'grammar' | 'style' | 'word-choice';
    original: string;
    suggestion: string;
    reason: string;
  }>
> {
  // Return empty array if API is not available (graceful degradation)
  if (geminiApiKeys.length === 0) {
    console.warn('Gemini API keys not configured - writing suggestions disabled');
    return [];
  }

  try {
    if (!text || text.length < 10) {
      return []; // Don't suggest for very short text
    }

    const messages: GrokMessage[] = [
      {
        role: 'system',
        content: `You are a writing assistant for children's book authors. Provide helpful, actionable suggestions. Always respond with valid JSON only.`,
      },
      {
        role: 'user',
        content: `Analyze this text and provide up to 3 suggestions for improvement.

Context: ${context}

Text:
"${text}"

Return a JSON array in this EXACT format (no markdown, no code blocks):
[
  {
    "type": "grammar",
    "original": "the exact phrase to improve",
    "suggestion": "improved version",
    "reason": "why this is better"
  }
]

Types can be: "grammar", "style", or "word-choice". Return ONLY the JSON array.`,
      },
    ];

    const content = await callAPI(messages);

    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return []; // No suggestions
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.slice(0, 3); // Max 3 suggestions
  } catch (error) {
    console.error('Failed to get writing suggestions:', error);
    return []; // Return empty array on error (non-critical feature)
  }
}
