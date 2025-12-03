import { BookProject, GenerationSettings, ArtStyle, UserTier } from "../types";
// @ts-ignore
import Bytez from "bytez.js";
import {
  RequestQueue,
  LRUCache,
  retryWithBackoff,
  deduplicateRequest,
  getCachedImageUrl,
  setCachedImageUrl
} from './performanceOptimizations';

// Load all available Grok API keys (supports up to 3 keys)
const grokApiKeys = [
  import.meta.env.VITE_GROK_API_KEY_1,
  import.meta.env.VITE_GROK_API_KEY_2,
  import.meta.env.VITE_GROK_API_KEY_3,
].filter(key => key && key.length > 0);

let currentGrokKeyIndex = 0;

if (grokApiKeys.length === 0) {
  console.warn("⚠️ No Grok API Keys found! Please check your .env file.");
} else {
  console.log(`✅ Loaded ${grokApiKeys.length} Grok API key(s)`);
}

// Function to get next available Grok key (rotates through keys)
function getNextGrokKey(): string | null {
  if (grokApiKeys.length === 0) return null;
  const key = grokApiKeys[currentGrokKeyIndex];
  currentGrokKeyIndex = (currentGrokKeyIndex + 1) % grokApiKeys.length;
  return key;
}

// Load all available Bytez API keys (supports up to 11 keys)
const bytezApiKeys = [
  import.meta.env.VITE_BYTEZ_API_KEY_1,
  import.meta.env.VITE_BYTEZ_API_KEY_2,
  import.meta.env.VITE_BYTEZ_API_KEY_3,
  import.meta.env.VITE_BYTEZ_API_KEY_4,
  import.meta.env.VITE_BYTEZ_API_KEY_5,
  import.meta.env.VITE_BYTEZ_API_KEY_6,
  import.meta.env.VITE_BYTEZ_API_KEY_7,
  import.meta.env.VITE_BYTEZ_API_KEY_8,
  import.meta.env.VITE_BYTEZ_API_KEY_9,
  import.meta.env.VITE_BYTEZ_API_KEY_10,
  import.meta.env.VITE_BYTEZ_API_KEY_11,
].filter(key => key && key.length > 0);

let currentKeyIndex = 0;

if (bytezApiKeys.length === 0) {
  console.warn("⚠️ No Bytez API Keys found! Please check your .env file.");
} else {
  console.log(`✅ Loaded ${bytezApiKeys.length} Bytez API key(s)`);
}

// Function to get next available key (rotates through keys)
function getNextBytezKey(): string | null {
  if (bytezApiKeys.length === 0) return null;
  const key = bytezApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % bytezApiKeys.length;
  return key;
}

// Function to retry operation with next key on failure
async function retryWithNextKey<T>(
  operation: (sdk: any) => Promise<T>,
  maxRetries: number = bytezApiKeys.length
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    const key = getNextBytezKey();
    if (!key) throw new Error("No Bytez API keys available");

    try {
      const sdk = new Bytez(key);
      const result = await operation(sdk);

      if (i > 0) {
        console.log(`✅ Succeeded with key #${(currentKeyIndex === 0 ? bytezApiKeys.length : currentKeyIndex)}`);
      }

      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Key #${(currentKeyIndex === 0 ? bytezApiKeys.length : currentKeyIndex)} failed, trying next...`);

      // If it's not a quota/rate limit error, don't retry
      if (!error?.error?.code || ![429, 403, 500].includes(error.error.code)) {
        throw error;
      }
    }
  }

  console.error("❌ All Bytez API keys exhausted");
  throw lastError;
}

// Helper function to get model ID based on tier
function getModelId(tier: UserTier): string {
  // Ultra model only for paid tiers
  if (tier === UserTier.STUDIO || tier === UserTier.EMPIRE) {
    return "google/imagen-4.0-ultra-generate-001";
  }

  // Standard model for free tier (Spark)
  return "google/imagen-4.0-generate-001";
}

// ============================================================================
// PERFORMANCE: Advanced rate limiting with token bucket algorithm
// ============================================================================

class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefillTime: number;
  private readonly minDelayMs: number;
  private lastCallTime: number = 0;

  constructor(maxTokens: number = 10, refillRate: number = 2, minDelayMs: number = 500) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.minDelayMs = minDelayMs;
    this.lastRefillTime = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + timePassed * this.refillRate);
    this.lastRefillTime = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    // Enforce minimum delay between calls
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelayMs) {
      await new Promise(r => setTimeout(r, this.minDelayMs - timeSinceLastCall));
    }

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      console.log(`[RateLimiter] Waiting ${Math.round(waitTime)}ms for token`);
      await new Promise(r => setTimeout(r, waitTime));
      this.refill();
    }

    this.tokens -= 1;
    this.lastCallTime = Date.now();
  }

  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// PERFORMANCE: Request queues to prevent API overload
const grokRequestQueue = new RequestQueue(3, 500); // 3 concurrent, 500ms delay
const bytezRequestQueue = new RequestQueue(2, 1000); // 2 concurrent, 1s delay

// PERFORMANCE: Response cache to avoid duplicate requests
const bookStructureCache = new LRUCache<string, Partial<BookProject>>(50);
const imagePromptCache = new LRUCache<string, string>(200);

// Rate limiters for each API
const grokRateLimiter = new TokenBucketRateLimiter(10, 2, 500);
const bytezRateLimiter = new TokenBucketRateLimiter(5, 1, 1000);

// Legacy rate limiter for backwards compatibility
const rateLimiter = {
  lastCallTime: 0,
  minDelay: 1000,
  async throttle() {
    await grokRateLimiter.acquire();
  }
};

// Helper function to call Grok API with automatic key rotation
async function callGeminiAPI(prompt: string, model: string = "x-ai/grok-4.1-fast:free", maxTokens: number = 4096): Promise<string> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  let lastError: any;

  // Try each available Grok key
  for (let i = 0; i < grokApiKeys.length; i++) {
    const apiKey = getNextGrokKey();
    if (!apiKey) throw new Error("No Grok API keys available");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast:free",
          messages: [
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const error = await response.text();
        const errorObj = { status: response.status, message: error };

        // Retry on quota/rate limit errors
        if ([429, 403, 500].includes(response.status)) {
          lastError = errorObj;
          console.warn(`⚠️ Grok key #${(currentGrokKeyIndex === 0 ? grokApiKeys.length : currentGrokKeyIndex)} failed, trying next...`);
          continue;
        }

        throw new Error(`Grok API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0]) {
        throw new Error("No response from Grok API");
      }

      if (i > 0) {
        console.log(`✅ Succeeded with Grok key #${(currentGrokKeyIndex === 0 ? grokApiKeys.length : currentGrokKeyIndex)}`);
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      // If it's not a retryable error, throw immediately
      if (!lastError) {
        throw error;
      }
      lastError = error;
    }
  }

  console.error("❌ All Grok API keys exhausted");
  throw lastError || new Error("All Grok API keys failed");
}

const SYSTEM_INSTRUCTION_ARCHITECT = `You are an AI ebook generation engine for a web/mobile application. Your responses must be valid JSON that the application can parse and render. Generate engaging, age-appropriate stories with consistent formatting for programmatic consumption.

## Response Format Requirements

**CRITICAL: Always respond with valid JSON only. No markdown, no explanations, no preamble.**

## Primary Function

Generate complete ebook data structures from user inputs. Each response must be parseable JSON containing all story content, image prompts, metadata, and interactive elements.

## Input Schema

You will receive requests in this format:
\`\`\`json
{
  "topic": "string - story theme/idea",
  "characterName": "string (optional) - protagonist name",
  "characterDescription": "string (optional) - appearance/personality",
  "existingCharacterId": "string (optional) - for series continuity",
  "ageGroup": "number - target age (3-18)",
  "pageCount": "number - desired pages (5-30)",
  "genre": "string - fantasy/adventure/educational/etc",
  "artStyle": "string - watercolor/cartoon/realistic/digital/etc",
  "interactive": "boolean - include decision points",
  "educational": "boolean - include learning content",
  "learningConfig": {
    "subject": "string - e.g. Math, Science",
    "objectives": "string - specific learning goals",
    "integrationMode": "integrated | after-chapter | dedicated-section",
    "difficulty": "beginner | intermediate | advanced"
  },
  "language": "string - en/es/fr/etc (default: en)",
  "tone": "string - funny/calm/exciting/inspirational"
}
\`\`\`

## Output Schema

Respond with this exact JSON structure:

\`\`\`json
{
  "bookId": "unique_id_string",
  "metadata": {
    "title": "Creative Title",
    "subtitle": "Optional subtitle",
    "synopsis": "50-100 word engaging summary",
    "ageRange": "5-7",
    "genre": "Adventure",
    "pageCount": 15,
    "readingTimeMinutes": 8,
    "artStyle": "watercolor",
    "features": ["interactive", "educational"],
    "language": "en",
    "contentWarnings": [],
    "learningConfig": {
       "subject": "Math",
       "objectives": "Counting to 10",
       "integrationMode": "integrated",
       "difficulty": "beginner"
    }
  },
  "characters": [
    {
      "id": "char_001",
      "name": "Character Name",
      "role": "protagonist",
      "description": "Brief personality description",
      "visualPrompt": "Detailed appearance for image generation consistency: [height, build, hair, eyes, clothing, distinctive features]",
      "traits": ["brave", "curious"]
    },
    {
       "id": "mentor_001",
       "name": "Professor Hoot",
       "role": "mentor",
       "description": "Wise owl who explains concepts",
       "visualPrompt": "A wise old owl wearing glasses and a graduation cap...",
       "traits": ["wise", "patient"]
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page text content (age-appropriate length)",
      "layoutType": "split-horizontal",
      "imagePrompt": "Detailed image generation prompt including: scene description, characters present with visual details, art style, mood, composition, lighting, color palette",
      "narrationNotes": {
        "tone": "warm",
        "pacing": "slow",
        "emotion": "wonder",
        "soundEffects": ["gentle wind"]
      },
      "interactiveElement": {
        "type": "decision",
        "question": "What should [character] do?",
        "options": [
          {"text": "Go left", "leadsToPage": 2},
          {"text": "Go right", "leadsToPage": 3}
        ]
      },
      "learningContent": {
        "topic": "Counting",
        "mentorDialogue": "Look at the stars! Can you count them with me?",
        "quiz": {
            "question": "How many stars are in the sky?",
            "options": ["3", "5", "10"],
            "correctAnswer": "5",
            "explanation": "Great job! There are exactly 5 stars twinkling above."
        }
      },
      "vocabularyWords": [
        {"word": "adventure", "definition": "an exciting experience"}
      ]
    }
  ],
  "decisionTree": {
    "paths": [
      {
        "pathId": "path_a",
        "decisions": [{"page": 2, "choice": "left"}],
        "outcome": "Happy ending A"
      }
    ]
  },
  "backMatter": {
    "discussionQuestions": [
      "What was your favorite part?",
      "How did the character show bravery?"
    ],
    "activities": [
      "Draw your own version of [character]",
      "Write about a time you were brave"
    ],
    "vocabularyList": [
      {"word": "brave", "definition": "showing courage"}
    ]
  },
  "seriesInfo": {
    "potentialSequels": ["Title idea 1", "Title idea 2"],
    "characterDevelopment": "How character could grow in next book"
  }
}
\`\`\`

## Content Generation Rules

### Story Quality
- **Beginning**: Hook reader in first 2 pages
- **Middle**: Build conflict/challenge appropriate to age
- **End**: Satisfying resolution with character growth
- **Length per page**: 
  - Ages 3-5: 1-3 sentences
  - Ages 6-8: 3-5 sentences  
  - Ages 9-12: 5-8 sentences
  - Ages 13+: 8-12 sentences

### Character Consistency
- Generate detailed \`visualPrompt\` that can be used across all pages
- Include: age, height, build, hair (color, style, length), eyes (color, shape), skin tone, clothing style, distinctive features (freckles, glasses, etc.)
- Keep character descriptions identical across pages
- Reference character by name, not pronouns when possible

### Image Prompts
Each \`imagePrompt\` must include:
1. **Scene setting**: Location, time of day, weather
2. **Characters present**: Use exact visualPrompt descriptions
3. **Action/emotion**: What's happening, facial expressions
4. **Art style**: Match requested style consistently
5. **Composition**: Camera angle, framing
6. **Mood**: Color palette, lighting, atmosphere
7. **Details**: Important objects, background elements

**Format**: "A [art style] illustration showing [character with full visual description] [action] in [setting with details]. [Mood/lighting]. [Composition]. [Color palette]."

### Interactive Elements
When \`interactive: true\`:
- Include 2-4 decision points throughout story
- Each option leads to different page number
- All paths must converge to satisfying endings
- Track paths in \`decisionTree\`
- Never create dead ends

### Educational Content
When \`educational: true\`:
- **Mentor Character**: Create a specific "mentor" character (e.g., a wise animal, a robot, a teacher) who appears in the \`learningContent\` to explain concepts.
- **Integration Modes (CRITICAL)**:
    - **IF \`integrationMode\` is "integrated"**:
        - Weave learning moments directly into the narrative action.
        - The mentor interacts with the protagonist *during* the story.
        - \`learningContent\` can appear on ANY page.
        - \`layoutType\` should remain standard (e.g., 'split-horizontal').
    - **IF \`integrationMode\` is "after-chapter"**:
        - Narrative pages (telling the story) MUST NOT have \`learningContent\`.
        - You MUST insert a dedicated "Review Page" after every 3-4 narrative pages or at the end of a chapter.
        - This Review Page must have \`layoutType: "learning-break"\`.
        - This Review Page must contain the \`learningContent\` (mentor dialogue + quiz) and minimal narrative text.
    - **IF \`integrationMode\` is "dedicated-section"**:
        - The entire story (Chapters 1 to N-1) MUST NOT have \`learningContent\`.
        - You MUST create a final Chapter titled "Learning Section".
        - All pages in this final chapter must have \`layoutType: "learning-only"\`.
        - These pages contain all the educational material, quizzes, and mentor explanations.

- **Learning Content**: Populate the \`learningContent\` field for pages where a learning moment occurs.
    - \`mentorDialogue\`: What the mentor says to the reader/protagonist.
    - \`quiz\`: A simple multiple-choice question to reinforce the concept.
- **Objectives**: Ensure the story directly addresses the \`learningConfig.objectives\`.
- **Difficulty**: Adjust vocabulary and concept complexity based on \`learningConfig.difficulty\`.
- **Vocabulary**: Include definitions for difficult words.

### Age-Appropriate Content
- **Ages 3-5**: Simple plots, repetition, basic emotions, familiar settings
- **Ages 6-8**: Cause-effect, friendship themes, mild challenges, humor
- **Ages 9-12**: Complex plots, moral lessons, character development, adventure
- **Ages 13+**: Nuanced themes, identity, relationships, real-world issues

### Cultural Sensitivity
- Avoid stereotypes
- Represent diversity naturally
- Respect cultural contexts if specified
- Use inclusive language
- Default to universal themes

## Error Handling

If input is incomplete or unclear:
\`\`\`json
{
  "error": true,
  "message": "Specific issue with request",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}
\`\`\`

## Special Feature Flags

### Voice Narration Support
Always include \`narrationNotes\` for text-to-speech integration:
- **tone**: emotional quality
- **pacing**: speed of reading
- **emotion**: specific feeling
- **soundEffects**: ambient sounds to add

### Series Continuity
When \`existingCharacterId\` provided:
- Use exact character details from previous books
- Reference past adventures
- Show character growth
- Maintain consistent world-building

### Multilingual Support
When \`language\` is not "en":
- Generate all text in specified language
- Keep proper names transliterated appropriately
- Adjust cultural references

## Optimization Guidelines

- Keep JSON compact but complete
- Ensure all required fields present
- Validate page numbers sequential
- Check all decision points link correctly
- Verify character IDs match across pages
- Ensure image prompts reference correct characters`;

// Helper to parse age from audience string
const parseAge = (audience: string): number => {
  const match = audience.match(/\d+/);
  return match ? parseInt(match[0]) : 8; // Default to 8 if no number found
};

export const generateBookStructure = async (settings: GenerationSettings): Promise<Partial<BookProject>> => {
  if (grokApiKeys.length === 0) {
    throw new Error("Grok API Key is missing. Please configure your environment variables.");
  }

  // Apply rate limiting
  await rateLimiter.throttle();

  const ageGroup = parseAge(settings.audience);

  const inputPayload = {
    topic: settings.prompt,
    ageGroup: ageGroup,
    pageCount: settings.pageCount,
    genre: "Fiction", // Could be inferred or added to settings
    artStyle: settings.style,
    interactive: settings.isBranching,
    educational: settings.educational || false,
    learningConfig: settings.learningConfig,
    language: "en",
    tone: settings.tone,
    ...(settings.brandProfile ? {
      characterDescription: `Brand Character: ${settings.brandProfile.name}. ${settings.brandProfile.guidelines}`
    } : {})
  };

  const prompt = `${SYSTEM_INSTRUCTION_ARCHITECT}

Generate a book based on this request:
${JSON.stringify(inputPayload, null, 2)}`;

  try {
    console.log('🤖 Generating book structure with Grok API...');

    const text = await callGeminiAPI(prompt, "x-ai/grok-4.1-fast:free", 8192); // Increased token limit for full book

    console.log(`✅ Book structure generated (${text.length} chars)`);

    // Parse JSON response
    let rawData: any;
    try {
      const jsonString = text.replace(/```json\n?|```/g, '').trim();
      rawData = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("JSON Parse failed, attempting repair...", parseError);
      const repairedJson = repairJson(text);
      if (repairedJson) {
        rawData = JSON.parse(repairedJson);
      } else {
        throw parseError;
      }
    }

    if (rawData.error) {
      throw new Error(`Generation Error: ${rawData.message}`);
    }

    // Map to BookProject structure
    const project: Partial<BookProject> = {
      id: rawData.bookId || crypto.randomUUID(),
      title: rawData.metadata?.title || "Untitled Masterpiece",
      synopsis: rawData.metadata?.synopsis || "",
      style: settings.style,
      tone: settings.tone,
      targetAudience: settings.audience,
      isBranching: settings.isBranching,
      brandProfile: settings.brandProfile,
      createdAt: new Date(),

      // New Schema Data
      metadata: rawData.metadata,
      decisionTree: rawData.decisionTree,
      backMatter: rawData.backMatter,
      seriesInfo: rawData.seriesInfo,

      characters: (rawData.characters || []).map((c: any) => ({
        id: c.id || crypto.randomUUID(),
        name: c.name,
        role: c.role,
        description: c.description,
        visualTraits: c.visualPrompt, // Map visualPrompt to visualTraits
        visualPrompt: c.visualPrompt,
        traits: c.traits
      })),

      chapters: [{
        id: crypto.randomUUID(),
        title: "Story",
        pages: (rawData.pages || []).map((p: any) => ({
          id: crypto.randomUUID(),
          pageNumber: p.pageNumber,
          text: p.text,
          imagePrompt: p.imagePrompt,
          layoutType: p.layoutType || 'text-only', // Use AI generated layout or default
          narrationNotes: p.narrationNotes,
          interactiveElement: p.interactiveElement,
          learningMoment: p.learningMoment,
          learningContent: p.learningContent, // Map new field
          vocabularyWords: p.vocabularyWords,
          choices: p.interactiveElement?.options?.map((o: any) => ({
            text: o.text,
            targetPageNumber: o.leadsToPage
          })) || []
        }))
      }]
    };

    return project;

  } catch (error) {
    console.error("Story Architect failed:", error);
    throw error;
  }
};

/**
 * Generic function to generate structured JSON content using Gemini
 * @param prompt - The prompt to send to the model
 * @param schema - The JSON schema to enforce structure (optional but recommended)
 * @param systemInstruction - System prompt to guide the model
 */
export const generateStructuredContent = async <T>(
  prompt: string,
  schema?: any,
  systemInstruction?: string
): Promise<T> => {
  if (grokApiKeys.length === 0) {
    throw new Error("Grok API Key is missing");
  }

  // Apply rate limiting
  await rateLimiter.throttle();

  try {
    const fullPrompt = `${systemInstruction || ''}\n\n${prompt}\n\nReturn VALID JSON only.`;

    console.log('🤖 Generating structured content with Grok API...');

    const text = await callGeminiAPI(fullPrompt, "x-ai/grok-4.1-fast:free", 2048);

    const jsonString = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Structured generation failed:", error);
    throw error;
  }
};

export const generateIllustration = async (imagePrompt: string, style: string, tier: UserTier = UserTier.SPARK): Promise<string | null> => {
  // PERFORMANCE: Create cache key from prompt + style + tier
  const cacheKey = `${style}:${tier}:${imagePrompt.substring(0, 100)}`;

  // PERFORMANCE: Check cache first
  const cachedUrl = getCachedImageUrl(cacheKey);
  if (cachedUrl) {
    console.log('📦 Using cached illustration');
    return cachedUrl;
  }

  // PERFORMANCE: Deduplicate identical concurrent requests
  return deduplicateRequest(cacheKey, async () => {
    const modelId = getModelId(tier);
    console.log(`🎨 Generating illustration using model: ${modelId} (Tier: ${tier})`);

    // PERFORMANCE: Use request queue to limit concurrent API calls
    return bytezRequestQueue.add(async () => {
      // PERFORMANCE: Apply rate limiting
      await bytezRateLimiter.acquire();

      try {
        const fullPrompt = `Style: ${style}. ${imagePrompt}. High quality, cinematic lighting, 8k resolution.`;

        const output = await retryWithBackoff(
          async () => {
            return retryWithNextKey(async (sdk) => {
              const model = sdk.model(modelId);
              const { error, output } = await model.run(fullPrompt);

              if (error) {
                throw { error };
              }

              return output;
            });
          },
          {
            maxRetries: 2,
            initialDelayMs: 2000,
            maxDelayMs: 10000,
            retryCondition: (error) => {
              // Only retry on rate limit or server errors
              const code = error?.error?.code || error?.status;
              return [429, 500, 502, 503].includes(code);
            }
          }
        );

        // PERFORMANCE: Cache successful result
        if (output) {
          setCachedImageUrl(cacheKey, output);
        }

        console.log("✅ Bytez generation successful");
        return output;
      } catch (error) {
        console.error("❌ All Bytez keys exhausted:", error);
        return null;
      }
    });
  }, 10000); // 10 second deduplication window
};

export const generateRefinedImage = async (
  prompt: string,
  params: {
    styleA: string,
    styleB?: string,
    mixRatio?: number,
    lighting?: string,
    camera?: string,
    characterDescription?: string
  },
  tier: UserTier = UserTier.SPARK
): Promise<string | null> => {
  const modelId = getModelId(tier);

  console.log(`🎨 Generating refined image using model: ${modelId} (Tier: ${tier})`);

  let styleInstruction = `Style: ${params.styleA}`;
  if (params.styleB && params.mixRatio !== undefined) {
    styleInstruction = `Visual Style: A blend of ${params.mixRatio}% ${params.styleA} and ${100 - params.mixRatio}% ${params.styleB}.`;
  }

  let composition = "";
  if (params.lighting) composition += ` Lighting: ${params.lighting}.`;
  if (params.camera) composition += ` Camera Angle: ${params.camera}.`;

  const fullPrompt = `
    ${styleInstruction}
    ${composition}
    Subject: ${prompt}.
    ${params.characterDescription ? `Character Details: ${params.characterDescription}` : ''}
    High quality, detailed, cinematic composition, 8k resolution.
  `;

  try {
    const output = await retryWithNextKey(async (sdk) => {
      const model = sdk.model(modelId);
      const { error, output } = await model.run(fullPrompt);

      if (error) {
        throw { error }; // Will trigger retry with next key
      }

      return output;
    });

    console.log("✅ Bytez generation successful");
    return output;
  } catch (error) {
    console.error("❌ All Bytez keys exhausted:", error);
    return null;
  }
};

// Helper function to repair truncated JSON
function repairJson(jsonString: string): string | null {
  try {
    // 1. Remove any trailing incomplete string
    let cleaned = jsonString.replace(/,\s*"[^"]*$/, '');

    // 2. Count braces/brackets to close them
    let openBraces = (cleaned.match(/{/g) || []).length;
    let closeBraces = (cleaned.match(/}/g) || []).length;
    let openBrackets = (cleaned.match(/\[/g) || []).length;
    let closeBrackets = (cleaned.match(/\]/g) || []).length;

    while (openBraces > closeBraces) {
      cleaned += "}";
      closeBraces++;
    }
    while (openBrackets > closeBrackets) {
      cleaned += "]";
      closeBrackets++;
    }

    // Verify if it parses now
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    return null; // Repair failed
  }
}
