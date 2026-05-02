import { describe, expect, it } from 'vitest';
import { scoreAndrewColoringPage } from './andrewScorer';

describe('Andrew scorer', () => {
  it('gives a perfect score to a page that satisfies every production rule', () => {
    const result = scoreAndrewColoringPage({
      outlineMode: 'simple',
      critique: {
        passed: true,
        flags: {
          printableLineClarity: true,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: true,
        },
        refinements: [],
        retryRecommended: false,
        summary: 'clean',
      },
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('penalizes weak line clarity more than a minor outline mismatch', () => {
    const lineClarityFailure = scoreAndrewColoringPage({
      outlineMode: 'detailed',
      critique: {
        passed: false,
        flags: {
          printableLineClarity: false,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: true,
        },
        refinements: ['Strengthen the bold outer contour lines.'],
        retryRecommended: true,
        summary: 'line clarity is too soft',
      },
    });

    const outlineMismatchOnly = scoreAndrewColoringPage({
      outlineMode: 'simple',
      critique: {
        passed: false,
        flags: {
          printableLineClarity: true,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: false,
        },
        refinements: ['Remove the extra interior detail.'],
        retryRecommended: true,
        summary: 'detail level is too high',
      },
    });

    expect(lineClarityFailure.score).toBeLessThan(outlineMismatchOnly.score);
  });
});
