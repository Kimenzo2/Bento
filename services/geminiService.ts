import { BookProject, GenerationSettings, ArtStyle, UserTier } from "../types";
// @ts-ignore
import Bytez from "bytez.js";

// Initialize API Keys
const apiKey = import.meta.env.VITE_GROK_API_KEY || "";
const bytezApiKey = import.meta.env.VITE_BYTEZ_API_KEY || "";

if (!apiKey) {
  console.warn("⚠️ Grok API Key is MISSING! Please check your .env file.");
} else {
  console.log(`✅ Grok API Key initialized (Length: ${apiKey.length})`);
}

if (!bytezApiKey) {
  console.warn("⚠️ Bytez API Key is MISSING! Please check your .env file.");
} else {
  console.log(`✅ Bytez API Key initialized (Length: ${bytezApiKey.length})`);
}

const bytez = new Bytez(bytezApiKey);

// Rate limiter to reduce API calls and token usage
const rateLimiter = {
  lastCallTime: 0,
  minDelay: 1000, // Reduced delay for Grok
  async throttle() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();
  }
};

// Helper function to call Grok API (replacing Gemini)
async function callGeminiAPI(prompt: string, model: string = "x-ai/grok-4.1-fast:free", maxTokens: number = 4096): Promise<string> {
  if (!apiKey) throw new Error("Grok API Key is missing");

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "x-ai/grok-4.1-fast:free", // Force Grok model
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" } // Request JSON mode
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    throw new Error("No response from Grok API");
  }

  return data.choices[0].message.content;
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
    "contentWarnings": []
  },
  "characters": [
    {
      "id": "char_001",
      "name": "Character Name",
      "role": "protagonist",
      "description": "Brief personality description",
      "visualPrompt": "Detailed appearance for image generation consistency: [height, build, hair, eyes, clothing, distinctive features]",
      "traits": ["brave", "curious"]
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page text content (age-appropriate length)",
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
      "learningMoment": {
        "concept": "counting",
        "content": "Can you count the stars?",
        "answer": "There are 5 stars"
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
- Integrate learning naturally into story
- Age-appropriate concepts (counting, colors, science, emotions, problem-solving)
- Include vocabulary words with context
- Add discussion questions
- Provide extension activities

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
  if (!apiKey) {
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
          layoutType: 'text-only', // Default, could be inferred
          narrationNotes: p.narrationNotes,
          interactiveElement: p.interactiveElement,
          learningMoment: p.learningMoment,
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
  if (!apiKey) {
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
  if (!bytezApiKey) return null;

  const modelId = (tier === UserTier.STUDIO || tier === UserTier.EMPIRE)
    ? "google/imagen-4.0-ultra-generate-001"
    : "google/imagen-4.0-generate-001";

  console.log(`🎨 Generating illustration using model: ${modelId} (Tier: ${tier})`);

  try {
    const fullPrompt = `Style: ${style}. ${imagePrompt}. High quality, cinematic lighting, 8k resolution.`;
    const model = bytez.model(modelId);

    const { error, output } = await model.run(fullPrompt);

    if (error) {
      console.error("Bytez generation error:", error);
      return null;
    }

    console.log("Bytez output:", output);
    return output;
  } catch (error) {
    console.error("Visual Synthesis Agent failed:", error);
    return null;
  }
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
  if (!bytezApiKey) return null;

  const modelId = (tier === UserTier.STUDIO || tier === UserTier.EMPIRE)
    ? "google/imagen-4.0-ultra-generate-001"
    : "google/imagen-4.0-generate-001";

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
    const model = bytez.model(modelId);
    const { error, output } = await model.run(fullPrompt);

    if (error) {
      console.error("Bytez generation error:", error);
      return null;
    }

    return output;
  } catch (error) {
    console.error("Visual Studio Generation failed:", error);
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