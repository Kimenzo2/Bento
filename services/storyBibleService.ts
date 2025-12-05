import { BookProject, StoryBible, StoryBeat, StoryEntity } from '../types';
import { callAPI, GrokMessage } from './grokService';

export interface ConsistencyIssue {
    pageNumber: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    entityId?: string;
}

// Helper to parse JSON from LLM output
function parseJSON<T>(text: string): T {
    try {
        // Remove markdown code blocks if present
        let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        // Sometimes LLMs add extra text before or after the JSON
        const firstBracket = cleanText.indexOf('{');
        const lastBracket = cleanText.lastIndexOf('}');
        const firstSquare = cleanText.indexOf('[');
        const lastSquare = cleanText.lastIndexOf(']');

        if (firstBracket !== -1 && lastBracket !== -1 && (firstSquare === -1 || firstBracket < firstSquare)) {
             cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        } else if (firstSquare !== -1 && lastSquare !== -1) {
             cleanText = cleanText.substring(firstSquare, lastSquare + 1);
        }

        return JSON.parse(cleanText);
    } catch (e) {
        console.error('Failed to parse JSON from LLM:', text);
        throw new Error('Failed to parse AI response');
    }
}

export const storyBibleService = {
    /**
     * Analyzes the entire book to build the Story Bible (entities, beats, themes).
     */
    async analyzeStory(project: BookProject): Promise<StoryBible> {
        const fullStoryText = project.chapters
            .flatMap(c => c.pages.map(p => `Page ${p.pageNumber}: ${p.text}`))
            .join('\n\n');

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are an expert story analyst and editor. Your task is to analyze a story and extract structured data for a "Story Bible".
                
                Return ONLY a valid JSON object with the following structure:
                {
                    "entities": [
                        {
                            "id": "string (unique id)",
                            "name": "string",
                            "type": "character" | "location" | "object",
                            "description": "string",
                            "visualTraits": "string",
                            "firstAppearancePage": number,
                            "occurrences": [number]
                        }
                    ],
                    "beats": [
                        {
                            "pageNumber": number,
                            "summary": "string",
                            "emotionalTone": "string",
                            "sentimentScore": number (-1.0 to 1.0),
                            "tensionLevel": number (0 to 10),
                            "charactersPresent": ["string (entity ids)"]
                        }
                    ],
                    "globalThemes": ["string"]
                }`
            },
            {
                role: 'user',
                content: `Analyze this story and extract a JSON object with: entities (characters/locations with visual traits), story beats (emotional tone, tension 0-10), and global themes.

                Story Content:
                ${fullStoryText}`
            }
        ];

        try {
            const response = await callAPI(messages);
            const result = parseJSON<any>(response);
            
            // Map result to StoryBible interface to ensure type safety
            const storyBible: StoryBible = {
                entities: result.entities || [],
                beats: result.beats || [],
                globalThemes: result.globalThemes || [],
                consistencyIssues: [] // Initialize empty
            };

            return storyBible;
        } catch (error) {
            console.error('Error analyzing story:', error);
            throw error;
        }
    },

    /**
     * Checks a specific page text against the bible.
     */
    async checkConsistency(text: string, bible: StoryBible, pageNumber: number): Promise<ConsistencyIssue[]> {
        // Filter bible to relevant entities to save context window if needed, 
        // but for now passing the whole bible structure (minus beats maybe?)
        const bibleContext = {
            entities: bible.entities,
            globalThemes: bible.globalThemes
        };

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a continuity editor. Your job is to check for consistency errors in a story.
                
                Return ONLY a valid JSON array of issues found. If no issues, return [].
                
                Issue structure:
                {
                    "pageNumber": number,
                    "description": "string",
                    "severity": "low" | "medium" | "high",
                    "entityId": "string (optional)"
                }`
            },
            {
                role: 'user',
                content: `Given this Story Bible [JSON], does this new text [TEXT] contradict anything? Return JSON array of issues.

                Story Bible:
                ${JSON.stringify(bibleContext)}

                New Text (Page ${pageNumber}):
                "${text}"`
            }
        ];

        try {
            const response = await callAPI(messages);
            const issues = parseJSON<ConsistencyIssue[]>(response);
            
            // Ensure pageNumber is set correctly
            return issues.map(issue => ({
                ...issue,
                pageNumber: pageNumber
            }));
        } catch (error) {
            console.error('Error checking consistency:', error);
            // Return empty array on error to not block the UI, but log it
            return [];
        }
    },

    /**
     * Generates visual beats for the storyboard.
     */
    async generateLivingStoryboard(project: BookProject): Promise<StoryBeat[]> {
        const fullStoryText = project.chapters
            .flatMap(c => c.pages.map(p => `Page ${p.pageNumber}: ${p.text}`))
            .join('\n\n');

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a storyboard artist. Your task is to break down a story into visual beats.
                
                Return ONLY a valid JSON array of StoryBeat objects:
                [
                    {
                        "pageNumber": number,
                        "summary": "string (visual description for storyboard)",
                        "emotionalTone": "string",
                        "sentimentScore": number (-1.0 to 1.0),
                        "tensionLevel": number (0 to 10),
                        "charactersPresent": ["string (names)"]
                    }
                ]`
            },
            {
                role: 'user',
                content: `Analyze the story and generate a list of visual story beats for a storyboard. Return a JSON array of StoryBeat objects.

                Story Content:
                ${fullStoryText}`
            }
        ];

        try {
            const response = await callAPI(messages);
            const beats = parseJSON<StoryBeat[]>(response);
            return beats;
        } catch (error) {
            console.error('Error generating storyboard:', error);
            throw error;
        }
    },

    /**
     * Analyzes content for age-appropriateness based on target audience.
     * Returns safety warnings if content doesn't match the audience.
     */
    async analyzeAudienceSafety(project: BookProject): Promise<{
        isAppropriate: boolean;
        warnings: Array<{
            type: 'vocabulary' | 'theme' | 'intensity' | 'content';
            description: string;
            severity: 'info' | 'warning' | 'critical';
            suggestion?: string;
        }>;
        readingLevel: string;
        recommendedAgeRange: string;
    }> {
        const text = project.chapters
            .flatMap(c => c.pages.map(p => `Page ${p.pageNumber}: ${p.text}`))
            .join('\n\n');
        const targetAudience = project.targetAudience || 'Children';

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a children's content safety expert and reading specialist. Your job is to analyze content for age-appropriateness.
                
                Return ONLY valid JSON with this structure:
                {
                    "isAppropriate": boolean,
                    "warnings": [
                        {
                            "type": "vocabulary" | "theme" | "intensity" | "content",
                            "description": "string",
                            "severity": "info" | "warning" | "critical",
                            "suggestion": "string (optional)"
                        }
                    ],
                    "readingLevel": "string (e.g., 'Grade 2', 'Pre-K')",
                    "recommendedAgeRange": "string (e.g., '4-6 years')"
                }`
            },
            {
                role: 'user',
                content: `Analyze this text for age-appropriateness. Target audience: "${targetAudience}".
                
                Text to analyze:
                "${text}"
                
                Check for:
                1. Vocabulary complexity (is it right for the age?)
                2. Themes (are they appropriate?)
                3. Emotional intensity (too scary/intense?)
                4. Content warnings (violence, mature themes, etc.)`
            }
        ];

        try {
            const response = await callAPI(messages);
            return parseJSON(response);
        } catch (error) {
            console.error('Error analyzing audience safety:', error);
            // Return safe default
            return {
                isAppropriate: true,
                warnings: [],
                readingLevel: 'Unknown',
                recommendedAgeRange: targetAudience
            };
        }
    },

    /**
     * Generates an emotional arc visualization for the story.
     */
    async generateEmotionalArc(project: BookProject): Promise<{
        arc: Array<{
            pageNumber: number;
            sentiment: number; // -1 to 1
            tension: number; // 0 to 10
            label: string;
        }>;
        climaxPage: number;
        pacing: 'slow' | 'medium' | 'fast' | 'uneven';
        suggestions: string[];
    }> {
        const fullStoryText = project.chapters
            .flatMap(c => c.pages.map(p => `Page ${p.pageNumber}: ${p.text}`))
            .join('\n\n');

        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a narrative structure expert. Analyze the emotional arc of a story.
                
                Return ONLY valid JSON:
                {
                    "arc": [
                        {
                            "pageNumber": number,
                            "sentiment": number (-1 to 1),
                            "tension": number (0 to 10),
                            "label": "string (e.g., 'Introduction', 'Rising Action', 'Climax')"
                        }
                    ],
                    "climaxPage": number,
                    "pacing": "slow" | "medium" | "fast" | "uneven",
                    "suggestions": ["string"]
                }`
            },
            {
                role: 'user',
                content: `Analyze the emotional arc of this story. Identify sentiment, tension, and narrative beats for each page.
                
                ${fullStoryText}`
            }
        ];

        try {
            const response = await callAPI(messages);
            return parseJSON(response);
        } catch (error) {
            console.error('Error generating emotional arc:', error);
            throw error;
        }
    }
};

