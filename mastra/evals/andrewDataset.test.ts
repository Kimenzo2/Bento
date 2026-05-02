import { describe, expect, it } from 'vitest';
import { ANDREW_REGRESSION_DATASET } from './andrewDataset';

describe('Andrew regression dataset', () => {
  it('contains curated examples for the three outline modes', () => {
    expect(ANDREW_REGRESSION_DATASET).toHaveLength(3);
    expect(ANDREW_REGRESSION_DATASET.map((item) => item.input.outlineMode)).toEqual([
      'simple',
      'detailed',
      'mandala',
    ]);
  });

  it('stores the request context needed for Mastra Studio experiments', () => {
    for (const item of ANDREW_REGRESSION_DATASET) {
      expect(item.requestContext?.promptVersion).toBe('andrew-v2');
      expect(item.requestContext?.generationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });
});
