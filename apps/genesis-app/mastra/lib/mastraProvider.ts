/**
 * Mastra model helpers for Genesis.
 *
 * These helpers return model-router strings so the agents stay on Mastra
 * without any provider-specific SDK imports.
 */

/**
 * Returns the model-router string for the active text model.
 *
 * @param modelId  Short model name, defaults to 'gpt-4o-mini'
 * @returns        Model-router string like 'openai/gpt-4o-mini'
 */
export function getMastraModel(modelId = 'gpt-4o-mini'): string {
  return `openai/${modelId}`;
}

/**
 * Returns the model-router string for the active embedding model.
 *
 * @param modelId  Short embedding model name, defaults to 'text-embedding-3-small'
 * @returns        Model-router string like 'openai/text-embedding-3-small'
 */
export function getMastraEmbeddingModel(modelId = 'text-embedding-3-small'): string {
  return `openai/${modelId}`;
}
