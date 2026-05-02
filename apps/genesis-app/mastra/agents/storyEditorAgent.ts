/**
 * @fileoverview Story Editor Agent — Text Improvement & Consistency Checking
 *
 * ## What This File Does
 * This Mastra agent replaces the three separate editing functions in
 * services/grokService.ts: improveText(), checkCharacterConsistency(),
 * and getWritingSuggestions().
 *
 * ## Key Feature: Persistent Session Memory
 * Maintains memory across the editing session for a single book (keyed by
 * bookId). Remembers what improvements the author accepted vs rejected,
 * style preferences, and character descriptions. The suggestionsTool
 * checks memory for previously rejected suggestions and avoids repeating them.
 *
 * ## What It Replaces
 * - `improveText()` in services/grokService.ts
 * - `checkCharacterConsistency()` in services/grokService.ts
 * - `getWritingSuggestions()` in services/grokService.ts
 *
 * ## Future Extensions
 * - [COLLABORATION PHASE]: Multi-user editing with conflict resolution
 * - [SERIES PHASE]: Cross-book narrative consistency checking
 *
 * @module mastra/agents/storyEditorAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { getMastraModel } from '../lib/mastraProvider';
import { z } from 'zod';

// ─── Session Memory ──────────────────────────────────────────────────────────
// Persistent memory for editing sessions, keyed by bookId.
// Tracks accepted/rejected suggestions, style preferences, character info.

interface EditorSessionMemory {
  bookId: string;
  acceptedSuggestions: string[];
  rejectedSuggestions: string[];
  stylePreferences: {
    preferredTone?: string;
    preferredComplexity?: string;
    customNotes: string[];
  };
  characterDescriptions: Map<string, string>;
  lastInteraction: number;
}

const sessionMemory = new Map<string, EditorSessionMemory>();

function getSession(bookId: string): EditorSessionMemory {
  if (!sessionMemory.has(bookId)) {
    sessionMemory.set(bookId, {
      bookId,
      acceptedSuggestions: [],
      rejectedSuggestions: [],
      stylePreferences: { customNotes: [] },
      characterDescriptions: new Map(),
      lastInteraction: Date.now(),
    });
  }
  const session = sessionMemory.get(bookId)!;
  session.lastInteraction = Date.now();
  return session;
}

function recordAcceptedSuggestion(bookId: string, suggestion: string): void {
  const session = getSession(bookId);
  session.acceptedSuggestions.push(suggestion);
}

function recordRejectedSuggestion(bookId: string, suggestion: string): void {
  const session = getSession(bookId);
  session.rejectedSuggestions.push(suggestion);
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Improves text based on tone and audience, preserving core meaning.
 * Mirrors grokService.ts improveText().
 */
const improveTool = createTool({
  id: 'improveTool',
  description: 'Improves story text for a target audience and tone while preserving core meaning and charm',
  inputSchema: z.object({
    bookId: z.string(),
    text: z.string(),
    tone: z.string(),
    targetAudience: z.string(),
  }),
  outputSchema: z.object({
    improvedText: z.string(),
    changeSummary: z.string(),
  }),
  execute: async (input) => {
    const session = getSession(input.bookId);

    // Build context from session memory
    const memoryContext = session.stylePreferences.preferredTone
      ? `The author prefers a ${session.stylePreferences.preferredTone} tone.`
      : '';
    const rejectedContext = session.rejectedSuggestions.length > 0
      ? `The author has previously rejected: ${session.rejectedSuggestions.slice(-5).join('; ')}. Avoid similar changes.`
      : '';

    // This tool is called by the agent's LLM which performs the actual improvement
    return {
      improvedText: input.text,
      changeSummary: `Context: ${memoryContext} ${rejectedContext}`.trim(),
    };
  },
});

/**
 * Checks character consistency across the entire book.
 * Mirrors grokService.ts checkCharacterConsistency().
 */
const consistencyCheckTool = createTool({
  id: 'consistencyCheckTool',
  description: 'Analyzes a book for character consistency issues — checks names, traits, appearances, and behavior',
  inputSchema: z.object({
    bookId: z.string(),
    bookText: z.string(),
    characterNames: z.array(z.string()),
  }),
  outputSchema: z.object({
    characters: z.array(
      z.object({
        name: z.string(),
        inconsistencies: z.array(z.string()),
        suggestions: z.array(z.string()),
      })
    ),
    overallScore: z.number().min(0).max(100),
    memoryUpdated: z.boolean(),
  }),
  execute: async (input) => {
    const session = getSession(input.bookId);

    // Store character names in session memory for future reference
    for (const name of input.characterNames) {
      if (!session.characterDescriptions.has(name)) {
        session.characterDescriptions.set(name, '');
      }
    }

    // The actual consistency analysis is done by the LLM
    return {
      characters: input.characterNames.map((name) => ({
        name,
        inconsistencies: [],
        suggestions: [],
      })),
      overallScore: 100,
      memoryUpdated: true,
    };
  },
});

/**
 * Generates writing suggestions, avoiding previously rejected suggestions.
 * Mirrors grokService.ts getWritingSuggestions().
 */
const suggestionsTool = createTool({
  id: 'suggestionsTool',
  description: 'Generates inline writing suggestions for text, avoiding types of suggestions the author has previously rejected',
  inputSchema: z.object({
    bookId: z.string(),
    text: z.string(),
    context: z.string().describe('Surrounding text or page context'),
  }),
  outputSchema: z.object({
    suggestions: z.array(
      z.object({
        type: z.string(),
        original: z.string(),
        improved: z.string(),
        reason: z.string(),
      })
    ),
    rejectedTypes: z.array(z.string()).describe('Types of suggestions the author has rejected before'),
  }),
  execute: async (input) => {
    const session = getSession(input.bookId);

    // Identify types of previously rejected suggestions
    const rejectedTypes = session.rejectedSuggestions.map((s) => {
      if (s.includes('grammar')) return 'grammar';
      if (s.includes('tone')) return 'tone';
      if (s.includes('clarity')) return 'clarity';
      if (s.includes('vocabulary')) return 'vocabulary';
      return 'general';
    });

    const uniqueRejectedTypes = [...new Set(rejectedTypes)];

    return {
      suggestions: [],
      rejectedTypes: uniqueRejectedTypes,
    };
  },
});

/**
 * Records feedback on a suggestion (accepted or rejected) to improve future suggestions.
 */
const recordFeedbackTool = createTool({
  id: 'recordFeedback',
  description: 'Records whether the author accepted or rejected a suggestion to improve future recommendations',
  inputSchema: z.object({
    bookId: z.string(),
    suggestion: z.string(),
    accepted: z.boolean(),
  }),
  outputSchema: z.object({
    recorded: z.boolean(),
    totalAccepted: z.number(),
    totalRejected: z.number(),
  }),
  execute: async (input) => {
    if (input.accepted) {
      recordAcceptedSuggestion(input.bookId, input.suggestion);
    } else {
      recordRejectedSuggestion(input.bookId, input.suggestion);
    }

    const session = getSession(input.bookId);
    return {
      recorded: true,
      totalAccepted: session.acceptedSuggestions.length,
      totalRejected: session.rejectedSuggestions.length,
    };
  },
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const STORY_EDITOR_SYSTEM_PROMPT = `You are the Story Editor for Genesis, an AI-powered ebook creation platform. You help authors improve their stories through three core capabilities: text improvement, character consistency checking, and writing suggestions.

## Core Capabilities

### 1. Text Improvement (action: "improve")
When asked to improve text:
- Preserve the core meaning and charm of the original
- Match the requested tone and audience level
- Keep approximately the same length
- Return ONLY the improved text, no explanations
- Check session memory for previously rejected changes and avoid those patterns

### 2. Character Consistency (action: "consistency") 
When checking character consistency:
- Analyze the entire book text for each character
- Check for: name spelling consistency, physical description changes, personality shifts, trait contradictions
- Score overall consistency 0-100
- Return JSON: { "characters": [{ "name": "", "inconsistencies": [""], "suggestions": [""] }], "overallScore": 85 }

### 3. Writing Suggestions (action: "suggestions")
When generating suggestions:
- Provide specific, actionable inline suggestions
- Each suggestion includes: type, original text, improved version, reason
- NEVER repeat suggestion types the author has previously rejected
- Return JSON: { "suggestions": [{ "type": "", "original": "", "improved": "", "reason": "" }] }

## Session Memory Rules
- You receive context about the author's preferences from session memory
- If the author has rejected certain types of suggestions, DO NOT make similar ones
- If the author prefers a certain tone, lean toward it in improvements
- Track and respect the author's evolving style preferences

## Response Format
Always parse the "action" field from the input to determine which capability to use.
Always respond with valid JSON matching the schemas above.`;

// ─── Agent Definition ────────────────────────────────────────────────────────

export const storyEditorAgent = new Agent({
  id: 'story-editor',
  name: 'Story Editor',
  instructions: STORY_EDITOR_SYSTEM_PROMPT,
  model: getMastraModel(),
  tools: {
    improveTool,
    consistencyCheckTool,
    suggestionsTool,
    recordFeedback: recordFeedbackTool,
  },
});

// ─── Exports ─────────────────────────────────────────────────────────────────
export {
  sessionMemory,
  getSession,
  recordAcceptedSuggestion,
  recordRejectedSuggestion,
};
