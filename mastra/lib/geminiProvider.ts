/**
 * Single-key Gemini provider for Mastra agents.
 * No rotation — preserves free-tier quota from being banned.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

/**
 * Returns a Gemini LanguageModel instance using the configured API key.
 *
 * @param modelId  Gemini model identifier, defaults to 'gemini-2.0-flash'
 */
export function getGeminiModel(modelId = 'gemini-2.0-flash') {
  if (!API_KEY) {
    throw new Error(
      'No Gemini API key configured for Mastra agents. Set GOOGLE_GENERATIVE_AI_API_KEY.'
    );
  }
  const provider = createGoogleGenerativeAI({ apiKey: API_KEY });
  return provider(modelId);
}
