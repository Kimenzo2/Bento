/**
 * Gemini model helpers for Mastra agents.
 *
 * Mastra v1.10+ uses model-router strings (e.g. 'google/gemini-2.0-flash')
 * instead of raw LanguageModel objects.  The GOOGLE_GENERATIVE_AI_API_KEY
 * env var is still required — Mastra reads it automatically via the
 * @ai-sdk/google provider when the 'google/' prefix is used.
 */

/**
 * Returns the model-router string for a Gemini model.
 *
 * @param modelId  Short Gemini model name, defaults to 'gemini-2.0-flash'
 * @returns        Model-router string like 'google/gemini-2.0-flash'
 */
export function getGeminiModel(modelId = 'gemini-2.0-flash'): string {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn(
      '[Mastra] GOOGLE_GENERATIVE_AI_API_KEY is not set. ' +
        'Agent calls will fail until it is configured.'
    );
  }
  return `google/${modelId}`;
}

/**
 * Returns the model-router string for a Gemini embedding model.
 *
 * @param modelId  Short embedding model name, defaults to 'text-embedding-004'
 * @returns        Model-router string like 'google/gemini-embedding-001'
 */
export function getGeminiEmbeddingModel(modelId = 'gemini-embedding-001'): string {
  return `google/${modelId}`;
}
