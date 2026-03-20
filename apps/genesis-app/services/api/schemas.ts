/**
 * @module ApiSchemas
 * @description Zod validation schemas for all API operations
 *
 * ENFORCEMENT: All API inputs MUST be validated against these schemas.
 * Add new schemas here as you add new API operations.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/** UUID format */
export const UuidSchema = z.string().uuid('Invalid ID format');

/** Pagination parameters */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

/** Sort parameters */
export const SortSchema = z.object({
  field: z.string().max(50),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

/** Date range for filters */
export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ============================================================================
// SECURITY SANITIZATION SCHEMAS
// ============================================================================

/** Safe string - no script tags, SQL keywords, path traversal */
const dangerousPatterns = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /UNION\s+SELECT/i,
  /DROP\s+TABLE/i,
  /\.\.\//,
];

export const SafeStringSchema = z
  .string()
  .refine((val) => !dangerousPatterns.some((pattern) => pattern.test(val)), {
    message: 'Input contains potentially dangerous content',
  });

/** Safe text for titles, names (no HTML, limited length) */
export const TitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(200, 'Title must be less than 200 characters')
  .refine((val) => !/<[^>]*>/.test(val), { message: 'HTML is not allowed in titles' });

/** Safe text for longer content */
export const ContentSchema = z
  .string()
  .max(100000, 'Content is too long')
  .refine((val) => !/<script/i.test(val), { message: 'Script tags are not allowed' });

/** Email validation */
export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email is too long')
  .toLowerCase();

/** URL validation */
export const UrlSchema = z
  .string()
  .url('Invalid URL format')
  .refine((val) => val.startsWith('https://') || val.startsWith('http://'), {
    message: 'URL must use HTTP or HTTPS protocol',
  })
  .refine((val) => !val.includes('javascript:'), { message: 'JavaScript URLs are not allowed' });

// ============================================================================
// BOOK SCHEMAS
// ============================================================================

export const BookChapterSchema = z.object({
  id: z.string(),
  title: TitleSchema,
  content: ContentSchema,
  order: z.number().int().min(0),
});

export const BookProjectSchema = z.object({
  title: TitleSchema,
  synopsis: ContentSchema.optional(),
  genre: z.string().max(50).optional(),
  targetAudience: z.string().max(100).optional(),
  chapters: z.array(BookChapterSchema).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const CreateBookSchema = z.object({
  title: TitleSchema,
  synopsis: ContentSchema.optional(),
  coverImage: UrlSchema.optional(),
  project: BookProjectSchema,
});

export const UpdateBookSchema = z.object({
  id: UuidSchema,
  title: TitleSchema.optional(),
  synopsis: ContentSchema.optional(),
  coverImage: UrlSchema.optional().nullable(),
  project: BookProjectSchema.optional(),
});

export const BookQuerySchema = z.object({
  userId: UuidSchema.optional(),
  search: SafeStringSchema.max(100).optional(),
  pagination: PaginationSchema.optional(),
  sort: SortSchema.optional(),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserProfileSchema = z.object({
  id: UuidSchema,
  displayName: TitleSchema.max(100).optional(),
  bio: ContentSchema.max(500).optional(),
  avatarUrl: UrlSchema.optional().nullable(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateProfileSchema = z.object({
  displayName: TitleSchema.max(100).optional(),
  bio: ContentSchema.max(500).optional(),
  avatarUrl: UrlSchema.optional().nullable(),
});

// ============================================================================
// SHARING SCHEMAS
// ============================================================================

export const ShareSettingsSchema = z.object({
  bookId: UuidSchema,
  isPublic: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  allowRemix: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const CreateShareLinkSchema = z.object({
  bookId: UuidSchema,
  permissions: z.enum(['view', 'comment', 'edit']).default('view'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// ============================================================================
// COLLABORATION SCHEMAS
// ============================================================================

export const CollaboratorSchema = z.object({
  userId: UuidSchema,
  bookId: UuidSchema,
  role: z.enum(['viewer', 'commenter', 'editor', 'owner']),
});

export const InviteCollaboratorSchema = z.object({
  bookId: UuidSchema,
  email: EmailSchema,
  role: z.enum(['viewer', 'commenter', 'editor']),
  message: ContentSchema.max(500).optional(),
});

// ============================================================================
// AI GENERATION SCHEMAS
// ============================================================================

export const GenerationRequestSchema = z.object({
  prompt: ContentSchema.max(10000),
  genre: z.string().max(50).optional(),
  style: z.string().max(100).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(8000).optional(),
});

export const ChapterGenerationSchema = z.object({
  bookId: UuidSchema,
  chapterNumber: z.number().int().min(1),
  prompt: ContentSchema.max(5000).optional(),
  previousContext: ContentSchema.max(10000).optional(),
});

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const UserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      profileVisible: z.boolean().optional(),
      showActivity: z.boolean().optional(),
    })
    .optional(),
  editor: z
    .object({
      fontSize: z.number().min(8).max(32).optional(),
      fontFamily: z.string().max(50).optional(),
      lineHeight: z.number().min(1).max(3).optional(),
      autoSave: z.boolean().optional(),
      autoSaveInterval: z.number().min(5000).max(300000).optional(),
    })
    .optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const SubscriptionSchema = z.object({
  planId: z.string().max(50),
  interval: z.enum(['monthly', 'yearly']),
});

export const PaymentMethodSchema = z.object({
  type: z.enum(['card', 'bank']),
  token: z.string().max(500),
});

// ============================================================================
// EXPORT ALL SCHEMAS FOR TYPE INFERENCE
// ============================================================================

export type CreateBook = z.infer<typeof CreateBookSchema>;
export type UpdateBook = z.infer<typeof UpdateBookSchema>;
export type BookQuery = z.infer<typeof BookQuerySchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ShareSettings = z.infer<typeof ShareSettingsSchema>;
export type CreateShareLink = z.infer<typeof CreateShareLinkSchema>;
export type Collaborator = z.infer<typeof CollaboratorSchema>;
export type InviteCollaborator = z.infer<typeof InviteCollaboratorSchema>;
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
export type ChapterGeneration = z.infer<typeof ChapterGenerationSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
