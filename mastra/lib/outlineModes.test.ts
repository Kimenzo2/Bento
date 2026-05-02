import { describe, expect, it } from 'vitest';
import { getAndrewOutlineModeConfig } from './outlineModes';

describe('Andrew outline modes', () => {
  it('maps simple mode to low image detail', () => {
    expect(getAndrewOutlineModeConfig('simple').detailLevel).toBe('low');
  });

  it('keeps mandala mode on a high-detail pass', () => {
    expect(getAndrewOutlineModeConfig('mandala').detailLevel).toBe('high');
  });
});
