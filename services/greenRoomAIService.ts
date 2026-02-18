/**
 * Green Room AI Service
 *
 * Dedicated API service for Green Room character conversations.
 * Uses Bytez API keys to avoid resource crowding with storybook generation (which uses Gemini API keys).
 *
 * Extended with visual generation for:
 * - Character portrait generation
 * - Expression/emotion variations
 * - Scene context visuals
 */

// @ts-ignore
import Bytez from 'bytez.js';
import { UserTier } from '../types';
import type { Character } from '../types';
import {
  type CharacterVisualProfile,
  buildCharacterReference,
  extractVisualProfile,
} from './characterConsistencyService';
import { generateIllustration } from './geminiService';

// Helper to safely get env vars in both Vite and Node environments
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

// Dedicated Bytez API keys for Green Room (separate from storybook generation)
const GREEN_ROOM_API_KEYS = [
  getEnv('VITE_BYTEZ_API_KEY_1'),
  getEnv('VITE_BYTEZ_API_KEY_2'),
  getEnv('VITE_BYTEZ_API_KEY_3'),
  getEnv('VITE_BYTEZ_API_KEY_4'),
  getEnv('VITE_BYTEZ_API_KEY_5'),
  getEnv('VITE_BYTEZ_API_KEY_6'),
  getEnv('VITE_BYTEZ_API_KEY_7'),
  getEnv('VITE_BYTEZ_API_KEY_8'),
  getEnv('VITE_BYTEZ_API_KEY_9'),
  getEnv('VITE_BYTEZ_API_KEY_10'),
  getEnv('VITE_BYTEZ_API_KEY_11'),
].filter((key) => key && key.length > 0);

// Use Gemini 2.5 Pro via Bytez for high-quality character conversations
const GREEN_ROOM_MODEL = 'google/gemini-2.5-pro';

// Current key index for rotation
let currentKeyIndex = 0;

// Validate API keys at module load
if (GREEN_ROOM_API_KEYS.length === 0) {
  console.warn('⚠️ No Bytez API keys configured for Green Room. Character conversations will not work.');
  console.warn('Add VITE_BYTEZ_API_KEY_1, VITE_BYTEZ_API_KEY_2, etc. to your .env file');
} else {
  console.log(
    `✅ Green Room AI configured with ${GREEN_ROOM_API_KEYS.length} Bytez API key(s)`
  );
}

/**
 * Get the next API key in rotation
 */
function getNextAPIKey(): string {
  if (GREEN_ROOM_API_KEYS.length === 0) {
    throw new Error('No Green Room API keys configured');
  }

  const key = GREEN_ROOM_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GREEN_ROOM_API_KEYS.length;

  return key;
}

/**
 * Check if Green Room AI is available
 */
export const isGreenRoomAIAvailable = (): boolean => {
  return GREEN_ROOM_API_KEYS.length > 0;
};

export interface GreenRoomMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
/**
 * Call Green Room AI with dedicated Bytez API keys
 * Automatically rotates through available keys and models for reliability
 */
export async function callGreenRoomAI(messages: GreenRoomMessage[]): Promise<string> {
  const maxRetries = GREEN_ROOM_API_KEYS.length;
  let lastError: Error | null = null;

  // Try each API key in rotation
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getNextAPIKey();
    const maskedKey = apiKey
      ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
      : 'undefined';

    try {
      const sdk = new Bytez(apiKey);
      const model = sdk.model(GREEN_ROOM_MODEL);

      // Convert messages to the format expected by Bytez
      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      console.log(
        `🎭 Green Room AI: Calling ${GREEN_ROOM_MODEL} via Bytez (Key: ${maskedKey}, Attempt ${attempt + 1}/${maxRetries})...`
      );

      const { error, output } = await model.run(formattedMessages);

      if (error) {
        throw new Error(`Bytez API error: ${JSON.stringify(error)}`);
      }

      if (!output) {
        throw new Error('Empty response received from Bytez');
      }

      // Handle different output formats
      let text: string;
      if (typeof output === 'string') {
        text = output.trim();
      } else if (output.content) {
        text = output.content.trim();
      } else if (output.message?.content) {
        text = output.message.content.trim();
      } else if (Array.isArray(output) && output[0]?.content) {
        text = output[0].content.trim();
      } else {
        text = JSON.stringify(output);
      }

      if (!text || text.length === 0) {
        throw new Error('Empty text in response');
      }

      console.log(`✅ Green Room AI response received from Bytez (${GREEN_ROOM_MODEL})`);
      return text;
    } catch (error: any) {
      console.warn(
        `⚠️ Green Room AI failed with Bytez (Key: ${maskedKey}):`,
        error.message
      );
      lastError = error;
      // Loop continues to next key
    }
  }

  // All keys exhausted
  console.error('❌ All Green Room Bytez API keys exhausted');
  throw lastError || new Error('All Green Room Bytez API keys failed');
}

/**
 * Generate character response in the Green Room
 * Optimized for deep character conversations
 */
export async function generateCharacterResponse(
  characterContext: string,
  conversationHistory: GreenRoomMessage[],
  userQuestion: string
): Promise<string> {
  if (!isGreenRoomAIAvailable()) {
    throw new Error('Green Room AI is not configured. Please add API keys to your environment.');
  }

  const messages: GreenRoomMessage[] = [
    {
      role: 'system',
      content: `You are roleplaying as a character in a deep, introspective conversation. 

${characterContext}

Stay completely in character. Respond authentically based on the character's:
- Psychological profile (OCEAN traits)
- Core beliefs and values
- Formative experiences
- Relationship style
- Behavioral patterns
- Voice and speech patterns

Be vulnerable, honest, and reveal depth. This is a safe space for the character to explore their inner world.`,
    },
    ...conversationHistory,
    {
      role: 'user',
      content: userQuestion,
    },
  ];

  return callGreenRoomAI(messages);
}

/**
 * Extract facts from a character conversation
 * Identifies key revelations, traits, and story elements
 */
export async function extractFactsFromConversation(
  characterName: string,
  conversationText: string
): Promise<any[]> {
  if (!isGreenRoomAIAvailable()) {
    throw new Error('Green Room AI is not configured.');
  }

  const messages: GreenRoomMessage[] = [
    {
      role: 'system',
      content: `You are an expert at extracting character insights from conversations. Analyze the dialogue and identify key facts about the character.`,
    },
    {
      role: 'user',
      content: `Extract important facts about ${characterName} from this conversation. Return a JSON array of facts.

Each fact should have:
- category: "personality", "backstory", "relationships", "motivation", "fear", or "quirk"
- content: the actual fact or insight
- importance: "high", "medium", or "low"

Conversation:
${conversationText}

Return ONLY valid JSON, no other text.`,
    },
  ];

  const response = await callGreenRoomAI(messages);

  try {
    // Clean and parse JSON
    let cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const firstBracket = cleanResponse.indexOf('[');
    const lastBracket = cleanResponse.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanResponse = cleanResponse.substring(firstBracket, lastBracket + 1);
    }

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Failed to parse extracted facts:', error);
    return [];
  }
}

/**
 * Character expression types for visual generation
 */
export type CharacterExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thoughtful'
  | 'determined'
  | 'worried'
  | 'excited'
  | 'confused'
  | 'mischievous'
  | 'peaceful';

/**
 * Expression-specific prompt modifiers for realistic emotional portrayal
 */
const EXPRESSION_PROMPTS: Record<CharacterExpression, string> = {
  neutral: 'calm, relaxed expression, slight natural smile, at ease',
  happy: 'genuine smile, bright eyes, joyful expression, warm and inviting demeanor',
  sad: 'downcast eyes, slightly furrowed brow, melancholic expression, subdued posture',
  angry: 'intense gaze, furrowed brow, tense jaw, determined stance',
  surprised: 'wide eyes, raised eyebrows, open mouth, alert posture',
  thoughtful: 'contemplative gaze, hand near chin, introspective expression, distant focus',
  determined: 'focused eyes, set jaw, confident stance, resolute expression',
  worried: 'creased forehead, uncertain eyes, slight frown, tense shoulders',
  excited: 'bright eyes, animated expression, energetic posture, eager anticipation',
  confused: 'tilted head, puzzled expression, questioning gaze, uncertain stance',
  mischievous: 'playful smirk, twinkling eyes, slight head tilt, knowing expression',
  peaceful: 'serene expression, soft eyes, gentle smile, relaxed presence',
};

/**
 * Portrait composition types
 */
export type PortraitComposition =
  | 'headshot'
  | 'bust'
  | 'three-quarter'
  | 'full-body'
  | 'environmental';

/**
 * Composition-specific framing instructions
 */
const COMPOSITION_PROMPTS: Record<PortraitComposition, string> = {
  headshot: 'close-up portrait from shoulders up, face fills frame, detailed facial features',
  bust: 'upper body portrait, head and torso visible, balanced framing',
  'three-quarter': 'three-quarter view, dynamic angle, shows personality through pose',
  'full-body': 'full body portrait, complete figure visible, includes stance and posture',
  environmental: 'character in context, environment visible, tells a story about the character',
};

/**
 * Generate a character portrait for the Green Room
 * Creates a high-quality character visualization based on their profile
 */
export async function generateCharacterPortrait(
  character: Character,
  options: {
    expression?: CharacterExpression;
    composition?: PortraitComposition;
    artStyle?: string;
    tier?: UserTier;
    backgroundContext?: string;
  } = {}
): Promise<string | null> {
  const {
    expression = 'neutral',
    composition = 'bust',
    artStyle = 'Digital Portrait',
    tier = UserTier.CREATOR,
    backgroundContext = 'soft gradient studio background',
  } = options;

  try {
    // Extract visual profile for consistency
    const visualProfile = extractVisualProfile(character);
    const characterRef = buildCharacterReference(visualProfile);

    // Build comprehensive portrait prompt
    const portraitPrompt = buildPortraitPrompt(
      character,
      visualProfile,
      expression,
      composition,
      backgroundContext
    );

    console.log(
      `🎭 Green Room: Generating ${expression} ${composition} portrait for ${character.name}`
    );

    // Use the premium illustration generator
    const imageUrl = await generateIllustration(portraitPrompt, artStyle, tier, {
      usePremiumPrompts: true,
      characterRef,
      sceneContext: { mood: 'peaceful' },
    });

    console.log(`✅ Green Room: Portrait generated for ${character.name}`);
    return imageUrl;
  } catch (error) {
    console.error(`❌ Green Room: Failed to generate portrait for ${character.name}:`, error);
    return null;
  }
}

/**
 * Build a detailed portrait prompt from character data
 */
function buildPortraitPrompt(
  character: Character,
  visualProfile: CharacterVisualProfile,
  expression: CharacterExpression,
  composition: PortraitComposition,
  backgroundContext: string
): string {
  const parts: string[] = [];
  const physDesc = visualProfile.physicalDescription;

  // Composition and framing
  parts.push(`Professional ${composition} portrait, ${COMPOSITION_PROMPTS[composition]}`);

  // Character identity
  parts.push(`Subject: ${character.name}`);

  // Physical description from physicalDescription object
  const physicalTraits = [physDesc.age, physDesc.build, physDesc.height].filter(Boolean);

  if (physicalTraits.length > 0) {
    parts.push(`Physical: ${physicalTraits.join(', ')}`);
  }

  // Skin tone
  if (physDesc.skinTone) {
    parts.push(`Skin: ${physDesc.skinTone}`);
  }

  // Hair
  const hairDesc = [physDesc.hairColor, physDesc.hairLength, physDesc.hairStyle]
    .filter(Boolean)
    .join(' ');
  if (hairDesc) {
    parts.push(`Hair: ${hairDesc}`);
  }

  // Eyes
  const eyeDesc = [physDesc.eyeColor, physDesc.eyeShape].filter(Boolean).join(' ');
  if (eyeDesc) {
    parts.push(`Eyes: ${eyeDesc}`);
  }

  // Expression
  parts.push(`Expression: ${EXPRESSION_PROMPTS[expression]}`);

  // Clothing
  if (visualProfile.clothing?.style) {
    parts.push(`Attire: ${visualProfile.clothing.style}`);
  }

  // Distinctive features
  if (visualProfile.distinctiveFeatures.length > 0) {
    parts.push(`Distinctive: ${visualProfile.distinctiveFeatures.join(', ')}`);
  }

  // Background
  parts.push(`Background: ${backgroundContext}`);

  // Quality requirements
  parts.push('High-quality digital portrait, professional lighting, sharp focus on face');

  return parts.join('. ') + '.';
}

/**
 * Generate expression sheet - multiple expressions for the same character
 * Useful for understanding character emotional range
 */
export async function generateExpressionSheet(
  character: Character,
  expressions: CharacterExpression[] = ['happy', 'sad', 'angry', 'thoughtful'],
  options: {
    artStyle?: string;
    tier?: UserTier;
  } = {}
): Promise<Map<CharacterExpression, string | null>> {
  const results = new Map<CharacterExpression, string | null>();

  console.log(
    `🎭 Green Room: Generating expression sheet for ${character.name} (${expressions.length} expressions)`
  );

  // Generate expressions sequentially to avoid rate limiting
  for (const expression of expressions) {
    const imageUrl = await generateCharacterPortrait(character, {
      expression,
      composition: 'headshot',
      artStyle: options.artStyle,
      tier: options.tier,
    });
    results.set(expression, imageUrl);

    // Brief pause between generations
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`✅ Green Room: Expression sheet complete for ${character.name}`);
  return results;
}

/**
 * Generate a conversation scene visual
 * Shows the character in an interview/conversation setting
 */
export async function generateConversationScene(
  character: Character,
  mood: CharacterExpression,
  conversationContext: string,
  options: {
    artStyle?: string;
    tier?: UserTier;
  } = {}
): Promise<string | null> {
  const { artStyle = 'Digital Portrait', tier = UserTier.CREATOR } = options;

  try {
    const visualProfile = extractVisualProfile(character);
    const physDesc = visualProfile.physicalDescription;

    // Build physical traits from physicalDescription object
    const physicalTraits = [physDesc.age, physDesc.build, physDesc.skinTone].filter(Boolean);
    const hairDesc = [physDesc.hairColor, physDesc.hairLength, physDesc.hairStyle]
      .filter(Boolean)
      .join(' ');

    // Build scene-specific prompt
    const scenePrompt =
      [
        `Intimate conversation setting, ${character.name} during an interview`,
        `Character: ${physicalTraits.join(', ')}`,
        hairDesc ? `Hair: ${hairDesc}` : '',
        `Expression: ${EXPRESSION_PROMPTS[mood]}`,
        `Context: ${conversationContext}`,
        `Setting: cozy, warm-lit interview room, comfortable atmosphere`,
        'Soft lighting, shallow depth of field on character, professional portrait photography style',
      ]
        .filter(Boolean)
        .join('. ') + '.';

    console.log(`🎭 Green Room: Generating conversation scene for ${character.name}`);

    const imageUrl = await generateIllustration(scenePrompt, artStyle, tier, {
      usePremiumPrompts: true,
      sceneContext: { mood: 'peaceful' },
    });

    return imageUrl;
  } catch (error) {
    console.error(`❌ Green Room: Failed to generate conversation scene:`, error);
    return null;
  }
}

export default {
  isGreenRoomAIAvailable,
  callGreenRoomAI,
  generateCharacterResponse,
  extractFactsFromConversation,
  // Visual generation
  generateCharacterPortrait,
  generateExpressionSheet,
  generateConversationScene,
  // Types
  EXPRESSION_PROMPTS,
  COMPOSITION_PROMPTS,
};
