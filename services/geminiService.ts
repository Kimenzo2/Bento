import {
  type BookProject,
  type BrandStoryConfig,
  type Character,
  type GenerationSettings,
  UserTier,
} from '../types';
import {
  AGE_CONTENT_MODIFIERS,
  type CharacterReference,
  STYLE_PROMPT_TEMPLATES,
  TIER_QUALITY_CONFIG,
  buildPremiumImagePrompt,
} from './generator/prompts/premiumPrompts';
import {
  LRUCache,
  RequestQueue,
  deduplicateRequest,
  getCachedImageUrl,
  retryWithBackoff,
  setCachedImageUrl,
} from './performanceOptimizations';
import { authenticatedFetch } from './api/authenticatedFetch';

// ============================================================================
// TEXT GENERATION: Routed through server-side /api/ai-generate proxy
// ============================================================================
// API keys are server-side only (GEMINI_API_KEY_1 to _20, no VITE_ prefix)
// Client calls authenticatedFetch → /api/ai-generate → Gemini API
// ============================================================================

// Helper function to get Imagen model ID based on tier (Bytez model names)
function getModelId(tier: UserTier): string {
  // Imagen 4 via Bytez for all tiers
  return 'google/imagen-4.0-generate-001';
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
  private lastCallTime = 0;

  constructor(maxTokens = 10, refillRate = 2, minDelayMs = 500) {
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
      await new Promise((r) => setTimeout(r, this.minDelayMs - timeSinceLastCall));
    }

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      console.log(
        `[RateLimiter] Waiting ${Math.round(waitTime)}ms for token - geminiService.ts:172`
      );
      await new Promise((r) => setTimeout(r, waitTime));
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
const textRequestQueue = new RequestQueue(3, 500); // 3 concurrent, 500ms delay
const imageRequestQueue = new RequestQueue(2, 1000); // 2 concurrent, 1s delay

// PERFORMANCE: Response cache to avoid duplicate requests
const bookStructureCache = new LRUCache<string, Partial<BookProject>>(50);
const imagePromptCache = new LRUCache<string, string>(200);

// Rate limiters for each API
const textRateLimiter = new TokenBucketRateLimiter(10, 2, 500);
const imageRateLimiter = new TokenBucketRateLimiter(5, 1, 1000);

// Legacy rate limiter for backwards compatibility
const rateLimiter = {
  lastCallTime: 0,
  minDelay: 1000,
  async throttle() {
    await textRateLimiter.acquire();
  },
};

const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';

// ============================================================================
// PERSISTENT PROMPT CACHE — localStorage-backed, 7-day TTL
// Every identical book generation prompt is served from cache — zero API calls.
// This is the primary mechanism for preserving the free-tier quota.
// ============================================================================

const PROMPT_CACHE_PREFIX = 'genesis_pc_';
const PROMPT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PROMPT_CACHE_MAX_ENTRIES = 80;

/** Fast djb2 hash → compact base-36 string */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function getPromptCache(key: string): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(PROMPT_CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as { t: string; ts: number };
    if (Date.now() - entry.ts > PROMPT_CACHE_TTL_MS) {
      localStorage.removeItem(PROMPT_CACHE_PREFIX + key);
      return undefined;
    }
    return entry.t;
  } catch { return undefined; }
}

function setPromptCache(key: string, text: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // Evict oldest entries when near capacity
    const stored: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PROMPT_CACHE_PREFIX)) stored.push(k);
    }
    if (stored.length >= PROMPT_CACHE_MAX_ENTRIES) {
      stored.slice(0, stored.length - PROMPT_CACHE_MAX_ENTRIES + 1)
        .forEach((k) => localStorage.removeItem(k));
    }
    localStorage.setItem(
      PROMPT_CACHE_PREFIX + key,
      JSON.stringify({ t: text, ts: Date.now() })
    );
  } catch { /* storage full — silently skip */ }
}

// Helper: call Gemini text generation via the server-side proxy
async function callGeminiAPI(
  prompt: string,
  modelName: string = GEMINI_TEXT_MODEL,
  maxTokens = 4096
): Promise<string> {
  // ── AGGRESSIVE CACHE: check localStorage before touching the API ──────────
  const cacheKey = hashStr(`${modelName}:${maxTokens}:${prompt}`);
  const cached = getPromptCache(cacheKey);
  if (cached) {
    console.log('📦 Gemini cache hit — skipping API call (quota preserved)');
    return cached;
  }

  console.log(`🔄 Calling Gemini API (${modelName}) via proxy...`);
  const res = await authenticatedFetch('/api/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `You are a JSON generator. Always respond with valid JSON only. No markdown code blocks, no explanations, just pure JSON.\n\n${prompt}\n\nRespond with valid JSON only.`,
      model: modelName,
      maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Gemini proxy request failed');
  }

  const data = await res.json();
  if (!data.text) throw new Error('No output received from Gemini API');
  // Persist to localStorage so future identical prompts skip the API entirely
  setPromptCache(cacheKey, data.text);
  console.log('✅ Gemini API response received');
  return data.text;
}

// Helper: call Bytez image generation via the server-side proxy
async function callBytezImageProxy(
  prompt: string,
  modelId: string
): Promise<string | null> {
  console.log(`🎨 Calling Bytez image proxy (${modelId})...`);

  const res = await authenticatedFetch('/api/ai-bytez', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, input: prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Bytez proxy request failed');
  }

  const data = await res.json();
  return data.output ?? null;
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
Generate ULTRA-DETAILED \`visualPrompt\` for each character that ensures visual consistency across ALL pages.

**REQUIRED visualPrompt STRUCTURE:**
\`\`\`
[Name] - [Age] [gender] [role]:
PHYSICAL: [height descriptor], [body build], [posture/stance style]
SKIN: [specific skin tone - e.g., "warm brown", "fair with rosy cheeks", "olive-toned"]
HAIR: [color], [length - short/medium/long], [style - curly/straight/wavy/braided], [distinctive details]
EYES: [color], [shape - round/almond/large], [distinctive - long lashes, glasses, etc.]
FACE: [shape - round/oval/heart], [distinctive features - freckles, dimples, birthmark, etc.]
CLOTHING: [signature outfit with specific colors], [accessories always worn]
DISTINCTIVE: [1-3 unique identifying features that make this character instantly recognizable]
COLOR PALETTE: [3-5 hex codes or color names that define this character's look]
\`\`\`

**EXAMPLE visualPrompt:**
"Maya - 8-year-old girl protagonist:
PHYSICAL: Average height for age, slim athletic build, confident posture
SKIN: Warm medium brown with subtle freckles across nose
HAIR: Dark brown, long (past shoulders), curly/coily texture, always with two bright orange hair ties making high pigtails
EYES: Large expressive dark brown eyes, long lashes, curious sparkle
FACE: Round friendly face, prominent dimples when smiling, small button nose
CLOTHING: Signature purple hoodie with star patches, yellow leggings, red high-top sneakers with white laces
DISTINCTIVE: Orange hair ties, star-patch hoodie, gap in front teeth when smiling
COLOR PALETTE: Purple #7B68EE, Orange #FF8C42, Yellow #FFD93D, Red #FF6B6B"

**CRITICAL RULES:**
- Copy the EXACT visualPrompt into every imagePrompt where the character appears
- Never change hair color, eye color, skin tone, or signature items between pages
- Reference character by name AND visual description in every scene
- Distinctive features (glasses, accessories, hair ties) must appear in EVERY image

### Image Prompts
Each \`imagePrompt\` must be a PREMIUM-QUALITY prompt that will generate professional illustrations.

**REQUIRED STRUCTURE FOR EVERY imagePrompt:**

\`\`\`
[ART STYLE]: [Exact requested style with technical details]

SCENE: [Detailed scene description with setting, time, atmosphere]

CHARACTERS:
- [Character name]: [FULL visual description from their visualPrompt, including age, height, build, skin tone, hair color/style/length, eye color/shape, distinctive features, exact clothing]
- Expression: [Current emotion with specific facial details]
- Pose/Action: [What they're doing]

COMPOSITION:
- Camera: [eye-level / low angle / high angle / wide shot / medium shot / close-up]
- Focal Point: [Where the eye should be drawn]
- Foreground: [Elements in front]
- Midground: [Main action area]  
- Background: [Setting elements]

LIGHTING:
- Type: [natural daylight / golden hour / soft ambient / dramatic / moonlit]
- Direction: [front / side / rim / overhead]
- Mood: [warm / cool / neutral]

COLOR PALETTE:
- Primary: [dominant color]
- Secondary: [supporting colors]
- Accents: [highlight colors]

TECHNICAL QUALITY:
- Ultra-detailed, professional illustration
- Clear character recognition
- Age-appropriate for [target age]
- Print-ready quality

AVOID:
- Text or words in the image
- Cropped characters
- Inconsistent character features
- Busy backgrounds competing with subjects
\`\`\`

**EXAMPLE PREMIUM imagePrompt:**
"STYLE: Watercolor illustration with soft color bleeds, visible paper texture, transparent washes.

SCENE: A magical forest clearing at golden hour, ancient oak trees with glowing fireflies, soft moss-covered ground.

CHARACTERS:
- Luna: 7-year-old girl with medium build, warm brown skin, curly black shoulder-length hair with small yellow flower accessory, large expressive brown eyes with long lashes, round friendly face with dimples, wearing a bright yellow sundress with daisy pattern and green rain boots.
- Expression: Wide-eyed wonder, mouth slightly open in amazement, eyebrows raised.
- Pose: Standing on tiptoes, both hands reaching toward a floating firefly.

COMPOSITION:
- Camera: Eye-level, medium shot
- Focal Point: Luna's face and the firefly she's reaching for
- Foreground: Wildflowers and ferns
- Midground: Luna in the clearing
- Background: Towering oak trees with dappled light

LIGHTING:
- Type: Golden hour sunlight filtering through leaves
- Direction: Side lighting from left, creating warm rim light
- Mood: Warm, magical, inviting

COLOR PALETTE:
- Primary: Warm yellows and soft greens
- Secondary: Earth browns, sky blues peeking through
- Accents: Glowing gold firefly lights

TECHNICAL: Ultra-detailed watercolor, visible brushwork, professional children's book quality, age-appropriate for 6-8."

**Format**: Follow the structured format above for EVERY page. This ensures consistent, professional output.

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

// ============================================================================
// BRAND STORY & ANNUAL REPORT SYSTEM PROMPT
// ============================================================================

const SYSTEM_INSTRUCTION_BRAND = `You are a professional corporate content generator for an enterprise-grade marketing platform. Generate polished, investor-ready content for brand stories, annual reports, company histories, and product launches.

## Response Format Requirements

**CRITICAL: Always respond with valid JSON only. No markdown, no explanations, no preamble.**

## Output Schema

Respond with this exact JSON structure:

\`\`\`json
{
  "bookId": "unique_id_string",
  "metadata": {
    "title": "Company Name - Annual Report 2024",
    "subtitle": "Building Tomorrow, Today",
    "synopsis": "Executive summary of the document (100-200 words)",
    "documentType": "annual-report | brand-story | company-history | product-launch",
    "pageCount": 15,
    "artStyle": "corporate-clean",
    "language": "en"
  },
  "companyProfile": {
    "name": "Company Name",
    "tagline": "Innovation for a Better World",
    "industry": "Technology",
    "founded": "2010",
    "headquarters": "San Francisco, CA",
    "mission": "Our mission statement...",
    "vision": "Our vision for the future...",
    "coreValues": ["Innovation", "Integrity", "Impact"]
  },
  "pages": [
    {
      "pageNumber": 1,
      "sectionType": "cover",
      "title": "Company Name",
      "subtitle": "Annual Report 2024",
      "text": "",
      "layoutType": "full-bleed",
      "imagePrompt": "Professional corporate cover design with [company name] logo, modern gradient background in brand colors, clean typography, premium business aesthetic, 8k quality"
    },
    {
      "pageNumber": 2,
      "sectionType": "ceo-letter",
      "title": "Letter from the CEO",
      "text": "Dear Stakeholders,\\n\\nIt is my pleasure to present our annual report...\\n\\n[2-3 paragraphs of professional CEO letter content]\\n\\nSincerely,\\n[CEO Name]\\nChief Executive Officer",
      "layoutType": "split-horizontal",
      "imagePrompt": "Professional portrait placeholder, modern office setting, warm lighting, executive presence, business formal attire"
    },
    {
      "pageNumber": 3,
      "sectionType": "origin-story",
      "title": "Our Story",
      "text": "Founded in [year], [Company] began with a simple vision...\\n\\n[Compelling narrative of company founding, challenges overcome, and growth]",
      "layoutType": "split-vertical",
      "imagePrompt": "Timeline infographic showing company founding and early milestones, modern design, brand colors, clean typography"
    },
    {
      "pageNumber": 4,
      "sectionType": "mission-values",
      "title": "Mission & Values",
      "text": "Our Mission\\n[Mission statement]\\n\\nOur Core Values\\n• [Value 1]: [Description]\\n• [Value 2]: [Description]\\n• [Value 3]: [Description]",
      "layoutType": "split-horizontal",
      "imagePrompt": "Modern infographic displaying core values with icons, clean corporate design, professional color palette"
    },
    {
      "pageNumber": 5,
      "sectionType": "milestones",
      "title": "Key Milestones",
      "text": "[TIMELINE FORMAT]\\n\\n2010 - Company Founded\\n2012 - First Major Product Launch\\n2015 - Series A Funding\\n2018 - Global Expansion\\n2023 - 10 Million Users Milestone",
      "layoutType": "full-bleed",
      "imagePrompt": "Horizontal timeline infographic with milestone markers, modern design, icons for each achievement, professional corporate style",
      "dataVisualization": {
        "type": "timeline",
        "data": [
          {"year": "2010", "event": "Company Founded"},
          {"year": "2012", "event": "First Major Product Launch"}
        ]
      }
    },
    {
      "pageNumber": 6,
      "sectionType": "achievements",
      "title": "Year in Review",
      "text": "Highlights\\n\\n• [Achievement 1 with metrics]\\n• [Achievement 2 with metrics]\\n• [Achievement 3 with metrics]\\n\\nAwards & Recognition\\n• [Award 1]\\n• [Award 2]",
      "layoutType": "split-horizontal",
      "imagePrompt": "Achievement showcase with trophy icons, metrics cards, growth arrows, modern corporate infographic style"
    },
    {
      "pageNumber": 7,
      "sectionType": "financials",
      "title": "Financial Performance",
      "text": "Revenue Growth\\n$XX Million (+XX% YoY)\\n\\nKey Metrics\\n• Gross Margin: XX%\\n• Customer Retention: XX%\\n• Market Share: XX%",
      "layoutType": "split-vertical",
      "imagePrompt": "Professional financial charts showing revenue growth, bar charts and line graphs, clean data visualization, corporate blue and green colors",
      "dataVisualization": {
        "type": "financial-summary",
        "data": {
          "revenue": "$50M",
          "growth": "+35%",
          "margins": "72%"
        }
      }
    },
    {
      "pageNumber": 8,
      "sectionType": "esg",
      "title": "ESG Commitment",
      "text": "Environmental\\n• [Initiative 1]\\n• [Initiative 2]\\n\\nSocial\\n• [Initiative 1]\\n• [Initiative 2]\\n\\nGovernance\\n• [Practice 1]\\n• [Practice 2]",
      "layoutType": "split-horizontal",
      "imagePrompt": "ESG infographic with environmental, social, and governance icons, green accent colors, sustainability visuals, professional corporate design"
    },
    {
      "pageNumber": 9,
      "sectionType": "team",
      "title": "Leadership Team",
      "text": "[CEO Name]\\nChief Executive Officer\\n\\n[CFO Name]\\nChief Financial Officer\\n\\n[CTO Name]\\nChief Technology Officer",
      "layoutType": "split-vertical",
      "imagePrompt": "Professional headshot grid layout for executives, modern office background, warm lighting, business attire, diverse leadership team"
    },
    {
      "pageNumber": 10,
      "sectionType": "future-outlook",
      "title": "Looking Ahead",
      "text": "Strategic Priorities for [Next Year]\\n\\n1. [Priority 1]\\n2. [Priority 2]\\n3. [Priority 3]\\n\\nOur commitment to innovation and customer success continues to drive our vision for the future.",
      "layoutType": "split-horizontal",
      "imagePrompt": "Futuristic vision graphic with growth trajectory, innovation symbols, forward-looking imagery, modern corporate design, inspiring visual"
    },
    {
      "pageNumber": 11,
      "sectionType": "call-to-action",
      "title": "Join Our Journey",
      "text": "Connect With Us\\n\\n[Website]\\n[LinkedIn]\\n[Contact Email]\\n\\nInvestor Relations\\n[IR Contact]\\n\\n© [Year] [Company Name]. All rights reserved.",
      "layoutType": "full-bleed",
      "imagePrompt": "Professional closing page with contact information layout, QR codes, social media icons, brand colors, clean corporate design"
    }
  ],
  "characters": [],
  "backMatter": {
    "legalDisclaimer": "This document contains forward-looking statements...",
    "contactInfo": {
      "website": "",
      "email": "",
      "phone": "",
      "address": ""
    }
  }
}
\`\`\`

## Content Generation Rules

### Professional Writing Quality
- **Tone**: Match the requested tone (professional, inspiring, conversational, formal, bold)
- **CEO Letter**: 2-3 paragraphs, personal yet professional, highlights key achievements and vision
- **Data Points**: Include specific metrics where provided, or realistic placeholders like "[XX%]"
- **Narrative Flow**: Each section should connect logically to the next

### Visual/Image Prompts for Corporate Content
Each imagePrompt must specify:
1. **Type**: Infographic, chart, photo, or abstract graphic
2. **Style**: Corporate, modern, clean, professional
3. **Colors**: Match brand colors or default to corporate blue/green
4. **Content**: What data or concept to visualize
5. **Quality**: Always include "professional", "high-quality", "8k"

### Section-Specific Guidelines

**CEO Letter**: Personal, visionary, acknowledges challenges and celebrates wins
**Origin Story**: Narrative arc - humble beginnings, obstacles, breakthrough, growth
**Financials**: Clean data visualization, growth focus, key metrics highlighted
**ESG**: Genuine commitments, measurable goals, stakeholder impact
**Future Outlook**: Ambitious yet achievable, innovation-focused, customer-centric

### Layout Types for Corporate
- **full-bleed**: Cover pages, section dividers
- **split-horizontal**: Text left, visual right (or vice versa)
- **split-vertical**: Text top, visual bottom
- **text-only**: CEO letters, detailed narratives
- **image-only**: Full-page infographics, data visualizations`;

// Helper to parse age from audience string
const parseAge = (audience: string): number => {
  const match = audience.match(/\d+/);
  return match ? Number.parseInt(match[0]) : 8; // Default to 8 if no number found
};

// ============================================================================
// CHARACTER TEACHING SYSTEM
// ============================================================================

/**
 * Builds a voice prompt from character's deep psychology for AI generation
 * This transforms character traits into teaching style instructions
 */
export const buildCharacterVoicePrompt = (character: Character): string => {
  const parts: string[] = [];

  // Basic identity
  parts.push(`Character Name: ${character.name}`);
  if (character.role) parts.push(`Role: ${character.role}`);

  // Voice profile - most important for dialogue
  if (character.voiceProfile) {
    parts.push(`\nVOICE STYLE:`);
    parts.push(`- Tone: ${character.voiceProfile.tone}`);
    parts.push(`- Vocabulary Level: ${character.voiceProfile.vocabulary}`);
    if (character.voiceProfile.catchphrases?.length) {
      parts.push(
        `- Signature phrases: "${character.voiceProfile.catchphrases.slice(0, 3).join('", "')}"`
      );
    }
    if (character.voiceProfile.laughStyle) {
      parts.push(`- When happy: ${character.voiceProfile.laughStyle}`);
    }
  }

  // Teaching style if defined
  if (character.teachingStyle) {
    parts.push(`\nTEACHING APPROACH:`);
    parts.push(`- Style: ${character.teachingStyle.teachingApproach}`);
    if (character.teachingStyle.encouragementStyle) {
      parts.push(`- When student is correct: ${character.teachingStyle.encouragementStyle}`);
    }
    if (character.teachingStyle.correctionStyle) {
      parts.push(`- When student makes mistakes: ${character.teachingStyle.correctionStyle}`);
    }
    if (character.teachingStyle.exampleStyle) {
      parts.push(`- Gives examples using: ${character.teachingStyle.exampleStyle}`);
    }
  }

  // Psychology-based teaching adaptations
  if (character.psychologicalProfile) {
    parts.push(`\nPERSONALITY-DRIVEN TEACHING:`);
    const p = character.psychologicalProfile;

    if (p.agreeableness > 70) {
      parts.push(`- Very encouraging and supportive, celebrates every attempt`);
    } else if (p.agreeableness < 40) {
      parts.push(`- Direct and honest, focuses on improvement`);
    }

    if (p.openness > 70) {
      parts.push(`- Uses creative metaphors, analogies, and imaginative examples`);
    }

    if (p.extraversion > 70) {
      parts.push(`- Enthusiastic, energetic, uses exclamations`);
    } else if (p.extraversion < 40) {
      parts.push(`- Calm, thoughtful, creates intimate one-on-one feeling`);
    }

    if (p.neuroticism > 60) {
      parts.push(`- Deeply empathetic, relates to struggles, validates difficulty`);
    }

    if (p.conscientiousness > 70) {
      parts.push(`- Structured, step-by-step explanations`);
    }
  }

  // Core identity for authenticity
  if (character.coreIdentity) {
    parts.push(`\nCORE VALUES IN TEACHING:`);
    if (character.coreIdentity.coreBelief) {
      parts.push(`- Worldview: ${character.coreIdentity.coreBelief}`);
    }
    if (character.coreIdentity.strength) {
      parts.push(`- Greatest strength: ${character.coreIdentity.strength}`);
    }
  }

  // Behavioral patterns for realistic dialogue
  if (character.behavioralPatterns) {
    if (character.behavioralPatterns.speechPatterns) {
      parts.push(`\nSPEECH PATTERNS: ${character.behavioralPatterns.speechPatterns}`);
    }
    if (character.behavioralPatterns.joyTriggers?.length) {
      parts.push(
        `- Gets excited about: ${character.behavioralPatterns.joyTriggers.slice(0, 2).join(', ')}`
      );
    }
  }

  // Quirks for character flavor
  if (character.quirks?.length) {
    parts.push(
      `\nCHARACTER QUIRKS (include naturally): ${character.quirks.slice(0, 3).join('; ')}`
    );
  }

  return parts.join('\n');
};

/**
 * System instruction for AI when generating educational content with character teaching
 */
const SYSTEM_INSTRUCTION_TEACHER = `You are generating educational content delivered by a specific character.
The character should teach concepts IN THEIR UNIQUE VOICE while being embedded naturally in the story.

CRITICAL RULES:
1. The teaching dialogue must sound like THIS CHARACTER speaking, not a generic teacher
2. Use their catchphrases, speech patterns, and personality traits
3. Connect lessons to the character's backstory or experiences when possible
4. Make complex concepts accessible through the character's unique perspective
5. Include the character's quirks and mannerisms in how they explain things

OUTPUT FORMAT for learning moments:
{
  "mentorDialogue": "The character's teaching speech in their voice (2-4 paragraphs)",
  "topic": "The learning topic",
  "keyTakeaway": "One simple sentence summary",
  "characterAction": "What the character does while teaching (gestures, expressions)",
  "quiz": {
    "question": "A fun question in the character's voice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "The correct option text",
    "explanation": "Why this is correct, explained by the character"
  }
}`;

// ============================================================================
// BRAND CONTENT GENERATION FUNCTION
// ============================================================================

export const generateBrandContent = async (
  settings: GenerationSettings,
  brandConfig: BrandStoryConfig
): Promise<Partial<BookProject>> => {
  // Apply rate limiting
  await rateLimiter.throttle();

  const inputPayload = {
    contentType: brandConfig.contentType,
    company: brandConfig.companyInfo,
    sections: brandConfig.sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    tone: brandConfig.tone,
    visualStyle: brandConfig.visualStyle,
    colorScheme: brandConfig.colorScheme,
    fiscalYear: brandConfig.fiscalYear,
    pageCount: settings.pageCount,
    artStyle: settings.style,
  };

  const prompt = `${SYSTEM_INSTRUCTION_BRAND}

Generate professional ${brandConfig.contentType} content based on this request:
${JSON.stringify(inputPayload, null, 2)}

IMPORTANT:
- Use the company information provided to personalize all content
  - Include only the sections that are enabled
    - Match the requested tone throughout
      - Generate ${settings.pageCount} pages total
        - Create professional image prompts suitable for corporate materials`;

  try {
    console.log('🏢 Generating brand content with Gemini API...');

    const text = await callGeminiAPI(prompt, GEMINI_TEXT_MODEL, 8192);

    console.log(`✅ Brand content generated (${text.length} chars)`);

    // Parse JSON response
    let rawData: any;
    try {
      const jsonString = extractJson(text);
      rawData = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn('JSON Parse failed, attempting repair... - geminiService.ts:909', parseError);
      const repairedJson = repairJson(text);
      if (repairedJson) {
        rawData = JSON.parse(repairedJson);
      } else {
        throw parseError;
      }
    }

    if (rawData.error) {
      throw new Error(`Generation Error: ${rawData.message} `);
    }

    // Map to BookProject structure
    const project: Partial<BookProject> = {
      id: rawData.bookId || crypto.randomUUID(),
      title:
        rawData.metadata?.title || brandConfig.companyInfo.name + ' - ' + brandConfig.contentType,
      synopsis: rawData.metadata?.synopsis || '',
      style: settings.style,
      tone: settings.tone,
      targetAudience: 'Business Professionals',
      isBranching: false,
      brandProfile: settings.brandProfile,
      createdAt: new Date(),

      metadata: rawData.metadata,

      characters: [],

      chapters: [
        {
          id: crypto.randomUUID(),
          title: rawData.metadata?.title || 'Brand Story',
          pages: (rawData.pages || []).map((p: any) => ({
            id: crypto.randomUUID(),
            pageNumber: p.pageNumber,
            text: p.text,
            imagePrompt: p.imagePrompt,
            layoutType: p.layoutType || 'split-horizontal',
            narrationNotes: p.narrationNotes,
            sectionType: p.sectionType,
            dataVisualization: p.dataVisualization,
          })),
        },
      ],
    };

    return project;
  } catch (error) {
    console.error('Brand content generation failed: - geminiService.ts:957', error);
    throw error;
  }
};

export const generateBookStructure = async (
  settings: GenerationSettings
): Promise<Partial<BookProject>> => {
  // Apply rate limiting
  await rateLimiter.throttle();

  const ageGroup = parseAge(settings.audience);

  const inputPayload = {
    topic: settings.prompt,
    ageGroup: ageGroup,
    pageCount: settings.pageCount,
    genre: 'Fiction', // Could be inferred or added to settings
    artStyle: settings.style,
    interactive: settings.isBranching,
    educational: settings.educational || false,
    learningConfig: settings.learningConfig,
    language: 'en',
    tone: settings.tone,
    ...(settings.brandProfile
      ? {
          characterDescription: `Brand Character: ${settings.brandProfile.name}. ${settings.brandProfile.guidelines} `,
        }
      : {}),
    ...(settings.teacherCharacter
      ? {
          teacherCharacterName: settings.teacherCharacter.name,
          teacherCharacterRole: 'mentor/guide who teaches throughout the story',
        }
      : {}),
  };

  // Build character teaching voice prompt if teacher is selected
  let characterTeachingInstructions = '';
  if (settings.teacherCharacter) {
    const voicePrompt = buildCharacterVoicePrompt(settings.teacherCharacter);
    characterTeachingInstructions = `

## CHARACTER TEACHER INSTRUCTIONS
${SYSTEM_INSTRUCTION_TEACHER}

### YOUR TEACHING CHARACTER:
${voicePrompt}

### CRITICAL: All mentorDialogue must be written in ${settings.teacherCharacter.name} 's unique voice!
  - Use their catchphrases and speech patterns
    - Reflect their personality in how they explain concepts
      - Include their quirks naturally in teaching moments
        - Make learning feel like a conversation with this specific character

          `;
  }

  // Build educational instructions if needed
  let educationalInstructions = '';
  if (settings.educational && settings.learningConfig) {
    const mode = settings.learningConfig.integrationMode;
    educationalInstructions = `
${characterTeachingInstructions}

## CRITICAL EDUCATIONAL REQUIREMENTS

This is an EDUCATIONAL book.You MUST include learning content based on these settings:
- Subject: ${settings.learningConfig.subject}
- Learning Objectives: ${settings.learningConfig.objectives}
- Difficulty: ${settings.learningConfig.difficulty}
- Integration Mode: ${mode}

${
  mode === 'integrated'
    ? `
### ✅ INTEGRATED MODE - WOVEN INTO STORY (SELECTED)
**CRITICAL**: Learning must be seamlessly woven into the narrative!

REQUIREMENTS:
1. EVERY story page (1, 2, 3... N) MUST include a "learningContent" object
2. The mentor character teaches concepts WHILE the story unfolds
3. Learning happens through dialogue and action, not separate sections

Each page MUST have this structure:
{
  "pageNumber": N,
  "text": "Story narrative where character encounters learning moment",
  "imagePrompt": "Scene showing both story action AND learning",
  "learningContent": {
    "topic": "Specific ${settings.learningConfig?.subject || 'Math'} concept",
    "mentorDialogue": "Teacher explains naturally in context",
    "quiz": {
      "question": "Question about the concept",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "Why this is correct"
    }
  }
}

EXAMPLE: If teaching counting, Page 1 shows hero meeting 3 birds while mentor teaches counting!
`
    : ''
}

${
  mode === 'after-chapter'
    ? `
### ✅ AFTER-CHAPTER MODE - REVIEW AT END (SELECTED)
**CRITICAL**: Keep story pure, then review concepts at chapter breaks!

REQUIREMENTS:
1. Story pages have NO "learningContent" field
2. After every 3-4 narrative pages, insert ONE "Review Page"
3. Review pages ARE the only pages with "learningContent"

PATTERN for ${settings.pageCount || 12} pages:
- Pages 1-3: Pure story (NO learningContent)
- Page 4: Review Page WITH learningContent + layoutType: "learning-break"
- Pages 5-7: Pure story (NO learningContent)
- Page 8: Review Page WITH learningContent + layoutType: "learning-break"
- Repeat pattern...

Review Page MUST have:
{
  "pageNumber": 4,
  "text": "Let's review what we learned!",
  "layoutType": "learning-break",
  "learningContent": {
    "topic": "Summary of concepts from previous pages",
    "mentorDialogue": "Full teaching content here",
    "quiz": { /* complete quiz */ }
  }
}
`
    : ''
}

${
  mode === 'dedicated-section'
    ? `
### ✅ DEDICATED SECTION MODE - SEPARATE TEACHING (SELECTED)
**CRITICAL**: Complete story first, ALL learning at the end!

REQUIREMENTS:
1. Pages 1-${(settings.pageCount || 12) - 3}: Pure story with NO learningContent
2. Story must be complete and satisfying without any teaching
3. Final ${Math.min(3, Math.floor((settings.pageCount || 12) * 0.25))} pages: Separate "Learning Section" chapter
4. ONLY final pages contain learningContent + layoutType: "learning-only"

STRUCTURE:
**PAGES 1-${(settings.pageCount || 12) - 3}**: Pure narrative, no teaching
**PAGES ${(settings.pageCount || 12) - 2}-${settings.pageCount || 12}**: Learning Section with:
{
  "pageNumber": ${settings.pageCount || 12},
  "text": "Remember when... Let's learn more!",
  "layoutType": "learning-only",
  "learningContent": {
    "topic": "Concept from story",
    "mentorDialogue": "Teaching that references story events",
    "quiz": { /* full quiz */ }
  }
}
`
    : ''
}

⚠️ **VALIDATION BEFORE RETURNING JSON**:
${mode === 'integrated' ? `✓ ALL pages have learningContent\n✓ Learning woven into narrative` : ''}
${mode === 'after-chapter' ? `✓ Story pages have NO learningContent\n✓ Review pages every 3-4 pages with layoutType: "learning-break"\n✓ At least ${Math.floor((settings.pageCount || 12) / 4)} review pages` : ''}
${mode === 'dedicated-section' ? `✓ Pages 1-${(settings.pageCount || 12) - 3} have NO learningContent\n✓ Final ${Math.min(3, Math.floor((settings.pageCount || 12) * 0.25))} pages have layoutType: "learning-only"\n✓ All objectives from "${settings.learningConfig?.objectives || ''}" covered` : ''}
`;
  }

  // Build template structure instructions if provided
  let templateInstructions = '';
  if (settings.templateStructure) {
    templateInstructions = `
## STRICT STRUCTURE REQUIREMENT
You MUST follow this exact page - by - page structure.Do not deviate from these page types and content suggestions:

${JSON.stringify(settings.templateStructure, null, 2)}

For each page in the structure:
1. Use the 'suggestedContent' as the core plot point for that page.
2. Use the 'illustrationHint' to guide the 'imagePrompt'.
3. Ensure the 'pageNumber' matches exactly.
`;
  }

  const prompt = `${SYSTEM_INSTRUCTION_ARCHITECT}
${educationalInstructions}
${templateInstructions}

Generate a book based on this request:
${JSON.stringify(inputPayload, null, 2)} `;

  try {
    console.log('🤖 Generating book structure with Gemini API...');

    const text = await callGeminiAPI(prompt, GEMINI_TEXT_MODEL, 8192); // Increased token limit for full book

    console.log(`✅ Book structure generated (${text.length} chars)`);

    // Parse JSON response
    let rawData: any;
    try {
      const jsonString = extractJson(text);
      rawData = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn('JSON Parse failed, attempting repair... - geminiService.ts:1158', parseError);
      const repairedJson = repairJson(text);
      if (repairedJson) {
        rawData = JSON.parse(repairedJson);
      } else {
        throw parseError;
      }
    }

    if (rawData.error) {
      throw new Error(`Generation Error: ${rawData.message} `);
    }

    // Map to BookProject structure
    const project: Partial<BookProject> = {
      id: rawData.bookId || crypto.randomUUID(),
      title: rawData.metadata?.title || 'Untitled Masterpiece',
      synopsis: rawData.metadata?.synopsis || '',
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
        traits: c.traits,
      })),

      chapters: [
        {
          id: crypto.randomUUID(),
          title: 'Story',
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
            choices:
              p.interactiveElement?.options?.map((o: any) => ({
                text: o.text,
                targetPageNumber: o.leadsToPage,
              })) || [],
          })),
        },
      ],
    };

    return project;
  } catch (error) {
    console.error('Story Architect failed: - geminiService.ts:1224', error);
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
  // Apply rate limiting
  await rateLimiter.throttle();

  try {
    const fullPrompt = `${systemInstruction || ''} \n\n${prompt} \n\nReturn VALID JSON only.`;

    console.log('🤖 Generating structured content with Gemini API...');

    const text = await callGeminiAPI(fullPrompt, GEMINI_TEXT_MODEL, 2048);

    const jsonString = extractJson(text);
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Structured generation failed: - geminiService.ts:1257', error);
    throw error;
  }
};

export const generateIllustration = async (
  imagePrompt: string,
  style: string,
  tier: UserTier = UserTier.SPARK,
  options?: {
    ageGroup?: string;
    characterRef?: CharacterReference;
    sceneContext?: {
      timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';
      weather?: 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
      mood?: 'peaceful' | 'exciting' | 'mysterious' | 'joyful' | 'dramatic';
    };
    usePremiumPrompts?: boolean;
  }
): Promise<string | null> => {
  // PERFORMANCE: Create cache key from prompt + style + tier
  const cacheKey = `${style}:${tier}:${imagePrompt.substring(0, 100)} `;

  // PERFORMANCE: Check cache first
  const cachedUrl = getCachedImageUrl(cacheKey);
  if (cachedUrl) {
    console.log('📦 Using cached illustration - geminiService.ts:1269');
    return cachedUrl;
  }

  // PERFORMANCE: Deduplicate identical concurrent requests
  return deduplicateRequest(
    cacheKey,
    async () => {
      const modelId = getModelId(tier);
      console.log(
        `🎨 Generating illustration using model: ${modelId} (Tier: ${tier}) - geminiService.ts:1276`
      );

      // PERFORMANCE: Use request queue to limit concurrent API calls
      return imageRequestQueue.add(async () => {
        // PERFORMANCE: Apply rate limiting
        await imageRateLimiter.acquire();

        try {
          // PREMIUM: Use enterprise-grade prompts for paid tiers or when explicitly requested
          const usePremium =
            options?.usePremiumPrompts ||
            tier === UserTier.STUDIO ||
            tier === UserTier.EMPIRE ||
            tier === UserTier.CREATOR;

          let fullPrompt: string;

          if (usePremium && STYLE_PROMPT_TEMPLATES[style]) {
            // Use premium prompt builder for professional-grade output
            fullPrompt = buildPremiumImagePrompt({
              basePrompt: imagePrompt,
              style: style,
              tier: tier.toString(),
              ageGroup: options?.ageGroup,
              characterRef: options?.characterRef,
              sceneContext: options?.sceneContext,
            });
            console.log('✨ Using premium prompt engineering for', style);
          } else {
            // Use improved prompts even for free tier when style is known
            const styleConfig = STYLE_PROMPT_TEMPLATES[style];
            if (styleConfig) {
              fullPrompt = `${styleConfig.prefix}. ${imagePrompt}. ${styleConfig.lighting}. ${styleConfig.quality}. AVOID: ${styleConfig.avoidances}`;
            } else {
              // Fallback for unknown styles
              fullPrompt = `Style: ${style}. ${imagePrompt}. High quality, detailed illustration, professional quality, cinematic lighting.`;
            }
          }

          const output = await retryWithBackoff(
            async () => callBytezImageProxy(fullPrompt, modelId),
            {
              maxRetries: 2,
              initialDelayMs: 2000,
              maxDelayMs: 10000,
              retryCondition: (error: any) => {
                // Only retry on rate limit or server errors
                const code = error?.error?.code || error?.status;
                return [429, 500, 502, 503].includes(code);
              },
            }
          );

          // PERFORMANCE: Cache successful result
          if (output) {
            setCachedImageUrl(cacheKey, output);
          }

          console.log('✅ Bytez image generation successful - geminiService.ts:1316');
          return output;
        } catch (error) {
          console.error('❌ All Bytez keys exhausted for image generation - geminiService.ts:1319', error);
          return null;
        }
      });
    },
    10000
  ); // 10 second deduplication window
};

export const generateRefinedImage = async (
  prompt: string,
  params: {
    styleA: string;
    styleB?: string;
    mixRatio?: number;
    lighting?: string;
    camera?: string;
    characterDescription?: string;
    ageGroup?: string;
  },
  tier: UserTier = UserTier.SPARK
): Promise<string | null> => {
  const modelId = getModelId(tier);
  const qualityConfig = TIER_QUALITY_CONFIG[tier.toString()] || TIER_QUALITY_CONFIG['SPARK'];

  console.log(
    `🎨 Generating refined image using model: ${modelId} (Tier: ${tier}) - geminiService.ts:1340`
  );

  // Get style configurations
  const styleAConfig = STYLE_PROMPT_TEMPLATES[params.styleA];
  const styleBConfig = params.styleB ? STYLE_PROMPT_TEMPLATES[params.styleB] : null;

  let styleInstruction: string;
  if (styleBConfig && params.mixRatio !== undefined) {
    // Blend two styles
    styleInstruction = `
STYLE BLEND: ${params.mixRatio}% ${params.styleA} + ${100 - params.mixRatio}% ${params.styleB}
Primary Style (${params.mixRatio}%): ${styleAConfig?.prefix || params.styleA}
Secondary Style (${100 - params.mixRatio}%): ${styleBConfig?.prefix || params.styleB}
Blend these aesthetics harmoniously.`;
  } else if (styleAConfig) {
    styleInstruction = `
STYLE: ${styleAConfig.prefix}
TECHNICAL SPECS: ${styleAConfig.technicalSpecs}`;
  } else {
    styleInstruction = `Style: ${params.styleA}`;
  }

  // Build composition instructions
  const compositionParts: string[] = [];
  if (params.lighting) compositionParts.push(`Lighting: ${params.lighting}`);
  else if (styleAConfig?.lighting) compositionParts.push(`Lighting: ${styleAConfig.lighting}`);
  if (params.camera) compositionParts.push(`Camera/Composition: ${params.camera}`);

  // Age-appropriate adjustments
  let ageModifiers = '';
  if (params.ageGroup && AGE_CONTENT_MODIFIERS[params.ageGroup]) {
    const ageMod = AGE_CONTENT_MODIFIERS[params.ageGroup];
    ageModifiers = `
AGE-APPROPRIATE STYLE: ${ageMod.style}
COMPLEXITY LEVEL: ${ageMod.complexity}
MOOD: ${ageMod.mood}`;
  }

  const fullPrompt = `
Create a premium, gallery-worthy masterpiece illustration.

${styleInstruction}

SUBJECT: ${prompt}

${
  params.characterDescription
    ? `CHARACTER DETAILS (maintain consistency):
${params.characterDescription}`
    : ''
}

COMPOSITION:
${compositionParts.join('\n')}
- Focal point using rule of thirds
- Clear foreground, midground, background separation
- Dynamic but balanced composition
${ageModifiers}

QUALITY REQUIREMENTS:
${qualityConfig.qualityModifiers.join(', ')}
${styleAConfig?.quality || 'Professional illustration quality'}

COLOR APPROACH:
${styleAConfig?.colorApproach || 'Harmonious color palette with strategic accents'}

CRITICAL:
- No artifacts, no blurring, perfect anatomy and proportions
- Production-ready quality suitable for publishing
- Consistent style throughout the entire image

AVOID:
${styleAConfig?.avoidances || 'No muddy colors, no inconsistent lighting, no anatomical errors'}
`;

  try {
    const output = await callBytezImageProxy(fullPrompt, modelId);

    console.log('✅ Bytez image generation successful - geminiService.ts:1378');
    return output;
  } catch (error) {
    console.error('❌ All Bytez keys exhausted for image generation - geminiService.ts:1381', error);
    return null;
  }
};

// Helper to extract JSON from text (ignoring preamble/postamble)
function extractJson(text: string): string {
  // 1. Try to find content within ```json ... ``` blocks
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) return match[1].trim();

  // 2. Try to find content within generic code blocks
  const genericMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericMatch) return genericMatch[1].trim();

  // 3. Find the first '{' and the last '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }

  return text.trim();
}

// Helper function to repair truncated JSON
function repairJson(jsonString: string): string | null {
  try {
    // 1. Remove any trailing incomplete string
    let cleaned = jsonString.replace(/,\s*"[^"]*$/, '');

    // 2. Count braces/brackets to close them
    const openBraces = (cleaned.match(/{/g) || []).length;
    let closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    let closeBrackets = (cleaned.match(/\]/g) || []).length;

    while (openBraces > closeBraces) {
      cleaned += '}';
      closeBraces++;
    }
    while (openBrackets > closeBrackets) {
      cleaned += ']';
      closeBrackets++;
    }

    // Verify if it parses now
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    return null; // Repair failed
  }
}
