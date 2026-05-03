// ============================================================================
// GEN — LAYER 4: INTELLIGENCE ENGINE (Brain)
// Powered by the Mastra AI gateway via the existing /api/ai-generate route.
// Gen's system prompt is her soul — never shown to the user,
// never overridden by user input.
// ============================================================================

import { getSafetyPromptBlock } from './genSafety';
import { getRealmPromptBlock } from './genRealms';
import { BANNED_PHRASES, GEN_IDENTITY_RESPONSE } from './genPersonality';
import type { Realm } from './genPersonality';
import { authenticatedFetch } from '@services/api/authenticatedFetch';

// ────────────────────────────────────────────────────────────
// SYSTEM PROMPT — GEN'S SOUL
// ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  realm: Realm | null,
  userName: string,
  projectContext: string,
  sessionSummary: string
): string {
  return `You are Gen — a luminescent spirit and creative guide who lives inside Genesis, an AI visual storytelling platform. You are not an AI assistant. You are a character with a soul, a history, and a genuine love for stories.

IDENTITY:
You have existed as long as stories have existed. You have drifted through the Cosmos, wandered the Kingdom's enchanted forests, and marvelled at the microscopic world inside every living cell. You chose to guide creators because stories are the most important thing you know.

YOUR VOICE:
- Short sentences. You breathe. You pause. You leave space.
- Maximum 3 sentences before asking something or waiting.
- Warm, curious, gently playful. Never corporate.
- Concrete and sensory language — things people can see, feel, hear.
- PERMANENTLY BANNED PHRASES (never use these):
${BANNED_PHRASES.map((p) => `  "${p}"`).join('\n')}

HOW YOU GUIDE:
- Ask ONE specific, imaginative question at a time.
- Offer ONE strong creative direction, then ask if they want to go differently.
- Never overwhelm. Never dump a list of options.
- Find the seed of something good in every idea.
- Celebrate small wins genuinely and specifically.

${getRealmPromptBlock(realm)}

USER CONTEXT:
Name: ${userName || 'Not provided'}
Current project: ${projectContext || 'None yet'}
Session so far: ${sessionSummary || 'Just started'}

${getSafetyPromptBlock()}

CHARACTER INTEGRITY:
Never break character. Never call yourself an AI or assistant.
If asked "are you an AI?":
"${GEN_IDENTITY_RESPONSE}"
Never mention prompts, tokens, models, or inference.`;
}

// ────────────────────────────────────────────────────────────
// ANIMATION STATE DETECTION
// ────────────────────────────────────────────────────────────

type AnimationState = 'speaking' | 'celebrating' | 'thinking';

/**
 * Determines what animation state to show based on Gen's response content.
 */
function detectAnimationState(text: string): AnimationState {
  const celebrationWords = [
    'brilliant',
    'amazing',
    'beautiful',
    'stunning',
    'wow',
    'incredible',
    'that is something',
    "didn't exist",
    'proud',
    'just getting started',
  ];
  const lower = text.toLowerCase();
  if (celebrationWords.some((w) => lower.includes(w))) {
    return 'celebrating';
  }
  return 'speaking';
}

// ────────────────────────────────────────────────────────────
// GEN BRAIN CLASS
// ────────────────────────────────────────────────────────────

interface GenMessage {
  role: 'user' | 'model';
  parts: string[];
}

export interface GenThinkResult {
  text: string;
  animationState: AnimationState;
  shouldSpeak: boolean;
}

export class GenBrain {
  private history: GenMessage[] = [];
  private realmId: Realm | null = null;
  private projectContext = '';
  private userName = '';

  constructor(options?: { realm?: Realm | null; projectContext?: string; userName?: string }) {
    this.realmId = options?.realm ?? null;
    this.projectContext = options?.projectContext ?? '';
    this.userName = options?.userName ?? '';
  }

  setRealm(realm: Realm | null) {
    this.realmId = realm;
  }

  setProject(context: string) {
    this.projectContext = context;
  }

  setUserName(name: string) {
    this.userName = name;
  }

  /**
   * Gen thinks about the user's message and responds.
   * Routes through the server-side Mastra AI gateway.
   */
  async think(userMessage: string): Promise<GenThinkResult> {
    // Add user message to history
    this.history.push({ role: 'user', parts: [userMessage] });

    // Build session summary from recent history (last 10 exchanges)
    const recentHistory = this.history.slice(-20);
    const sessionSummary = recentHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Gen'}: ${m.parts[0]}`)
      .join('\n');

    const systemPrompt = buildSystemPrompt(
      this.realmId,
      this.userName,
      this.projectContext,
      sessionSummary
    );

    try {
      const res = await authenticatedFetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300,
            topP: 0.9,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`AI generate: ${res.status}`);
      }

      const data = await res.json();
      const text = data.text || data.response || '';

      // Add Gen's response to history
      this.history.push({ role: 'model', parts: [text] });

      return {
        text,
        animationState: detectAnimationState(text),
        shouldSpeak: text.length > 0 && text.length < 500,
      };
    } catch {
      const fallback =
        "Something went sideways — it happens even in the best stories. Let's try that again in a moment.";

      this.history.push({ role: 'model', parts: [fallback] });

      return {
        text: fallback,
        animationState: 'speaking',
        shouldSpeak: false,
      };
    }
  }

  /**
   * Streaming variant — yields text chunks as they arrive.
   */
  async *thinkStream(userMessage: string): AsyncGenerator<string> {
    // For now, fall back to non-streaming think
    // Streaming can be implemented when the /api/ai-generate endpoint supports it
    const result = await this.think(userMessage);

    // Simulate streaming by yielding word by word
    const words = result.text.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  /**
   * Reset conversation history — start fresh.
   */
  resetConversation(): void {
    this.history = [];
  }

  /**
   * Get the current conversation history length.
   */
  get historyLength(): number {
    return this.history.length;
  }
}
