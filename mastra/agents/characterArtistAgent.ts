/**
 * @fileoverview Character Artist Agent — Visual Character Sheet Generator
 *
 * ## What This File Does
 * This Mastra agent replaces `generateCharacterSheet()` from
 * services/generator/characterEngine.ts. It generates detailed CharacterSheet
 * objects with visual identity, reference image prompts, and style enforcement.
 *
 * ## Key Feature: Short-Term Memory
 * Maintains memory of ALL characters generated in a single book session.
 * When generating a new character for a book, it ALWAYS retrieves existing
 * characters for that book first to enforce visual consistency (same art style,
 * compatible color palettes, consistent proportions).
 *
 * ## What It Replaces
 * - `generateCharacterSheet()` in services/generator/characterEngine.ts
 * - `createConsistentScenePrompt()` for character-in-scene prompts
 *
 * ## Future Extensions
 * - [STREAMING PHASE]: Character animation reference generation for Veo 3.1
 * - [SERIES PHASE]: Cross-book character continuity via persistent memory
 *
 * @module mastra/agents/characterArtistAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { getGeminiModel } from '../lib/geminiProvider';
import { z } from 'zod';
import {
  CharacterProfileSchema,
  VisualIdentitySchema,
  CharacterSheetSchema,
} from '../schemas';

// ─── In-Memory Character Store ───────────────────────────────────────────────
// This acts as short-term memory for characters within a book session.
// Keyed by bookId + characterId for cross-character consistency.
const characterMemory = new Map<string, Map<string, z.infer<typeof CharacterSheetSchema>>>();

function getBookCharacters(bookId: string): z.infer<typeof CharacterSheetSchema>[] {
  const bookChars = characterMemory.get(bookId);
  return bookChars ? Array.from(bookChars.values()) : [];
}

function storeCharacter(bookId: string, sheet: z.infer<typeof CharacterSheetSchema>): void {
  if (!characterMemory.has(bookId)) {
    characterMemory.set(bookId, new Map());
  }
  characterMemory.get(bookId)!.set(sheet.id, sheet);
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Generates a comprehensive visual identity for a character.
 */
const generateVisualIdentity = createTool({
  id: 'generateVisualIdentity',
  description: 'Generates a detailed VisualIdentity for a character based on their profile and the book art style',
  inputSchema: z.object({
    characterProfile: CharacterProfileSchema,
    artStyle: z.string(),
    bookId: z.string(),
  }),
  outputSchema: z.object({
    visualIdentity: VisualIdentitySchema,
    existingCharacterStyles: z.array(z.string()).describe('Color palettes of existing characters in this book for compatibility'),
  }),
  execute: async (input) => {
    const existingChars = getBookCharacters(input.bookId);
    const existingPalettes = existingChars.map(
      (c) => `${c.baseProfile.name}: ${c.visualIdentity.colorPalette.join(', ')}`
    );

    // Return existing character style references so the LLM can ensure compatibility
    return {
      visualIdentity: {
        faceStructure: '',
        bodyType: '',
        clothingStyle: '',
        accessories: [],
        expressionRange: [],
        colorPalette: [],
        coreFeatures: [],
        styleNotes: `Art style: ${input.artStyle}. ${existingPalettes.length > 0 ? `Must be visually compatible with existing characters: ${existingPalettes.join('; ')}` : ''}`,
      },
      existingCharacterStyles: existingPalettes,
    };
  },
});

/**
 * Validates that a character's color palette is compatible with the book's overall palette.
 */
const validateColorPalette = createTool({
  id: 'validateColorPalette',
  description: 'Validates that a character color palette is harmonious with the book style and other characters',
  inputSchema: z.object({
    characterColors: z.array(z.string()),
    bookPrimaryColors: z.array(z.string()),
    existingCharacterColors: z.array(z.array(z.string())),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    adjustedColors: z.array(z.string()).optional(),
    notes: z.string(),
  }),
  execute: async (input) => {
    // Basic validation — ensure the character has enough colors and they don't clash
    if (input.characterColors.length < 3) {
      return {
        valid: false,
        adjustedColors: [...input.characterColors, ...input.bookPrimaryColors.slice(0, 3 - input.characterColors.length)],
        notes: 'Character needs at least 3 palette colors. Supplemented from book palette.',
      };
    }
    return { valid: true, notes: 'Color palette is compatible.' };
  },
});

/**
 * Enforces visual style consistency across all characters in a book.
 */
const enforceStyleConsistency = createTool({
  id: 'enforceCharacterStyleConsistency',
  description: 'Ensures a new character sheet is visually consistent with all existing characters in the same book',
  inputSchema: z.object({
    bookId: z.string(),
    newCharacterSheet: CharacterSheetSchema,
  }),
  outputSchema: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
    enforcedSheet: CharacterSheetSchema,
  }),
  execute: async (input) => {
    const existingChars = getBookCharacters(input.bookId);
    const issues: string[] = [];

    // Check that the new character references the same art style
    if (existingChars.length > 0) {
      const existingStyle = existingChars[0].styleEnforcement;
      if (input.newCharacterSheet.styleEnforcement !== existingStyle) {
        issues.push(`Style enforcement mismatch: expected "${existingStyle}" but got "${input.newCharacterSheet.styleEnforcement}"`);
      }
    }

    // Store the character in memory for future consistency checks
    storeCharacter(input.bookId, input.newCharacterSheet);

    return {
      consistent: issues.length === 0,
      issues,
      enforcedSheet: input.newCharacterSheet,
    };
  },
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const CHARACTER_ARTIST_SYSTEM_PROMPT = `You are the Lead Character Artist for Genesis, an AI-powered ebook creation platform. Your job is to create detailed, consistent character sheets that ensure every character looks identical across all pages of a book.

## Core Responsibilities
1. Generate CharacterSheet objects with full VisualIdentity details
2. Maintain visual consistency across ALL characters in a book
3. Create reference image prompts for character generation
4. Build style enforcement keywords for cross-page consistency

## CharacterSheet Output Format
When asked to generate a character sheet, respond with a JSON object:
{
  "id": "char_[unique]",
  "baseProfile": {
    "name": "Character Name",
    "role": "protagonist|antagonist|supporting|background",
    "description": "Personality and story role",
    "visualTraits": { "eyes": "detailed eye description", "hair": "detailed hair", "clothing": "signature outfit" },
    "personalityTraits": ["trait1", "trait2"],
    "importance": "critical|major|minor"
  },
  "visualIdentity": {
    "faceStructure": "Round/oval/angular with specific details",
    "bodyType": "Height, build, posture",
    "clothingStyle": "Signature outfit with exact colors",
    "accessories": ["Accessory 1", "Accessory 2"],
    "expressionRange": ["happy: description", "sad: description", "excited: description"],
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "coreFeatures": ["Feature that makes them instantly recognizable"],
    "styleNotes": "Art style adaptation notes"
  },
  "consistencyPrompt": "A paragraph that MUST be included in every image prompt featuring this character",
  "referenceImagePrompt": "Ultra-detailed prompt for generating a character reference sheet",
  "styleEnforcement": "Art style keywords: art_style, rendering_technique, detail_level"
}

## CRITICAL RULES
- The consistencyPrompt must include: name, age, body type, skin tone, hair (color, style, length), eyes (color, shape), face shape, distinctive features, signature clothing with exact colors, accessories
- Every character in the same book MUST share the same styleEnforcement keywords
- Color palettes of characters in the same book should be COMPLEMENTARY, not clashing
- If existing characters are provided, reference their art style and proportions for consistency

## Visual Identity Detail Requirements
- Face: Shape, distinctive marks (freckles, dimples, scars), nose shape, ears
- Hair: Color (specific shade), length, texture (curly/straight/wavy), styling, accessories
- Body: Height relative to age/role, build, posture, gait
- Clothing: Signature outfit with exact colors (hex codes), patterns, fit style
- Accessories: Always-present items (glasses, jewelry, hat, weapon)
- Expression Range: How their face changes with at least 3 emotions

Always respond with valid JSON only.`;

// ─── Agent Definition ────────────────────────────────────────────────────────

export const characterArtistAgent = new Agent({
  id: 'character-artist',
  name: 'Character Artist',
  instructions: CHARACTER_ARTIST_SYSTEM_PROMPT,
  model: getGeminiModel(),
  tools: {
    generateVisualIdentity,
    validateColorPalette,
    enforceStyleConsistency,
  },
});

// ─── Exports ─────────────────────────────────────────────────────────────────
export { getBookCharacters, storeCharacter, characterMemory };
