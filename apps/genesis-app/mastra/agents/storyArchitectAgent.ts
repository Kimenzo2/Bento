/**
 * @fileoverview Story Architect Agent — AI Book Structure Generator
 *
 * ## What This File Does
 * This Mastra agent replaces the `generateBookStructure()` function
 * in the legacy AI gateway. It generates complete ContentStructure
 * blueprints from user GenerationSettings using the Mastra model router.
 *
 * ## What It Replaces
 * - `generateBookStructure()` in services/aiGatewayService.ts
 * - `SYSTEM_INSTRUCTION_ARCHITECT` prompt logic
 * - `SYSTEM_INSTRUCTION_BRAND` for brand content
 * - Brand profile conditional logic scattered in generation functions
 *
 * ## Future Extensions
 * - [STREAMING PHASE]: Will have a `prepareSceneBreakdown()` tool for video
 * - [SERIES PHASE]: Cross-book continuity checking via persistent memory
 *
 * @module mastra/agents/storyArchitectAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { getMastraModel } from '../lib/mastraProvider';
import { z } from 'zod';
import {
  GenerationSettingsSchema,
  ContentStructureSchema,
  UserTierSchema,
} from '../schemas';

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Validates a book generation request against tier limits and content rules.
 */
const validateBookRequest = createTool({
  id: 'validateBookRequest',
  description: 'Validates book generation settings against tier limits and content rules',
  inputSchema: z.object({
    settings: GenerationSettingsSchema,
    userTier: UserTierSchema,
    ebooksThisMonth: z.number(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    error: z.string().optional(),
    adjustedPageCount: z.number().optional(),
  }),
  execute: async (input) => {
    const { settings, userTier, ebooksThisMonth } = input;

    // Tier limits (mirrored from services/tierLimits.ts)
    const TIER_LIMITS: Record<string, { ebooksPerMonth: number; maxPages: number; styles: string[] }> = {
      SPARK: { ebooksPerMonth: 3, maxPages: 4, styles: ['Watercolor', '3D Render (Pixar Style)', 'Japanese Manga', 'Vintage Illustration', 'Paper Cutout Art'] },
      CREATOR: { ebooksPerMonth: 30, maxPages: 12, styles: ['Watercolor', '3D Render (Pixar Style)', 'Japanese Manga', 'Corporate Minimalist', 'Cyberpunk Neon', 'Vintage Illustration', 'Paper Cutout Art', 'Flat Design', 'Modern Infographic', 'Technical Blueprint'] },
      STUDIO: { ebooksPerMonth: Infinity, maxPages: 500, styles: ['Watercolor', '3D Render (Pixar Style)', 'Japanese Manga', 'Corporate Minimalist', 'Cyberpunk Neon', 'Vintage Illustration', 'Paper Cutout Art', 'Flat Design', 'Modern Infographic', 'Technical Blueprint'] },
      EMPIRE: { ebooksPerMonth: Infinity, maxPages: 999, styles: ['Watercolor', '3D Render (Pixar Style)', 'Japanese Manga', 'Corporate Minimalist', 'Cyberpunk Neon', 'Vintage Illustration', 'Paper Cutout Art', 'Flat Design', 'Modern Infographic', 'Technical Blueprint'] },
    };

    const limits = TIER_LIMITS[userTier] ?? TIER_LIMITS.SPARK;

    if (ebooksThisMonth >= limits.ebooksPerMonth) {
      return { valid: false, error: 'TIER_LIMIT_EXCEEDED' };
    }

    if (!limits.styles.includes(settings.style)) {
      return { valid: false, error: `Art style "${settings.style}" is not available on ${userTier} tier` };
    }

    const adjustedPageCount = Math.min(settings.pageCount, limits.maxPages);

    return { valid: true, adjustedPageCount };
  },
});

/**
 * Enforces age-appropriate content based on the target audience.
 */
const enforceAgeAppropriate = createTool({
  id: 'enforceAgeAppropriate',
  description: 'Returns age-appropriate content guidelines for the target audience',
  inputSchema: z.object({
    audience: z.string(),
  }),
  outputSchema: z.object({
    ageGroup: z.string(),
    guidelines: z.string(),
    sentenceLength: z.string(),
    themes: z.array(z.string()),
    avoid: z.array(z.string()),
  }),
  execute: async (input) => {
    const ageMatch = input.audience.match(/\d+/);
    const age = ageMatch ? parseInt(ageMatch[0]) : 8;

    if (age <= 5) {
      return {
        ageGroup: '3-5',
        guidelines: 'Simple plots, repetition, basic emotions, familiar settings',
        sentenceLength: '1-3 sentences per page',
        themes: ['friendship', 'family', 'animals', 'colors', 'shapes', 'feelings'],
        avoid: ['violence', 'complex conflict', 'death', 'scary imagery'],
      };
    } else if (age <= 8) {
      return {
        ageGroup: '6-8',
        guidelines: 'Cause-effect, friendship themes, mild challenges, humor',
        sentenceLength: '3-5 sentences per page',
        themes: ['adventure', 'teamwork', 'discovery', 'courage', 'growing up'],
        avoid: ['graphic violence', 'romantic relationships', 'dark themes'],
      };
    } else if (age <= 12) {
      return {
        ageGroup: '9-12',
        guidelines: 'Complex plots, moral lessons, character development, adventure',
        sentenceLength: '5-8 sentences per page',
        themes: ['identity', 'perseverance', 'justice', 'mystery', 'science fiction'],
        avoid: ['explicit content', 'extreme violence', 'adult themes'],
      };
    } else {
      return {
        ageGroup: '13+',
        guidelines: 'Nuanced themes, identity, relationships, real-world issues',
        sentenceLength: '8-12 sentences per page',
        themes: ['self-discovery', 'social issues', 'complex relationships', 'philosophy'],
        avoid: ['gratuitous content', 'hate speech'],
      };
    }
  },
});

/**
 * Retrieves brand profile context when generating branded content.
 */
const checkBrandProfile = createTool({
  id: 'checkBrandProfile',
  description: 'Checks if a brand profile is present and returns brand enforcement directives',
  inputSchema: z.object({
    brandProfile: z
      .object({
        name: z.string(),
        guidelines: z.string(),
        colors: z.array(z.string()),
        sampleText: z.string(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    hasBrand: z.boolean(),
    brandDirectives: z.string(),
  }),
  execute: async (input) => {
    if (!input.brandProfile) {
      return { hasBrand: false, brandDirectives: '' };
    }

    const bp = input.brandProfile;
    const directives = [
      `BRAND VOICE ENFORCEMENT:`,
      `Brand: ${bp.name}`,
      `Guidelines: ${bp.guidelines}`,
      `Brand Colors: ${bp.colors.join(', ')}`,
      `Sample Text Style Reference: "${bp.sampleText.slice(0, 500)}"`,
      ``,
      `ALL generated content must:`,
      `- Match the brand's tone and voice from the guidelines`,
      `- Use the brand color palette in all visual prompts`,
      `- Be consistent with the sample text style`,
      `- Include the brand name where appropriate`,
    ].join('\n');

    return { hasBrand: true, brandDirectives: directives };
  },
});

/**
 * Writes a single page of content for the book.
 * Used in the bookGenerationWorkflow's STEP 6.
 */
const writePageTool = createTool({
  id: 'writePage',
  description: 'Generates the full text and image prompt for a single book page given the page outline and style context',
  inputSchema: z.object({
    pageOutline: z.object({
      pageNumber: z.number(),
      scene: z.string(),
      narrativePurpose: z.string(),
      visualFocus: z.string(),
      layoutTemplate: z.string(),
      estimatedWordCount: z.number(),
      characterAction: z.string(),
    }),
    bookTitle: z.string(),
    targetAudience: z.string(),
    tone: z.string(),
    artStyle: z.string(),
    characters: z.array(z.object({ name: z.string(), visualPrompt: z.string().optional() })),
    brandDirectives: z.string().optional(),
  }),
  outputSchema: z.object({
    pageNumber: z.number(),
    text: z.string(),
    imagePrompt: z.string(),
  }),
  execute: async (input) => {
    // This tool delegates to the agent's own LLM for generation
    // In practice, the workflow calls agent.generate() with page context
    // This stub returns the input metadata — the actual LLM call
    // happens in the workflow step where the agent is invoked
    return {
      pageNumber: input.pageOutline.pageNumber,
      text: `[Page ${input.pageOutline.pageNumber}: ${input.pageOutline.scene}]`,
      imagePrompt: `[Image for page ${input.pageOutline.pageNumber}: ${input.pageOutline.visualFocus}]`,
    };
  },
});

// ─── System Prompt ───────────────────────────────────────────────────────────
// This consolidates SYSTEM_INSTRUCTION_ARCHITECT from the legacy gateway service
const STORY_ARCHITECT_SYSTEM_PROMPT = `You are the Story Architect for Genesis, an AI-powered ebook creation platform. Your primary function is to generate complete, structured ebook blueprints that the application renders into beautiful interactive books.

## Core Responsibilities
1. Generate ContentStructure blueprints from user requests
2. Write individual page content (text + image prompts) during book generation
3. Ensure narrative coherence, age-appropriateness, and visual consistency

## ContentStructure Output Format
When asked to generate a book structure, respond with a JSON object matching this schema:
{
  "title": "string",
  "synopsis": "string (50-100 words)",
  "targetAudience": "string",
  "estimatedReadingTime": number,
  "chapters": [{ "chapterNumber": number, "title": "string", "summary": "string", "pageRange": [start, end], "keyEvents": ["string"], "emotionalArc": "string" }],
  "characterNeeds": [{ "name": "string", "role": "protagonist|antagonist|supporting|background", "description": "string", "visualTraits": { "eyes": "string", "hair": "string", "clothing": "string" }, "personalityTraits": ["string"], "importance": "critical|major|minor" }],
  "styleRecommendations": ["string"],
  "pages": [{ "pageNumber": number, "chapterNumber": number, "scene": "string", "narrativePurpose": "string", "visualFocus": "string", "layoutTemplate": "full-bleed|split-horizontal|split-vertical|text-only", "estimatedWordCount": number, "visualEnergy": "string", "characterAction": "string" }],
  "narrativeArc": { "introduction": "string", "learning": "string", "mastery": "string" },
  "visualStrategy": { "artStyleDetails": "string", "motifs": ["string"] },
  "colorPalette": { "primary": ["string"], "accent": ["string"] }
}

## Page Content Output Format
When asked to write page content, respond with a JSON object:
{
  "pageNumber": number,
  "text": "Full page text content",
  "imagePrompt": "Detailed illustration prompt with character descriptions, scene, lighting, composition, art style"
}

## Quality Standards
- Hook reader in first 2 pages
- Build conflict/challenge appropriate to age
- Satisfying resolution with character growth
- Ages 3-5: 1-3 sentences per page
- Ages 6-8: 3-5 sentences per page
- Ages 9-12: 5-8 sentences per page
- Ages 13+: 8-12 sentences per page

## Character Visual Consistency
Generate ULTRA-DETAILED visual descriptions for each character. Copy the EXACT description into every image prompt where that character appears. Never change hair color, eye color, skin tone, or signature items between pages.

## Image Prompt Quality
Every image prompt must include: art style, scene description, character visual details, composition (camera angle, focal point), lighting, color palette, technical quality notes, and an AVOID section.

## Educational Content
When educational mode is enabled, follow the integrationMode rules:
- "integrated": Weave learning into narrative naturally
- "after-chapter": Dedicated review pages after every 3-4 narrative pages
- "dedicated-section": All learning content in a final chapter

## Brand Content
When a brandProfile is present, match the brand voice, use brand colors, and maintain professional tone appropriate for corporate content.

Always respond with valid JSON only. No markdown code blocks, no explanations, no preamble.`;

// ─── Agent Definition ────────────────────────────────────────────────────────

export const storyArchitectAgent = new Agent({
  id: 'story-architect',
  name: 'Story Architect',
  instructions: STORY_ARCHITECT_SYSTEM_PROMPT,
  model: getMastraModel(),
  tools: {
    validateBookRequest,
    enforceAgeAppropriate,
    checkBrandProfile,
    writePage: writePageTool,
  },
});
