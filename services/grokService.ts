import { BookProject } from '../types';
// @ts-ignore
import Bytez from 'bytez.js';

// Bytez API key for text generation
const BYTEZ_API_KEY = import.meta.env.VITE_BYTEZ_TEXT_API_KEY || '5bd38cb5f6b3a450314dc0fb3768d3c7';
const TEXT_MODEL = 'google/gemini-2.5-pro';

// Validate API key at module load
if (!BYTEZ_API_KEY) {
    console.warn('⚠️ VITE_BYTEZ_TEXT_API_KEY is not configured. AI features will not work.');
} else {
    console.log('✅ Bytez Text API configured with Gemini 2.5 Pro');
}

/**
 * Check if the Bytez API is available
 */
export const isGrokAvailable = (): boolean => {
    return Boolean(BYTEZ_API_KEY && BYTEZ_API_KEY.length > 0);
};

interface GrokMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Helper function to make API calls using Bytez SDK with Gemini 2.5 Pro
 */
async function callAPI(messages: GrokMessage[]): Promise<string> {
    try {
        const sdk = new Bytez(BYTEZ_API_KEY);
        const model = sdk.model(TEXT_MODEL);
        
        // Convert messages to the format expected by Bytez
        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        console.log(`🔄 Calling Bytez API with ${TEXT_MODEL}...`);
        const { error, output } = await model.run(formattedMessages);
        
        if (error) {
            console.error('❌ Bytez API error:', error);
            throw new Error(`Bytez API error: ${JSON.stringify(error)}`);
        }
        
        if (!output) {
            console.error('❌ No output from Bytez API');
            throw new Error('No output received from Bytez API');
        }
        
        console.log('✅ Bytez API response received');
        
        // Handle different output formats
        if (typeof output === 'string') {
            return output.trim();
        } else if (output.content) {
            return output.content.trim();
        } else if (output.message?.content) {
            return output.message.content.trim();
        } else if (Array.isArray(output) && output[0]?.content) {
            return output[0].content.trim();
        }
        
        return JSON.stringify(output);
    } catch (error) {
        console.error('❌ Bytez API call failed:', error);
        throw error;
    }
}

/**
 * Feature #1: AI Story Improvement
 * Improves text based on tone and audience
 */
export async function improveText(
    text: string,
    tone: string,
    targetAudience: string
): Promise<string> {
    if (!BYTEZ_API_KEY) {
        throw new Error('API key is not configured. Please add VITE_BYTEZ_TEXT_API_KEY to your environment.');
    }

    try {
        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a professional children's book editor. Your task is to improve story text while preserving its core meaning and charm.`
            },
            {
                role: 'user',
                content: `Please improve this text for a ${targetAudience} audience with a ${tone} tone. Keep the same approximate length but make it more engaging and polished.

Original Text:
"${text}"

Return ONLY the improved text, no explanations.`
            }
        ];

        return await callAPI(messages);
    } catch (error) {
        console.error('Failed to improve text:', error);
        throw error;
    }
}

/**
 * Feature #2: Character Consistency Checker
 * Analyzes the entire book for character inconsistencies
 */
export async function checkCharacterConsistency(project: BookProject): Promise<{
    characters: Array<{
        name: string;
        inconsistencies: string[];
        suggestions: string[];
    }>;
    overallScore: number;
}> {
    if (!BYTEZ_API_KEY) {
        throw new Error('API key is not configured. Please add VITE_BYTEZ_TEXT_API_KEY to your environment.');
    }

    try {
        // Collect all text from the book
        const allPages = project.chapters.flatMap(ch => ch.pages);
        const bookText = allPages.map((p, i) => `Page ${p.pageNumber}: ${p.text}`).join('\n\n');

        // Get character names
        const characterNames = project.characters?.map(c => c.name).join(', ') || 'Unknown characters';

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a story consistency analyst. Analyze the book for character consistency issues. Always respond with valid JSON only.`
            },
            {
                role: 'user',
                content: `Analyze this children's book for character consistency issues.

Characters: ${characterNames}

Full Book Text:
${bookText}

Return a JSON object in this EXACT format (no markdown, no code blocks):
{
  "characters": [
    {
      "name": "Character Name",
      "inconsistencies": ["List any inconsistencies found"],
      "suggestions": ["List suggestions to fix them"]
    }
  ],
  "overallScore": 85
}

The overallScore should be 0-100 (100 = perfectly consistent).`
            }
        ];

        const content = await callAPI(messages);

        // Parse JSON response (remove markdown code blocks if present)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format');
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Failed to check character consistency:', error);
        throw error;
    }
}

/**
 * Feature #3: Real-Time Writing Suggestions
 * Provides inline suggestions as users type
 */
export async function getWritingSuggestions(
    text: string,
    context: string
): Promise<Array<{
    type: 'grammar' | 'style' | 'word-choice';
    original: string;
    suggestion: string;
    reason: string;
}>> {
    // Return empty array if API is not available (graceful degradation)
    if (!BYTEZ_API_KEY) {
        console.warn('API key not configured - writing suggestions disabled');
        return [];
    }

    try {
        if (!text || text.length < 10) {
            return []; // Don't suggest for very short text
        }

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a writing assistant for children's book authors. Provide helpful, actionable suggestions. Always respond with valid JSON only.`
            },
            {
                role: 'user',
                content: `Analyze this text and provide up to 3 suggestions for improvement.

Context: ${context}

Text:
"${text}"

Return a JSON array in this EXACT format (no markdown, no code blocks):
[
  {
    "type": "grammar",
    "original": "the exact phrase to improve",
    "suggestion": "improved version",
    "reason": "why this is better"
  }
]

Types can be: "grammar", "style", or "word-choice". Return ONLY the JSON array.`
            }
        ];

        const content = await callAPI(messages);

        // Parse JSON response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return []; // No suggestions
        }

        const suggestions = JSON.parse(jsonMatch[0]);
        return suggestions.slice(0, 3); // Max 3 suggestions
    } catch (error) {
        console.error('Failed to get writing suggestions:', error);
        return []; // Return empty array on error (non-critical feature)
    }
}
