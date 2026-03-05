/**
 * @fileoverview Shared Zod Schemas for Mastra Agents and Workflows
 *
 * ## What This File Does
 * Defines Zod validation schemas that mirror the existing Genesis TypeScript
 * types (from /types.ts and /types/generator.ts). These schemas are used for
 * runtime validation of all inputs and outputs across Mastra agents and workflows.
 *
 * ## What It Replaces
 * Genesis types were previously TypeScript-only (compile-time). This adds
 * runtime validation to all AI agent interactions, catching malformed responses
 * before they reach the frontend.
 *
 * ## Design Decision
 * We do NOT change the existing TypeScript types. These Zod schemas ADAPT to
 * the existing type definitions so that the frontend sees identical structures.
 *
 * @module mastra/schemas
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS (mirror types.ts enums)
// ═══════════════════════════════════════════════════════════════════════════════

export const ArtStyleSchema = z.enum([
  'Watercolor',
  '3D Render (Pixar Style)',
  'Japanese Manga',
  'Corporate Minimalist',
  'Cyberpunk Neon',
  'Vintage Illustration',
  'Paper Cutout Art',
  'Flat Design',
  'Modern Infographic',
  'Technical Blueprint',
]);

export const BookToneSchema = z.enum([
  'Playful',
  'Serious',
  'Inspirational',
  'Educational',
  'Dramatic',
  'Calm',
  'Adventurous',
]);

export const UserTierSchema = z.enum(['SPARK', 'CREATOR', 'STUDIO', 'EMPIRE']);

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATOR TYPES (mirror types/generator.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const PageStructureSchema = z.object({
  pageNumber: z.number(),
  chapterNumber: z.number(),
  scene: z.string(),
  narrativePurpose: z.string(),
  visualFocus: z.string(),
  layoutTemplate: z.enum(['full-bleed', 'split-horizontal', 'split-vertical', 'text-only']),
  estimatedWordCount: z.number(),
  visualEnergy: z.string(),
  characterAction: z.string(),
});

export const ChapterStructureSchema = z.object({
  chapterNumber: z.number(),
  title: z.string(),
  summary: z.string(),
  pageRange: z.tuple([z.number(), z.number()]),
  keyEvents: z.array(z.string()),
  emotionalArc: z.string(),
});

export const CharacterProfileSchema = z.object({
  name: z.string(),
  role: z.enum(['protagonist', 'antagonist', 'supporting', 'background']),
  description: z.string(),
  visualTraits: z.object({
    eyes: z.string(),
    hair: z.string(),
    clothing: z.string(),
  }),
  personalityTraits: z.array(z.string()),
  importance: z.enum(['critical', 'major', 'minor']),
});

export const ContentStructureSchema = z.object({
  title: z.string(),
  synopsis: z.string(),
  targetAudience: z.string(),
  estimatedReadingTime: z.number(),
  chapters: z.array(ChapterStructureSchema),
  characterNeeds: z.array(CharacterProfileSchema),
  styleRecommendations: z.array(z.string()),
  pages: z.array(PageStructureSchema),
  narrativeArc: z.object({
    introduction: z.string(),
    learning: z.string(),
    mastery: z.string(),
  }),
  visualStrategy: z.object({
    artStyleDetails: z.string(),
    motifs: z.array(z.string()),
  }),
  colorPalette: z.object({
    primary: z.array(z.string()),
    accent: z.array(z.string()),
  }),
});

export const VisualIdentitySchema = z.object({
  faceStructure: z.string(),
  bodyType: z.string(),
  clothingStyle: z.string(),
  accessories: z.array(z.string()),
  expressionRange: z.array(z.string()),
  colorPalette: z.array(z.string()),
  coreFeatures: z.array(z.string()).optional(),
  styleNotes: z.string().optional(),
});

export const CharacterSheetSchema = z.object({
  id: z.string(),
  baseProfile: CharacterProfileSchema,
  visualIdentity: VisualIdentitySchema,
  consistencyPrompt: z.string().optional(),
  referenceImagePrompt: z.string(),
  styleEnforcement: z.string(),
  midjourneyRefUrl: z.string().optional(),
});

export const ColorPaletteSchema = z.object({
  primary: z.array(z.string()),
  accent: z.array(z.string()),
  neutral: z.array(z.string()),
  special: z.array(z.string()),
  background: z.string(),
  text: z.string(),
});

export const StyleGuideSchema = z.object({
  id: z.string(),
  artStyle: z.object({
    name: z.string(),
    description: z.string(),
    technicalSpecs: z.object({
      lineWeight: z.string(),
      renderingTechnique: z.string(),
      textureApproach: z.string(),
      lightingModel: z.string(),
    }),
  }),
  colorPalette: ColorPaletteSchema,
  styleEnforcementPrompt: z.string(),
  consistencyRules: z.array(z.string()),
});

export const EbookRequestSchema = z.object({
  topic: z.string(),
  targetAudience: z.string(),
  pageCount: z.number().min(1).max(999),
  style: z.string(),
  tone: z.string(),
  brandProfile: z
    .object({
      name: z.string(),
      guidelines: z.string(),
      colors: z.array(z.string()),
      sampleText: z.string(),
    })
    .optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TYPES (mirror types.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const LearningConfigSchema = z.object({
  subject: z.string(),
  objectives: z.string(),
  integrationMode: z.enum(['integrated', 'after-chapter', 'dedicated-section']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  teacherCharacterId: z.string().optional(),
});

export const BrandProfileSchema = z.object({
  name: z.string(),
  guidelines: z.string(),
  colors: z.array(z.string()),
  sampleText: z.string(),
});

export const GenerationSettingsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  style: ArtStyleSchema,
  tone: BookToneSchema,
  pageCount: z.number().min(1).max(999),
  audience: z.string().min(1, 'Audience is required'),
  isBranching: z.boolean(),
  educational: z.boolean().optional(),
  learningConfig: LearningConfigSchema.optional(),
  teacherCharacter: z.any().optional(), // Full Character object (complex nested type)
  brandProfile: BrandProfileSchema.optional(),
  brandStoryConfig: z.any().optional(), // Complex nested BrandStoryConfig
  templateStructure: z.array(z.any()).optional(),
});

export const PageSchema = z.object({
  id: z.string(),
  pageNumber: z.number(),
  text: z.string(),
  imagePrompt: z.string(),
  imageUrl: z.string().nullable().optional(),
  isImageOutdated: z.boolean().optional(),
  layoutType: z.enum([
    'full-bleed',
    'split-horizontal',
    'split-vertical',
    'text-only',
    'image-only',
    'learning-break',
    'learning-only',
  ]),
  narrationNotes: z
    .object({
      tone: z.string(),
      pacing: z.string(),
      emotion: z.string(),
      soundEffects: z.array(z.string()).optional(),
    })
    .optional(),
  interactiveElement: z.any().optional(),
  learningContent: z.any().optional(),
  learningMoment: z.any().optional(),
  vocabularyWords: z.array(z.object({ word: z.string(), definition: z.string() })).optional(),
  choices: z
    .array(z.object({ text: z.string(), targetPageNumber: z.number() }))
    .optional(),
});

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  pages: z.array(PageSchema),
});

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  description: z.string(),
  visualTraits: z.string(),
  visualPrompt: z.string().optional(),
  traits: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  personalityTraits: z.array(z.string()).optional(),
  backstory: z.string().optional(),
  appearance: z.string().optional(),
  goals: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  quirks: z.array(z.string()).optional(),
  // Extended fields are z.any() to avoid over-constraining the complex nested types
  psychologicalProfile: z.any().optional(),
  coreIdentity: z.any().optional(),
  formativeExperiences: z.any().optional(),
  relationshipStyle: z.any().optional(),
  behavioralPatterns: z.any().optional(),
  voiceProfile: z.any().optional(),
  innerConflicts: z.array(z.string()).optional(),
  arcPotential: z.any().optional(),
  teachingStyle: z.any().optional(),
});

export const BookProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  synopsis: z.string(),
  style: ArtStyleSchema,
  tone: BookToneSchema,
  targetAudience: z.string(),
  isBranching: z.boolean(),
  storyBible: z.any().optional(),
  lastBibleUpdate: z.number().optional(),
  brandProfile: BrandProfileSchema.optional(),
  chapters: z.array(ChapterSchema),
  characters: z.array(CharacterSchema),
  metadata: z.any().optional(),
  decisionTree: z.any().optional(),
  backMatter: z.any().optional(),
  seriesInfo: z.any().optional(),
  learningConfig: LearningConfigSchema.optional(),
  coverImage: z.string().optional(),
  aiImagesGenerated: z.number().optional(),
  createdAt: z.any(), // Date or string
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAMIFICATION (mirror types.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const BadgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  unlocked: z.boolean(),
});

export const ChallengeSchema = z.object({
  id: z.string(),
  title: z.string(),
  xpReward: z.number(),
  completed: z.boolean(),
});

export const GamificationStateSchema = z.object({
  level: z.number(),
  levelTitle: z.string(),
  currentXP: z.number(),
  nextLevelXP: z.number(),
  badges: z.array(BadgeSchema),
  dailyChallenges: z.array(ChallengeSchema),
  booksCreatedCount: z.number(),
  currentStreak: z.number().optional(),
  lastActivityDate: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// QA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const QualityMetricsSchema = z.object({
  readability: z.number().min(0).max(100),
  grammar: z.number().min(0).max(100),
  coherence: z.number().min(0).max(100),
  ageAppropriateness: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const WorkflowProgressEventSchema = z.object({
  phase: z.enum([
    'blueprint',
    'approval',
    'characters',
    'style',
    'writing',
    'illustrating',
    'qa',
    'saving',
    'complete',
  ]),
  percent: z.number().min(0).max(100),
  message: z.string().optional(),
  data: z.any().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LIMITS (mirror services/tierLimits.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const TierLimitsSchema = z.object({
  ebooksPerMonth: z.number(),
  maxPagesPerBook: z.number(),
  maxIllustrationsPerBook: z.number(),
  hasWatermark: z.boolean(),
  hasCommercialLicense: z.boolean(),
  teamSeats: z.number(),
  allowedStyles: z.array(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS (inferred from Zod schemas)
// ═══════════════════════════════════════════════════════════════════════════════

export type ContentStructureZ = z.infer<typeof ContentStructureSchema>;
export type CharacterSheetZ = z.infer<typeof CharacterSheetSchema>;
export type StyleGuideZ = z.infer<typeof StyleGuideSchema>;
export type GenerationSettingsZ = z.infer<typeof GenerationSettingsSchema>;
export type BookProjectZ = z.infer<typeof BookProjectSchema>;
export type GamificationStateZ = z.infer<typeof GamificationStateSchema>;
export type QualityMetricsZ = z.infer<typeof QualityMetricsSchema>;
export type WorkflowProgressEventZ = z.infer<typeof WorkflowProgressEventSchema>;
