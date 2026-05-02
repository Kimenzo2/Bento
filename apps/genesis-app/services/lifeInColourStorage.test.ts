import { describe, expect, it } from 'vitest';
import { sanitizeLifeInColourFileName } from './lifeInColourStorage';

describe('sanitizeLifeInColourFileName', () => {
  it('normalizes mixed-case names into storage-safe paths', () => {
    expect(sanitizeLifeInColourFileName(' My Summer Photo (1).PNG ')).toBe('my-summer-photo-1.png');
  });

  it('falls back when the name has no safe characters', () => {
    expect(sanitizeLifeInColourFileName('***')).toBe('life-in-colour-source.png');
  });
});
