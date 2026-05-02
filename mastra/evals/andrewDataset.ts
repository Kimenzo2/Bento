import { randomUUID } from 'node:crypto';
import { ANDREW_PROMPT_VERSION } from '../lib/andrewRuntime';
import type { AndrewColoringPageScoreInput } from './andrewScorer';

export interface AndrewRegressionDatasetItem {
  input: AndrewColoringPageScoreInput;
  groundTruth: {
    minimumScore: number;
    qualityBar: 'ship' | 'repair' | 'reject';
  };
  requestContext: {
    userId: string;
    generationId: string;
    outlineMode: AndrewColoringPageScoreInput['outlineMode'];
    promptVersion: typeof ANDREW_PROMPT_VERSION;
  };
  metadata: {
    scenario: string;
    sourceFileName: string;
  };
}

function createRequestContext(
  outlineMode: AndrewColoringPageScoreInput['outlineMode'],
  generationId: string
): AndrewRegressionDatasetItem['requestContext'] {
  return {
    userId: '8f5bbf5a-627c-44e8-91b3-1fbf287a2f56',
    generationId,
    outlineMode,
    promptVersion: ANDREW_PROMPT_VERSION,
  };
}

export const ANDREW_REGRESSION_DATASET: AndrewRegressionDatasetItem[] = [
  {
    input: {
      outlineMode: 'simple',
      critique: {
        passed: true,
        summary: 'Wide open regions and crisp contour lines.',
        flags: {
          printableLineClarity: true,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: true,
        },
        refinements: [],
        retryRecommended: false,
      },
    },
    groundTruth: {
      minimumScore: 95,
      qualityBar: 'ship',
    },
    requestContext: createRequestContext('simple', '47e4c242-4d60-45a1-8a94-8b1b18a8bfa8'),
    metadata: {
      scenario: 'simple open-shape page',
      sourceFileName: 'golden-retriever-bike.jpg',
    },
  },
  {
    input: {
      outlineMode: 'detailed',
      critique: {
        passed: false,
        summary: 'The subject is readable but the interior texture is still too busy.',
        flags: {
          printableLineClarity: true,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: false,
        },
        refinements: ['Reduce the interior micro-texture and simplify the background shape language.'],
        retryRecommended: true,
      },
    },
    groundTruth: {
      minimumScore: 80,
      qualityBar: 'repair',
    },
    requestContext: createRequestContext('detailed', 'aa2a41fb-5c9b-4e2d-9f99-3f1e6225c5d7'),
    metadata: {
      scenario: 'detailed page that needs one repair',
      sourceFileName: 'reading-desk-still-life.jpg',
    },
  },
  {
    input: {
      outlineMode: 'mandala',
      critique: {
        passed: false,
        summary: 'The page is family-safe and readable, but the symmetry still needs tightening.',
        flags: {
          printableLineClarity: false,
          subjectRecognizable: true,
          cleanNegativeSpace: true,
          familySafe: true,
          outlineModeCompatible: true,
        },
        refinements: ['Strengthen the radial symmetry and the outer ring separation.'],
        retryRecommended: true,
      },
    },
    groundTruth: {
      minimumScore: 70,
      qualityBar: 'repair',
    },
    requestContext: createRequestContext('mandala', randomUUID()),
    metadata: {
      scenario: 'mandala symmetry regression',
      sourceFileName: 'lotus-circle-reference.jpg',
    },
  },
];
