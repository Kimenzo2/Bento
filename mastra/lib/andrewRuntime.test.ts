import { describe, expect, it } from 'vitest';
import {
  ANDREW_PROMPT_VERSION,
  ANDREW_REQUEST_CONTEXT_KEYS,
  buildAndrewRuntimeProfile,
  createAndrewRequestContext,
  createAndrewStorage,
} from './andrewRuntime';

describe('Andrew runtime observability', () => {
  it('uses DuckDB in development and ClickHouse in production', () => {
    expect(buildAndrewRuntimeProfile({ environment: 'development' }).observabilityBackend).toBe('duckdb');
    expect(buildAndrewRuntimeProfile({ environment: 'production' }).observabilityBackend).toBe('clickhouse');
    expect(buildAndrewRuntimeProfile({ environment: 'production' }).serviceName).toBe('andrew-life-in-colour');
  });

  it('creates request context with the keys Mastra should trace', () => {
    const requestContext = createAndrewRequestContext({
      userId: '8f5bbf5a-627c-44e8-91b3-1fbf287a2f56',
      generationId: '9fce0e2c-5e7d-4f35-8f73-3d3b2de9fcb2',
      outlineMode: 'detailed',
      promptVersion: ANDREW_PROMPT_VERSION,
    });

    expect(requestContext.get('userId')).toBe('8f5bbf5a-627c-44e8-91b3-1fbf287a2f56');
    expect(requestContext.get('generationId')).toBe('9fce0e2c-5e7d-4f35-8f73-3d3b2de9fcb2');
    expect(requestContext.get('outlineMode')).toBe('detailed');
    expect(requestContext.get('promptVersion')).toBe(ANDREW_PROMPT_VERSION);
    expect([...requestContext.keys()]).toEqual(ANDREW_REQUEST_CONTEXT_KEYS);
  });

  it('fails fast when production ClickHouse config is missing', () => {
    expect(() => createAndrewStorage({ environment: 'production', clickhouseUrl: '' })).toThrow(
      'CLICKHOUSE_URL is required when Andrew observability runs in production.'
    );
  });
});
