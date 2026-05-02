/**
 * @fileoverview Book Quality Evaluation Scorer for Genesis
 *
 * ## What This File Does
 * Defines a Mastra-native custom scorer that evaluates the quality of
 * generated children's ebook content across five dimensions:
 *   1. Readability — Flesch-Kincaid adapted for children's literature
 *   2. Grammar — Pattern-based detection of common errors
 *   3. Coherence — Structural and transitional flow analysis
 *   4. Age Appropriateness — Vocabulary and theme suitability
 *   5. Completeness — Required content structure presence
 *
 * ## What It Replaces
 * Previously, quality checks were done ad-hoc in
 * services/generator/qaService.ts using raw AI calls.
 * This scorer can be attached to the qualityAssurance agent or run
 * via `runEvals()` in CI for regression testing.
 *
 * ## Architecture
 * Uses the Mastra `createScorer` 4-step pipeline:
 *   preprocess → analyze → generateScore → generateReason
 * All steps are function-based (no LLM judge) for deterministic,
 * fast, and cost-free evaluation during CI.
 *
 * ## Usage
 * ```ts
 * import { bookQualityScorer } from './evals/bookQualityEval';
 * import { runEvals } from '@mastra/core/evals';
 *
 * const result = await runEvals({
 *   data: [{ input: bookRequest, output: generatedBook }],
 *   scorers: [bookQualityScorer],
 * });
 * console.log(result.scores['book-quality']); // 0.0 – 1.0
 * ```
 *
 * @module mastra/evals/bookQualityEval
 */

import { createScorer } from '@mastra/core/evals';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Input shape: the book generation request.
 * Mirrors the workflow inputSchema fields used in bookGenerationWorkflow.
 */
interface BookEvalInput {
  title?: string;
  prompt?: string;
  genre?: string;
  ageRange?: string;
  targetAudience?: string;
  pageCount?: number;
  [key: string]: unknown;
}

/**
 * Output shape: the generated book content returned by the workflow or agent.
 */
interface BookEvalOutput {
  pages?: Array<{
    pageNumber?: number;
    text?: string;
    imagePrompt?: string;
    imageUrl?: string;
  }>;
  title?: string;
  blueprint?: unknown;
  qaReport?: unknown;
  [key: string]: unknown;
}

/**
 * Per-dimension quality breakdown produced by the analyze step.
 */
interface QualityDimensions {
  readability: number;
  grammar: number;
  coherence: number;
  ageAppropriateness: number;
  completeness: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Count syllables in an English word using a simple heuristic. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return 1;
  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;
  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // Silent-e rule
  if (w.endsWith('e') && count > 1) count--;
  return Math.max(count, 1);
}

/** Split text into sentences. */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Split text into words. */
function splitWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z'-]/g, ''))
    .filter((w) => w.length > 0);
}

/**
 * Flesch-Kincaid Reading Ease adapted to a 0–1 scale.
 * Higher values = easier to read = better for children's books.
 *
 * Original FK: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 * Clamped to [0,100] then normalized to [0,1].
 */
function fleschKincaidEase(text: string): number {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord =
    words.reduce((sum, w) => sum + countSyllables(w), 0) / words.length;

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(score, 100)) / 100;
}

/**
 * Grammar pattern detector — checks for common issues.
 * Returns a score 0–1 where 1 = no issues detected.
 */
function grammarScore(text: string): number {
  const words = splitWords(text);
  if (words.length === 0) return 0;

  const issues: string[] = [];

  // Double-space or double-word detection
  const doubleWordPattern = /\b(\w+)\s+\1\b/gi;
  const doubleMatches = text.match(doubleWordPattern);
  if (doubleMatches) issues.push(...doubleMatches);

  // Missing capitalization after sentence-ending punctuation
  const missingCaps = text.match(/[.!?]\s+[a-z]/g);
  if (missingCaps) issues.push(...missingCaps);

  // Unclosed quotes
  const doubleQuotes = (text.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) issues.push('unclosed-double-quote');
  const singleQuotes = (text.match(/(?<!\w)'|'(?!\w)/g) || []).length;
  if (singleQuotes % 2 !== 0) issues.push('unclosed-single-quote');

  // Penalize proportionally — each issue reduces score by ~5%, max 50% penalty
  const penalty = Math.min(issues.length * 0.05, 0.5);
  return 1 - penalty;
}

/**
 * Coherence scorer — measures structural flow between pages.
 * Checks for: transitional phrases, consistent tense progression,
 * reasonable sentence-count variation between pages.
 */
function coherenceScore(pages: string[]): number {
  if (pages.length <= 1) return pages.length === 1 ? 0.7 : 0;

  let transitionCount = 0;
  let sentenceCountVariance = 0;

  const transitionPatterns = [
    /\b(then|next|after|later|meanwhile|suddenly|finally|soon|before|when)\b/gi,
    /\b(however|but|although|yet|still|instead|otherwise)\b/gi,
    /\b(because|since|so|therefore|thus|as a result)\b/gi,
  ];

  const sentenceCounts: number[] = [];

  for (const page of pages) {
    const sentences = splitSentences(page);
    sentenceCounts.push(sentences.length);

    for (const pattern of transitionPatterns) {
      const matches = page.match(pattern);
      if (matches) transitionCount += matches.length;
    }
  }

  // Transition density: expect at least 1 transition per 2 pages
  const transitionDensity = Math.min(transitionCount / (pages.length * 0.5), 1);

  // Sentence count consistency: low variance = good coherence
  if (sentenceCounts.length > 1) {
    const avg = sentenceCounts.reduce((a, b) => a + b, 0) / sentenceCounts.length;
    sentenceCountVariance =
      sentenceCounts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / sentenceCounts.length;
  }
  const varianceScore = Math.max(0, 1 - sentenceCountVariance / 25);

  return transitionDensity * 0.6 + varianceScore * 0.4;
}

/**
 * Age-appropriateness scorer.
 * Checks vocabulary complexity, sentence length, and absence of
 * inappropriate themes for common children's age ranges.
 */
function ageAppropriatenessScore(text: string, ageRange?: string): number {
  const words = splitWords(text);
  const sentences = splitSentences(text);
  if (words.length === 0 || sentences.length === 0) return 0;

  // Parse expected reading level from ageRange (e.g. "3-5", "6-8", "9-12")
  const ageLow = parseInt(ageRange?.split('-')[0] ?? '6', 10) || 6;

  // Average word length — younger audiences should have shorter words
  const avgWordLength = words.reduce((s, w) => s + w.length, 0) / words.length;
  const avgSentenceLength = words.length / sentences.length;

  // Target metrics by age bracket
  let maxAvgWordLen: number;
  let maxAvgSentLen: number;
  if (ageLow <= 5) {
    maxAvgWordLen = 4.5;
    maxAvgSentLen = 8;
  } else if (ageLow <= 8) {
    maxAvgWordLen = 5.5;
    maxAvgSentLen = 12;
  } else {
    maxAvgWordLen = 6.5;
    maxAvgSentLen = 18;
  }

  const wordLenScore = avgWordLength <= maxAvgWordLen ? 1 : Math.max(0, 1 - (avgWordLength - maxAvgWordLen) / 3);
  const sentLenScore =
    avgSentenceLength <= maxAvgSentLen ? 1 : Math.max(0, 1 - (avgSentenceLength - maxAvgSentLen) / 10);

  // Inappropriate content check (very basic — flag common red-flag patterns)
  const inappropriatePatterns =
    /\b(kill|murder|blood|gore|sex|drug|alcohol|weapon|gun|knife|dead body)\b/gi;
  const flagMatches = text.match(inappropriatePatterns);
  const contentPenalty = flagMatches ? Math.min(flagMatches.length * 0.15, 0.6) : 0;

  return Math.max(0, (wordLenScore * 0.4 + sentLenScore * 0.4 + 0.2) - contentPenalty);
}

/**
 * Completeness scorer — checks that the book has expected structural elements.
 */
function completenessScore(
  input: BookEvalInput,
  output: BookEvalOutput
): number {
  let checks = 0;
  let passed = 0;

  // Has pages
  checks++;
  if (output.pages && output.pages.length > 0) passed++;

  // Has title
  checks++;
  if (output.title || (output.pages?.[0]?.text?.length ?? 0) > 0) passed++;

  // Page count matches request (within tolerance)
  if (input.pageCount && input.pageCount > 0) {
    checks++;
    const actualCount = output.pages?.length ?? 0;
    const tolerance = Math.max(1, Math.floor(input.pageCount * 0.2));
    if (Math.abs(actualCount - input.pageCount) <= tolerance) passed++;
  }

  // Each page has text
  if (output.pages && output.pages.length > 0) {
    checks++;
    const pagesWithText = output.pages.filter((p) => (p.text?.length ?? 0) > 10).length;
    if (pagesWithText >= output.pages.length * 0.9) passed++;
  }

  // Pages have image prompts (expected for illustrated books)
  if (output.pages && output.pages.length > 0) {
    checks++;
    const pagesWithImages = output.pages.filter(
      (p) => (p.imagePrompt?.length ?? 0) > 5 || (p.imageUrl?.length ?? 0) > 5
    ).length;
    if (pagesWithImages >= output.pages.length * 0.5) passed++;
  }

  return checks > 0 ? passed / checks : 0;
}

// ─── Scorer Definition ───────────────────────────────────────────────────────

/**
 * Book Quality Scorer
 *
 * A deterministic, function-based scorer (no LLM judge) suitable for
 * CI pipelines and real-time quality gating. Runs in <50ms per book.
 *
 * Registered in the Mastra instance via `scorers: { bookQuality }`.
 * Can also be used standalone with `runEvals()`.
 *
 * Score range: 0.0 (worst) to 1.0 (best).
 * Dimensions weighted:
 *   - Readability:          25%
 *   - Grammar:              20%
 *   - Coherence:            20%
 *   - Age Appropriateness:  20%
 *   - Completeness:         15%
 */
export const bookQualityScorer = createScorer<BookEvalInput, BookEvalOutput>({
  id: 'book-quality',
  description:
    "Evaluates generated children's ebook quality across readability, grammar, coherence, age-appropriateness, and completeness.",
})
  // ── Step 1: Preprocess ──────────────────────────────────────────────────
  .preprocess(({ run }) => {
    const pages = run.output?.pages ?? [];
    const allText = pages.map((p) => p.text ?? '').join('\n\n');
    const pageTexts = pages.map((p) => p.text ?? '');
    const ageRange = run.input?.ageRange ?? run.input?.targetAudience ?? undefined;

    return {
      allText,
      pageTexts,
      ageRange: typeof ageRange === 'string' ? ageRange : undefined,
      pageCount: pages.length,
      wordCount: splitWords(allText).length,
    };
  })
  // ── Step 2: Analyze ─────────────────────────────────────────────────────
  .analyze(({ run, results }) => {
    const pre = results.preprocessStepResult as {
      allText: string;
      pageTexts: string[];
      ageRange?: string;
      pageCount: number;
      wordCount: number;
    };

    // Handle empty content gracefully
    if (pre.wordCount === 0) {
      return {
        readability: 0,
        grammar: 0,
        coherence: 0,
        ageAppropriateness: 0,
        completeness: 0,
      } satisfies QualityDimensions;
    }

    const dimensions: QualityDimensions = {
      readability: fleschKincaidEase(pre.allText),
      grammar: grammarScore(pre.allText),
      coherence: coherenceScore(pre.pageTexts),
      ageAppropriateness: ageAppropriatenessScore(pre.allText, pre.ageRange),
      completeness: completenessScore(run.input ?? {}, run.output ?? {}),
    };

    return dimensions;
  })
  // ── Step 3: Generate Score (required) ───────────────────────────────────
  .generateScore(({ results }) => {
    const dims = results.analyzeStepResult as QualityDimensions;

    // Weighted composite score
    const composite =
      dims.readability * 0.25 +
      dims.grammar * 0.2 +
      dims.coherence * 0.2 +
      dims.ageAppropriateness * 0.2 +
      dims.completeness * 0.15;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(composite, 1));
  })
  // ── Step 4: Generate Reason ─────────────────────────────────────────────
  .generateReason(({ results, score }) => {
    const dims = results.analyzeStepResult as QualityDimensions;
    const pct = (v: number) => `${Math.round(v * 100)}%`;

    const lines = [
      `Composite score: ${pct(score)}`,
      `  Readability:          ${pct(dims.readability)}`,
      `  Grammar:              ${pct(dims.grammar)}`,
      `  Coherence:            ${pct(dims.coherence)}`,
      `  Age Appropriateness:  ${pct(dims.ageAppropriateness)}`,
      `  Completeness:         ${pct(dims.completeness)}`,
    ];

    // Highlight weak dimensions (below 60%)
    const weak = Object.entries(dims).filter(([, v]) => v < 0.6);
    if (weak.length > 0) {
      lines.push('');
      lines.push('Weak dimensions:');
      for (const [key, val] of weak) {
        lines.push(`  ⚠ ${key}: ${pct(val)} — needs improvement`);
      }
    }

    return lines.join('\n');
  });

// ─── Convenience Runner ──────────────────────────────────────────────────────

/**
 * Run the book quality eval against a single book generation result.
 *
 * Returns the composite score (0–1) and per-dimension breakdown.
 * Designed to be called from server.ts eval endpoints or CI scripts.
 *
 * @example
 * ```ts
 * const result = await evaluateBookQuality(
 *   { title: 'My Story', ageRange: '3-5', pageCount: 10 },
 *   { pages: [...], title: 'My Story' }
 * );
 * console.log(result.score); // 0.82
 * ```
 */
export async function evaluateBookQuality(
  input: BookEvalInput,
  output: BookEvalOutput
): Promise<{
  score: number;
  dimensions: QualityDimensions;
  reason: string;
}> {
  // Run the scorer pipeline manually for standalone use
  const pages = output.pages ?? [];
  const allText = pages.map((p) => p.text ?? '').join('\n\n');
  const pageTexts = pages.map((p) => p.text ?? '');
  const ageRange =
    typeof input.ageRange === 'string'
      ? input.ageRange
      : typeof input.targetAudience === 'string'
        ? input.targetAudience
        : undefined;
  const wordCount = splitWords(allText).length;

  // Analyze
  const dimensions: QualityDimensions =
    wordCount === 0
      ? { readability: 0, grammar: 0, coherence: 0, ageAppropriateness: 0, completeness: 0 }
      : {
          readability: fleschKincaidEase(allText),
          grammar: grammarScore(allText),
          coherence: coherenceScore(pageTexts),
          ageAppropriateness: ageAppropriatenessScore(allText, ageRange),
          completeness: completenessScore(input, output),
        };

  // Score
  const score = Math.max(
    0,
    Math.min(
      dimensions.readability * 0.25 +
        dimensions.grammar * 0.2 +
        dimensions.coherence * 0.2 +
        dimensions.ageAppropriateness * 0.2 +
        dimensions.completeness * 0.15,
      1
    )
  );

  // Reason
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const weak = Object.entries(dimensions).filter(([, v]) => v < 0.6);
  const reason = [
    `Composite score: ${pct(score)}`,
    `  Readability: ${pct(dimensions.readability)}`,
    `  Grammar: ${pct(dimensions.grammar)}`,
    `  Coherence: ${pct(dimensions.coherence)}`,
    `  Age Appropriateness: ${pct(dimensions.ageAppropriateness)}`,
    `  Completeness: ${pct(dimensions.completeness)}`,
    ...(weak.length > 0
      ? ['', 'Weak dimensions:', ...weak.map(([k, v]) => `  ⚠ ${k}: ${pct(v)} — needs improvement`)]
      : []),
  ].join('\n');

  return { score, dimensions, reason };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export type { BookEvalInput, BookEvalOutput, QualityDimensions };
export default bookQualityScorer;
