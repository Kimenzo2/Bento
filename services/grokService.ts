import { BookProject } from '../types';

const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;
const GROK_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const GROK_MODEL = 'x-ai/grok-4.1-fast:free';

interface GrokMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    reasoning_details?: any;
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

        const response = await fetch(GROK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages,
                reasoning: { enabled: true }
            })
        });

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.statusText}`);
        }

        const result = await response.json();
        return result.choices[0].message.content.trim();
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
    try {
        // Collect all text from the book
        const allPages = project.chapters.flatMap(ch => ch.pages);
        const bookText = allPages.map((p, i) => `Page ${p.pageNumber}: ${p.text}`).join('\n\n');

        // Get character names
        const characterNames = project.characters?.map(c => c.name).join(', ') || 'Unknown characters';

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a story consistency analyst. Analyze the book for character consistency issues.`
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

        const response = await fetch(GROK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages,
                reasoning: { enabled: true }
            })
        });

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.statusText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content.trim();

        // Parse JSON response (remove markdown code blocks if present)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format from Grok');
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
    try {
        if (!text || text.length < 10) {
            return []; // Don't suggest for very short text
        }

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a writing assistant for children's book authors. Provide helpful, actionable suggestions.`
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

        const response = await fetch(GROK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages,
                reasoning: { enabled: true }
            })
        });

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.statusText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content.trim();

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
