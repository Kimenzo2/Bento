/**
 * Lean book-generation workflow for Genesis.
 *
 * Architecture:
 * 1. Validate request and enforce tier limits server-side
 * 2. Generate the full book in one Gemini call for consistency
 * 3. Generate illustrations server-side with bounded, sequential execution
 * 4. Persist the exact BookProject shape used by the frontend
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  BookProjectSchema,
  GenerationSettingsSchema,
  UserTierSchema,
} from '../schemas';
import { db } from '../db';

const GEMINI_MODEL = 'gemini-2.0-flash';
const BYTEZ_IMAGE_MODEL = 'google/imagen-4.0-generate-001';
const WORKFLOW_CANCELLED = 'WORKFLOW_CANCELLED';

const cancelledWorkflowIds = new Set<string>();

export function cancelBookGenerationWorkflow(workflowId: string): boolean {
  cancelledWorkflowIds.add(workflowId);
  return true;
}

export function releaseBookGenerationWorkflow(workflowId: string): void {
  cancelledWorkflowIds.delete(workflowId);
}

function assertWorkflowActive(workflowId: string): void {
  if (cancelledWorkflowIds.has(workflowId)) {
    throw new Error(WORKFLOW_CANCELLED);
  }
}

const WorkflowInputSchema = z.object({
  settings: GenerationSettingsSchema,
  userId: z.string(),
  userTier: UserTierSchema,
  workflowId: z.string(),
});

const WorkflowOutputSchema = z.object({
  bookId: z.string(),
  success: z.boolean(),
  saved: z.boolean().optional(),
  error: z.string().optional(),
  videoReady: z.boolean(),
  message: z.string().optional(),
  project: BookProjectSchema.optional(),
});

const BaseStateSchema = z.object({
  settings: GenerationSettingsSchema,
  userId: z.string(),
  workflowId: z.string(),
});

const WorkingStateSchema = BaseStateSchema.extend({
  project: BookProjectSchema.optional(),
  saved: z.boolean().optional(),
});

const GeneratedPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  imagePrompt: z.string().min(1),
  layoutType: z
    .enum([
      'full-bleed',
      'split-horizontal',
      'split-vertical',
      'text-only',
      'image-only',
      'learning-break',
      'learning-only',
    ])
    .optional(),
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
  vocabularyWords: z
    .array(
      z.object({
        word: z.string(),
        definition: z.string(),
      })
    )
    .optional(),
  choices: z
    .array(
      z.object({
        text: z.string(),
        targetPageNumber: z.number().int().positive(),
      })
    )
    .optional(),
});

const GeneratedCharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  description: z.string().min(1),
  visualPrompt: z.string().optional(),
  visualTraits: z.string().optional(),
  traits: z.array(z.string()).optional(),
});

const GeneratedBookPayloadSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().min(1),
  metadata: z.any().optional(),
  decisionTree: z.any().optional(),
  backMatter: z.any().optional(),
  seriesInfo: z.any().optional(),
  characters: z.array(GeneratedCharacterSchema).optional().default([]),
  pages: z.array(GeneratedPageSchema).min(1),
});

type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
type WorkingState = z.infer<typeof WorkingStateSchema>;
type GeneratedBookPayload = z.infer<typeof GeneratedBookPayloadSchema>;

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}

function parseGeneratedPayload(text: string): GeneratedBookPayload {
  const candidate = extractJsonCandidate(text)
    .replace(/\u0000/g, '')
    .replace(/,\s*([}\]])/g, '$1');

  return GeneratedBookPayloadSchema.parse(JSON.parse(candidate));
}

function buildGenerationPrompt(settings: WorkflowInput['settings']): string {
  const isBrandContent = Boolean(settings.brandStoryConfig?.companyInfo?.name);
  const teacherContext = settings.teacherCharacter
    ? [
        `Teacher character name: ${settings.teacherCharacter.name}`,
        `Teacher character description: ${settings.teacherCharacter.description}`,
        `Teacher character visual prompt: ${settings.teacherCharacter.visualPrompt ?? settings.teacherCharacter.visualTraits}`,
      ].join('\n')
    : 'No teacher character provided.';

  const brandProfileContext = settings.brandProfile
    ? [
        `Brand name: ${settings.brandProfile.name}`,
        `Brand guidelines: ${settings.brandProfile.guidelines}`,
        `Brand colors: ${settings.brandProfile.colors.join(', ')}`,
        `Brand sample text: ${settings.brandProfile.sampleText}`,
      ].join('\n')
    : 'No brand profile provided.';

  const brandStoryContext = settings.brandStoryConfig
    ? JSON.stringify(settings.brandStoryConfig, null, 2)
    : 'None';

  const learningContext = settings.educational && settings.learningConfig
    ? JSON.stringify(settings.learningConfig, null, 2)
    : 'None';

  const templateContext = settings.templateStructure?.length
    ? JSON.stringify(settings.templateStructure, null, 2)
    : 'None';

  return [
    'You are Genesis, a production-grade illustrated book generator.',
    'Return valid JSON only. No markdown. No prose outside JSON.',
    '',
    'Create a complete project in one pass so character voice, visual style, and story continuity stay consistent across every page.',
    '',
    'Requirements:',
    `- Generate exactly ${settings.pageCount} pages.`,
    `- Audience: ${settings.audience}`,
    `- Tone: ${settings.tone}`,
    `- Art style: ${settings.style}`,
    `- Branching: ${settings.isBranching ? 'yes' : 'no'}`,
    `- Educational mode: ${settings.educational ? 'yes' : 'no'}`,
    `- Content mode: ${isBrandContent ? 'brand-content' : 'storybook'}`,
    '',
    'Consistency rules:',
    '- Define every main character once in the characters array.',
    '- Each character must include a precise visualPrompt that never changes.',
    '- Every page imagePrompt must explicitly restate the exact visualPrompt text for any character present on that page.',
    '- Maintain the same world, tone, stakes, and design language from page 1 to the end.',
    '- Page text must be complete, polished, and publishable.',
    '',
    'JSON contract:',
    '{',
    '  "title": "string",',
    '  "synopsis": "string",',
    '  "metadata": {',
    '    "title": "string",',
    '    "synopsis": "string",',
    '    "ageRange": "string",',
    '    "genre": "string",',
    '    "pageCount": number,',
    '    "artStyle": "string",',
    '    "features": ["string"],',
    '    "language": "en"',
    '  },',
    '  "characters": [',
    '    {',
    '      "name": "string",',
    '      "role": "string",',
    '      "description": "string",',
    '      "visualPrompt": "string",',
    '      "traits": ["string"]',
    '    }',
    '  ],',
    '  "pages": [',
    '    {',
    '      "pageNumber": 1,',
    '      "text": "string",',
    '      "imagePrompt": "string",',
    '      "layoutType": "split-horizontal",',
    '      "narrationNotes": { "tone": "string", "pacing": "string", "emotion": "string" },',
    '      "learningMoment": { "concept": "string", "content": "string", "answer": "string" },',
    '      "learningContent": {},',
    '      "vocabularyWords": [{ "word": "string", "definition": "string" }],',
    '      "choices": [{ "text": "string", "targetPageNumber": 2 }]',
    '    }',
    '  ],',
    '  "decisionTree": {},',
    '  "backMatter": {},',
    '  "seriesInfo": {}',
    '}',
    '',
    'Input context:',
    `Prompt: ${settings.prompt}`,
    `Teacher context:\n${teacherContext}`,
    `Brand profile context:\n${brandProfileContext}`,
    `Brand story config:\n${brandStoryContext}`,
    `Learning config:\n${learningContext}`,
    `Template structure:\n${templateContext}`,
  ].join('\n');
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY_1;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_1 is not configured.');
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    return (
      payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ??
      ''
    );
  } finally {
    clearTimeout(deadline);
  }
}

async function callBytez(prompt: string): Promise<string | null> {
  const apiKey = process.env.BYTEZ_API_KEY_1;
  if (!apiKey) {
    return null;
  }

  const response = await fetch('https://api.bytez.com/models/v2/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      model: BYTEZ_IMAGE_MODEL,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bytez request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload?.imageUrl ?? payload?.output?.[0] ?? null;
}

function normalizeProject(
  payload: GeneratedBookPayload,
  settings: WorkflowInput['settings'],
  workflowId: string
): z.infer<typeof BookProjectSchema> {
  const sortedPages = [...payload.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  if (sortedPages.length < settings.pageCount) {
    throw new Error(`Model returned ${sortedPages.length} pages, expected ${settings.pageCount}.`);
  }

  const pages = sortedPages.slice(0, settings.pageCount).map((page, index) => ({
    id: crypto.randomUUID(),
    pageNumber: index + 1,
    text: page.text.trim(),
    imagePrompt: page.imagePrompt.trim(),
    layoutType: page.layoutType ?? 'split-horizontal',
    narrationNotes: page.narrationNotes,
    interactiveElement: page.interactiveElement,
    learningContent: page.learningContent,
    learningMoment: page.learningMoment,
    vocabularyWords: page.vocabularyWords,
    choices: page.choices,
  }));

  const features = [
    settings.isBranching ? 'branching-story' : 'linear-story',
    settings.educational ? 'educational' : 'narrative',
    settings.brandStoryConfig ? 'brand-content' : 'illustrated-book',
  ];

  const project = {
    id: workflowId,
    title: payload.title.trim(),
    synopsis: payload.synopsis.trim(),
    style: settings.style,
    tone: settings.tone,
    targetAudience: settings.brandStoryConfig ? 'Business Professionals' : settings.audience,
    isBranching: settings.isBranching,
    brandProfile: settings.brandProfile,
    learningConfig: settings.learningConfig,
    metadata: payload.metadata ?? {
      title: payload.title.trim(),
      synopsis: payload.synopsis.trim(),
      ageRange: settings.audience,
      genre: settings.brandStoryConfig ? 'Brand Content' : 'Illustrated Story',
      pageCount: settings.pageCount,
      artStyle: settings.style,
      features,
      language: 'en',
    },
    decisionTree: payload.decisionTree,
    backMatter: payload.backMatter,
    seriesInfo: payload.seriesInfo,
    chapters: [
      {
        id: crypto.randomUUID(),
        title: settings.brandStoryConfig ? 'Brand Story' : 'Story',
        pages,
      },
    ],
    characters: payload.characters.map((character) => {
      const visualPrompt =
        character.visualPrompt?.trim() || character.visualTraits?.trim() || character.description.trim();

      return {
        id: crypto.randomUUID(),
        name: character.name.trim(),
        role: character.role,
        description: character.description.trim(),
        visualTraits: visualPrompt,
        visualPrompt,
        traits: character.traits,
      };
    }),
    aiImagesGenerated: 0,
    createdAt: new Date().toISOString(),
  };

  return BookProjectSchema.parse(project);
}

async function generateProjectContent(settings: WorkflowInput['settings'], workflowId: string) {
  const rawText = await callGemini(buildGenerationPrompt(settings));
  const payload = parseGeneratedPayload(rawText);
  return normalizeProject(payload, settings, workflowId);
}

async function persistImageToStorage(
  imageData: string,
  userId: string,
  bookId: string,
  fileName: string
): Promise<string> {
  try {
    // Already a Supabase storage URL — no-op
    if (imageData.includes('/storage/v1/object/public/page-images/')) {
      return imageData;
    }

    let buffer: Buffer;
    let contentType = 'image/png';

    if (imageData.startsWith('data:')) {
      const [header, base64] = imageData.split(',');
      contentType = header.match(/:(.*?);/)?.[1] || 'image/png';
      buffer = Buffer.from(base64, 'base64');
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      const resp = await fetch(imageData);
      if (!resp.ok) return imageData;
      contentType = resp.headers.get('content-type') || 'image/png';
      buffer = Buffer.from(await resp.arrayBuffer());
    } else {
      // Raw base64 without prefix
      try {
        buffer = Buffer.from(imageData, 'base64');
      } catch {
        return imageData;
      }
    }

    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    const path = `${userId}/${bookId}/${fileName}.${ext}`;

    const { error } = await db.storage
      .from('page-images')
      .upload(path, buffer, { upsert: true, contentType });

    if (error) {
      console.error('[bookGenerationWorkflow] Storage upload failed:', error.message);
      return imageData;
    }

    const { data } = db.storage.from('page-images').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[bookGenerationWorkflow] Image persistence error:', err);
    return imageData;
  }
}

async function addIllustrationsToProject(
  project: z.infer<typeof BookProjectSchema>,
  workflowId: string,
  userId: string
): Promise<z.infer<typeof BookProjectSchema>> {
  const clonedProject = structuredClone(project);
  let successCount = 0;

  for (const chapter of clonedProject.chapters) {
    for (const page of chapter.pages) {
      assertWorkflowActive(workflowId);

      if (!page.imagePrompt) {
        continue;
      }

      try {
        const imageUrl = await callBytez(page.imagePrompt);
        if (imageUrl) {
          page.imageUrl = await persistImageToStorage(imageUrl, userId, project.id, `page-${page.pageNumber}`);
          successCount += 1;
        }
      } catch (error) {
        console.error(`[bookGenerationWorkflow] Illustration failed for page ${page.pageNumber}:`, error);
      }
    }
  }

  assertWorkflowActive(workflowId);

  try {
    const coverPrompt = [
      `Book cover for "${clonedProject.title}".`,
      `Style: ${clonedProject.style}.`,
      `Synopsis: ${clonedProject.synopsis}.`,
      ...clonedProject.characters.slice(0, 2).map((character) => character.visualPrompt ?? character.visualTraits),
    ].join(' ');

    const coverImage = await callBytez(coverPrompt);
    if (coverImage) {
      clonedProject.coverImage = await persistImageToStorage(coverImage, userId, project.id, 'cover');
    }
  } catch (error) {
    console.error('[bookGenerationWorkflow] Cover illustration failed:', error);
  }

  clonedProject.aiImagesGenerated = successCount;
  return BookProjectSchema.parse(clonedProject);
}

async function saveProject(project: z.infer<typeof BookProjectSchema>, userId: string): Promise<boolean> {
  const { error } = await db.from('books').upsert(
    {
      id: project.id,
      title: project.title,
      synopsis: project.synopsis,
      cover_image: project.coverImage,
      project_data: project,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[bookGenerationWorkflow] Failed to save book:', error);
    return false;
  }

  return true;
}

const validateRequest = createStep({
  id: 'validateRequest',
  description: 'Enforce server-side tier limits before expensive generation begins.',
  inputSchema: WorkflowInputSchema,
  outputSchema: BaseStateSchema,
  execute: async ({ inputData, bail }) => {
    if (!inputData) {
      return bail({
        bookId: '',
        success: false,
        error: 'Missing workflow input.',
        videoReady: false,
      });
    }

    const { settings, userId, userTier, workflowId } = inputData;

    const tierLimits: Record<WorkflowInput['userTier'], { ebooksPerMonth: number; maxPages: number }> = {
      SPARK: { ebooksPerMonth: 3, maxPages: 4 },
      CREATOR: { ebooksPerMonth: 30, maxPages: 12 },
      STUDIO: { ebooksPerMonth: Number.POSITIVE_INFINITY, maxPages: 500 },
      EMPIRE: { ebooksPerMonth: Number.POSITIVE_INFINITY, maxPages: 999 },
    };

    const limits = tierLimits[userTier] ?? tierLimits.SPARK;

    if (settings.pageCount > limits.maxPages) {
      return bail({
        bookId: workflowId,
        success: false,
        error: 'PAGE_LIMIT_EXCEEDED',
        videoReady: false,
        message: `Your tier supports up to ${limits.maxPages} pages per book.`,
      });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await db
      .from('books')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString());

    if (error) {
      console.error('[bookGenerationWorkflow] Failed to query monthly usage:', error);
    }

    if ((count ?? 0) >= limits.ebooksPerMonth) {
      return bail({
        bookId: workflowId,
        success: false,
        error: 'TIER_LIMIT_EXCEEDED',
        videoReady: false,
        message: `Monthly ebook limit reached (${limits.ebooksPerMonth}).`,
      });
    }

    return {
      settings,
      userId,
      workflowId,
    };
  },
});

const generateProject = createStep({
  id: 'generateProject',
  description: 'Generate the complete BookProject in one model call.',
  inputSchema: BaseStateSchema,
  outputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
  }),
  execute: async ({ inputData, bail }) => {
    try {
      assertWorkflowActive(inputData.workflowId);
      const project = await generateProjectContent(inputData.settings, inputData.workflowId);
      assertWorkflowActive(inputData.workflowId);

      return {
        ...inputData,
        project,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Book generation failed.';
      console.error('[bookGenerationWorkflow] generateProject failed:', error);
      return bail({
        bookId: inputData.workflowId,
        success: false,
        error: message,
        videoReady: false,
      });
    }
  },
});

const generateIllustrations = createStep({
  id: 'generateIllustrations',
  description: 'Generate page and cover images server-side. Missing image credentials degrade gracefully.',
  inputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
  }),
  outputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
  }),
  execute: async ({ inputData, bail }) => {
    try {
      assertWorkflowActive(inputData.workflowId);
      const project = await addIllustrationsToProject(inputData.project, inputData.workflowId, inputData.userId);
      assertWorkflowActive(inputData.workflowId);

      return {
        ...inputData,
        project,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Illustration generation failed.';
      if (message === WORKFLOW_CANCELLED) {
        return bail({
          bookId: inputData.workflowId,
          success: false,
          error: WORKFLOW_CANCELLED,
          videoReady: false,
          message: 'Book generation cancelled.',
        });
      }

      console.error('[bookGenerationWorkflow] generateIllustrations failed:', error);
      return {
        ...inputData,
      };
    }
  },
});

const persistBook = createStep({
  id: 'persistBook',
  description: 'Persist the final BookProject to the same storage model used by the frontend.',
  inputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
  }),
  outputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
    saved: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const saved = await saveProject(inputData.project, inputData.userId);

    if (saved) {
      try {
        await db.rpc('award_xp', {
          p_user_id: inputData.userId,
          p_action_name: 'book_created',
          p_metadata: {
            bookId: inputData.project.id,
            pageCount: inputData.project.chapters.flatMap((chapter) => chapter.pages).length,
          },
        });
      } catch (error) {
        console.warn('[bookGenerationWorkflow] XP award failed:', error);
      }
    }

    return {
      ...inputData,
      saved,
    };
  },
});

const finalizeGeneration = createStep({
  id: 'finalizeGeneration',
  description: 'Emit the client-facing workflow result and clean up workflow-local state.',
  inputSchema: WorkingStateSchema.extend({
    project: BookProjectSchema,
    saved: z.boolean(),
  }),
  outputSchema: WorkflowOutputSchema,
  execute: async ({ inputData }) => {
    releaseBookGenerationWorkflow(inputData.workflowId);

    return {
      bookId: inputData.project.id,
      success: true,
      saved: inputData.saved,
      videoReady: false,
      message: inputData.saved
        ? 'Book generation complete.'
        : 'Book generated, but it could not be saved automatically.',
      project: inputData.project,
    };
  },
});

export const bookGenerationWorkflow = createWorkflow({
  id: 'bookGeneration',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  retryConfig: {
    attempts: 2,
    delay: 1500,
  },
})
  .then(validateRequest)
  .then(generateProject)
  .then(generateIllustrations)
  .then(persistBook)
  .then(finalizeGeneration)
  .commit();
