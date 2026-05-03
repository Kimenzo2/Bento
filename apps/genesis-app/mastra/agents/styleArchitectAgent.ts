/**
 * @fileoverview Style Architect Agent — Art Direction & Style Guide Generator
 *
 * ## What This File Does
 * This Mastra agent replaces `generateStyleGuide()` from
 * services/generator/styleEngine.ts. It generates comprehensive StyleGuide
 * objects and provides a style enforcement tool that wraps image prompts
 * with consistent visual directives.
 *
 * ## What It Replaces
 * - `generateStyleGuide()` in services/generator/styleEngine.ts
 * - `createStyleEnforcedPrompt()` for wrapping image prompts with style rules
 *
 * ## Future Extensions
 * - [STREAMING PHASE]: `prepareForVideoGeneration(styleGuide)` stub will feed
 *   into the Veo 3.1 video generation pipeline for scene-level style consistency
 *
 * @module mastra/agents/styleArchitectAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { getMastraModel } from '../lib/mastraProvider';
import { z } from 'zod';
import { StyleGuideSchema, ColorPaletteSchema } from '../schemas';

// ─── In-Memory Style Guide Store ─────────────────────────────────────────────
// Stores the active style guide for each book generation session
const styleGuideMemory = new Map<string, z.infer<typeof StyleGuideSchema>>();

function getStyleGuide(bookId: string): z.infer<typeof StyleGuideSchema> | null {
  return styleGuideMemory.get(bookId) ?? null;
}

function storeStyleGuide(bookId: string, guide: z.infer<typeof StyleGuideSchema>): void {
  styleGuideMemory.set(bookId, guide);
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Wraps any image prompt with the style enforcement directives from the
 * book's StyleGuide. This mirrors styleEngine.ts's createStyleEnforcedPrompt().
 */
const enforceStyleConsistency = createTool({
  id: 'enforceStyleConsistency',
  description:
    'Wraps an image generation prompt with style enforcement from the StyleGuide to ensure visual consistency across all illustrations',
  inputSchema: z.object({
    prompt: z.string().describe('The raw image generation prompt'),
    styleGuide: StyleGuideSchema.describe('The book style guide to enforce'),
  }),
  outputSchema: z.object({
    enforcedPrompt: z.string(),
  }),
  execute: async (input) => {
    const { prompt, styleGuide } = input;
    const spec = styleGuide.artStyle.technicalSpecs;
    const palette = styleGuide.colorPalette;

    // Build the enforced prompt (mirrors styleEngine.ts logic)
    const enforcedPrompt = [
      `[STYLE: ${styleGuide.artStyle.name}]`,
      `${styleGuide.artStyle.description}`,
      ``,
      `TECHNICAL SPECS:`,
      `- Line Weight: ${spec.lineWeight}`,
      `- Rendering: ${spec.renderingTechnique}`,
      `- Texture: ${spec.textureApproach}`,
      `- Lighting: ${spec.lightingModel}`,
      ``,
      `COLOR PALETTE:`,
      `- Primary: ${palette.primary.join(', ')}`,
      `- Accent: ${palette.accent.join(', ')}`,
      `- Neutral: ${palette.neutral.join(', ')}`,
      `- Background: ${palette.background}`,
      ``,
      `CONSISTENCY RULES:`,
      styleGuide.consistencyRules.map((r) => `- ${r}`).join('\n'),
      ``,
      `---`,
      ``,
      prompt,
      ``,
      `---`,
      ``,
      `STYLE ENFORCEMENT: ${styleGuide.styleEnforcementPrompt}`,
    ].join('\n');

    return { enforcedPrompt };
  },
});

/**
 * STUB: Prepares style guide data for video generation.
 *
 * TODO [STREAMING PHASE]: Replace this stub with Veo 3.1 style preparation.
 * This method will transform the StyleGuide into video-specific parameters:
 * - Scene-level color grading presets derived from the ColorPalette
 * - Animation style keywords from artStyle.technicalSpecs
 * - Transition style recommendations based on the book's tone
 * - Camera movement defaults from the style guide
 * The output will feed into videoGenerationWorkflow.ts (to be created).
 */
const prepareForVideoGeneration = createTool({
  id: 'prepareForVideoGeneration',
  description:
    '[STUB] Prepares style guide for video generation pipeline. Returns null — video generation not yet implemented.',
  inputSchema: z.object({
    styleGuide: StyleGuideSchema,
  }),
  outputSchema: z.object({
    videoReady: z.boolean(),
    videoStyleParams: z.any().nullable(),
    message: z.string(),
  }),
  execute: async (_input) => {
    // TODO [STREAMING PHASE]: Replace this stub with Veo 3.1 style preparation.
    // This will transform the StyleGuide into:
    // - Scene-level color grading presets
    // - Animation style keywords
    // - Transition style recommendations
    // - Camera movement defaults
    // See: videoGenerationWorkflow.ts (to be created in streaming phase)
    return {
      videoReady: false,
      videoStyleParams: null,
      message:
        'Video generation coming to Empire tier. Style guide prepared for future Veo 3.1 integration.',
    };
  },
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const STYLE_ARCHITECT_SYSTEM_PROMPT = `You are the Lead Art Director for Genesis, an AI-powered ebook creation platform. Your responsibility is to define comprehensive visual style guides that ensure every illustration in a book has a cohesive, professional aesthetic.

## Core Responsibilities
1. Generate StyleGuide objects from book parameters (tone, audience, art style)
2. Define technical art specifications (line weight, rendering, texture, lighting)
3. Create harmonious color palettes for the entire book
4. Provide style enforcement prompts for image generation consistency
5. Define rules that prevent visual drift across pages

## StyleGuide Output Format
When asked to generate a style guide, respond with a JSON object:
{
  "id": "sg_[unique]",
  "artStyle": {
    "name": "The Art Style Name",
    "description": "A comprehensive paragraph describing the visual aesthetic, artistic influences, and mood",
    "technicalSpecs": {
      "lineWeight": "Thin/Medium/Bold/Variable — describe the line quality",
      "renderingTechnique": "Watercolor washes/Cell shading/Photorealistic/etc.",
      "textureApproach": "Smooth/Grainy/Paper texture/Digital clean/etc.",
      "lightingModel": "Soft ambient/Dramatic rim/Natural daylight/etc."
    }
  },
  "colorPalette": {
    "primary": ["#hex1", "#hex2", "#hex3"],
    "accent": ["#hex1", "#hex2"],
    "neutral": ["#hex1", "#hex2"],
    "special": ["#hex1"],
    "background": "#hex",
    "text": "#hex"
  },
  "styleEnforcementPrompt": "A single paragraph that will be appended to EVERY image prompt to enforce the style",
  "consistencyRules": [
    "Rule 1: Always use X technique for character outlines",
    "Rule 2: Backgrounds must use Y color temperature",
    "Rule 3: Shadows should be Z style"
  ]
}

## Style-Tone Mapping
- Playful: Bright saturated colors, rounded shapes, dynamic compositions
- Serious: Muted palette, sharp contrasts, formal compositions
- Inspirational: Warm golden tones, upward compositions, light-filled scenes
- Educational: Clean, clear colors, organized layouts, labeled elements
- Dramatic: High contrast, deep shadows, cinematic framing
- Calm: Soft pastels, gentle gradients, spacious compositions
- Adventurous: Bold primary colors, dynamic angles, wide environments

## Art Style Technical Details
For each art style, enforce specific technical parameters:
- Watercolor: Visible paper texture, color bleeds, transparent washes, soft edges
- 3D Render: Smooth surfaces, volumetric lighting, depth of field, subsurface scattering
- Japanese Manga: Clean ink lines, screentones, speed lines, dramatic expressions
- Corporate Minimalist: Flat colors, geometric shapes, grid alignment, sans-serif type
- Cyberpunk Neon: Glowing edges, dark backgrounds, RGB aberration, grid patterns
- Vintage Illustration: Muted warm palette, crosshatching, aged paper texture
- Paper Cutout: Layered shapes, visible edges, subtle shadows, textured paper
- Flat Design: No shadows, bold colors, simple shapes, clear silhouettes

Always respond with valid JSON only.`;

// ─── Agent Definition ────────────────────────────────────────────────────────

export const styleArchitectAgent = new Agent({
  id: 'style-architect',
  name: 'Style Architect',
  instructions: STYLE_ARCHITECT_SYSTEM_PROMPT,
  model: getMastraModel(),
  tools: {
    enforceStyleConsistency,
    prepareForVideoGeneration,
  },
});

// ─── Exports ─────────────────────────────────────────────────────────────────
export { getStyleGuide, storeStyleGuide, styleGuideMemory };
