import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { AndrewOutlineModeSchema, LifeInColourCritiqueSchema } from '../schemas';

export const ANDREW_COLORING_PAGE_SCORE_WEIGHTS = {
  printableLineClarity: 35,
  subjectRecognizable: 25,
  cleanNegativeSpace: 15,
  familySafe: 15,
  outlineModeCompatible: 10,
  retryRecommended: 3,
  refinements: 2,
} as const;

const AndrewColoringPageScorerInputSchema = z.object({
  outlineMode: AndrewOutlineModeSchema,
  critique: LifeInColourCritiqueSchema,
});

const AndrewColoringPageScorerOutputSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  breakdown: z.record(z.string(), z.number()),
  reasons: z.array(z.string()),
});

export interface AndrewColoringPageScoreInput {
  outlineMode: z.infer<typeof AndrewOutlineModeSchema>;
  critique: z.infer<typeof LifeInColourCritiqueSchema>;
}

export interface AndrewColoringPageScoreResult {
  score: number;
  passed: boolean;
  breakdown: Record<string, number>;
  reasons: string[];
}

function capScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreAndrewColoringPage(
  input: AndrewColoringPageScoreInput
): AndrewColoringPageScoreResult {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];
  let score = 100;

  const flagWeights = [
    ['printableLineClarity', ANDREW_COLORING_PAGE_SCORE_WEIGHTS.printableLineClarity],
    ['subjectRecognizable', ANDREW_COLORING_PAGE_SCORE_WEIGHTS.subjectRecognizable],
    ['cleanNegativeSpace', ANDREW_COLORING_PAGE_SCORE_WEIGHTS.cleanNegativeSpace],
    ['familySafe', ANDREW_COLORING_PAGE_SCORE_WEIGHTS.familySafe],
    ['outlineModeCompatible', ANDREW_COLORING_PAGE_SCORE_WEIGHTS.outlineModeCompatible],
  ] as const;

  for (const [flag, weight] of flagWeights) {
    if (input.critique.flags[flag]) {
      breakdown[flag] = weight;
      continue;
    }

    score -= weight;
    breakdown[flag] = -weight;
    reasons.push(`${flag} is not strong enough.`);
  }

  if (input.critique.retryRecommended) {
    score -= ANDREW_COLORING_PAGE_SCORE_WEIGHTS.retryRecommended;
    breakdown.retryRecommended = -ANDREW_COLORING_PAGE_SCORE_WEIGHTS.retryRecommended;
    reasons.push('The page still needs one more correction pass.');
  } else {
    breakdown.retryRecommended = 0;
  }

  const refinementPenalty = Math.min(
    input.critique.refinements.length * ANDREW_COLORING_PAGE_SCORE_WEIGHTS.refinements,
    10
  );
  if (refinementPenalty > 0) {
    score -= refinementPenalty;
    breakdown.refinements = -refinementPenalty;
    reasons.push(
      `The critique still has ${input.critique.refinements.length} concrete refinements.`
    );
  } else {
    breakdown.refinements = 0;
  }

  const passed = input.critique.passed && score >= 85;

  if (passed) {
    reasons.unshift("The coloring page clears Andrew's production bar.");
  } else if (!input.critique.passed) {
    reasons.unshift('The critique did not pass.');
  }

  return {
    score: capScore(score),
    passed,
    breakdown,
    reasons,
  };
}

export const andrewColoringPageScorer = createScorer({
  id: 'andrew-coloring-page',
  name: 'Andrew Coloring Page',
  description:
    'Scores Andrew Life in Colour outputs for printability, fidelity, and outline-mode fit.',
  type: {
    input: AndrewColoringPageScorerInputSchema,
    output: AndrewColoringPageScorerOutputSchema,
  },
})
  .generateScore(({ run }) => {
    if (!run.input) {
      throw new Error('Andrew coloring page scorer requires an input payload.');
    }
    return scoreAndrewColoringPage(run.input).score;
  })
  .generateReason(({ run, score }) => {
    if (!run.input) {
      throw new Error('Andrew coloring page scorer requires an input payload.');
    }

    const result = scoreAndrewColoringPage(run.input);
    return [
      `score=${score}`,
      `passed=${result.passed}`,
      `outlineMode=${run.input.outlineMode}`,
      ...result.reasons.map((reason) => `reason=${reason}`),
    ].join('\n');
  });
