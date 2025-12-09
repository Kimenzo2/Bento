/**
 * Green Room AI Service
 * 
 * Dedicated API service for Green Room character conversations.
 * Uses Google Gemini API keys directly (not through Bytez) to avoid resource crowding with storybook generation.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Dedicated Gemini API keys for Green Room (separate from storybook generation)
const GREEN_ROOM_API_KEYS = [
    import.meta.env.VITE_GREEN_ROOM_API_KEY_1,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_2,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_3,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_4,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_5,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_6,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_7,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_8,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_9,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_10,
    import.meta.env.VITE_GREEN_ROOM_API_KEY_11,
].filter(Boolean); // Remove undefined keys

// Use Gemini 1.5 Pro for high-quality character conversations
// This model excels at:
// - Natural dialogue and personality consistency
// - Complex reasoning and emotional intelligence  
// - Long context understanding (up to 2M tokens)
// - Nuanced character behavior and responses
const GREEN_ROOM_MODEL = 'gemini-1.5-pro';

// Current key index for rotation
let currentKeyIndex = 0;

// Validate API keys at module load
if (GREEN_ROOM_API_KEYS.length === 0) {
    console.warn('⚠️ No Green Room API keys configured. Character conversations will not work.');
    console.warn('Add VITE_GREEN_ROOM_API_KEY_1, VITE_GREEN_ROOM_API_KEY_2, etc. to your .env file');
} else {
    console.log(`✅ Green Room AI configured with ${GREEN_ROOM_API_KEYS.length} dedicated API key(s)`);
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
 * Call Green Room AI with dedicated Gemini API keys
 * Automatically rotates through available keys for load balancing
 */
const GREEN_ROOM_MODELS = ['gemini-1.5-pro', 'gemini-1.5-flash'];

/**
 * Call Green Room AI with dedicated Gemini API keys
 * Automatically rotates through available keys and models for reliability
 */
export async function callGreenRoomAI(messages: GreenRoomMessage[]): Promise<string> {
    const maxRetries = GREEN_ROOM_API_KEYS.length;
    let lastError: Error | null = null;

    // Try each API key in rotation
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = getNextAPIKey();
        const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';

        // Try models in order (Pro -> Flash) for each key
        for (const modelName of GREEN_ROOM_MODELS) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: modelName });

                // Convert messages to Gemini chat format
                const systemMessage = messages.find(m => m.role === 'system');
                const conversationMessages = messages.filter(m => m.role !== 'system');

                const chatHistory = conversationMessages.slice(0, -1).map((msg, idx) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{
                        text: idx === 0 && systemMessage
                            ? `${systemMessage.content}\n\n${msg.content}`
                            : msg.content
                    }]
                }));

                const lastMessage = conversationMessages[conversationMessages.length - 1];

                console.log(`🎭 Green Room AI: Calling ${modelName} (Key: ${maskedKey}, Attempt ${attempt + 1}/${maxRetries})...`);

                const chat = model.startChat({
                    history: chatHistory,
                    generationConfig: {
                        maxOutputTokens: 8192,
                        temperature: 0.9,
                        topP: 0.95,
                        topK: 40,
                    },
                    // Safety settings omitted for brevity, identical to original
                });

                const result = await chat.sendMessage(lastMessage.content);
                const response = await result.response;
                const text = response.text();

                if (!text || text.trim().length === 0) {
                    throw new Error('Empty response received');
                }

                console.log(`✅ Green Room AI response received from ${modelName}`);
                return text.trim();

            } catch (error: any) {
                console.warn(`⚠️ Green Room AI failed with ${modelName} (Key: ${maskedKey}):`, error.message);
                lastError = error;
                // Try next model with SAME key, if that fails, loop continues to next key
            }
        }
    }

    // All keys exhausted
    console.error('❌ All Green Room API keys exhausted');
    throw lastError || new Error('All Green Room API keys failed');
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

Be vulnerable, honest, and reveal depth. This is a safe space for the character to explore their inner world.`
        },
        ...conversationHistory,
        {
            role: 'user',
            content: userQuestion
        }
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
            content: `You are an expert at extracting character insights from conversations. Analyze the dialogue and identify key facts about the character.`
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

Return ONLY valid JSON, no other text.`
        }
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

export default {
    isGreenRoomAIAvailable,
    callGreenRoomAI,
    generateCharacterResponse,
    extractFactsFromConversation
};
