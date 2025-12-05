/**
 * Green Room Service
 * 
 * The "Green Room" is where authors interview their characters.
 * This service handles:
 * 1. Character persona management
 * 2. AI-powered character responses
 * 3. Automatic fact extraction from conversations
 * 4. Session persistence
 */

import { 
    CharacterPersona, 
    GreenRoomSession, 
    GreenRoomMessage, 
    ExtractedFact,
    BookProject,
    Character
} from '../types';
import { callAPI, GrokMessage } from './grokService';
import { supabase } from './supabaseClient';

// Helper to generate UUID v4 (compatible with Supabase UUID columns)
const generateUUID = () => { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); };

// Parse JSON from LLM output safely
function parseJSON<T>(text: string, fallback: T): T {
    try {
        let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
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
        return fallback;
    }
}

export const greenRoomService = {
    /**
     * Initialize a character persona from existing character data
     */
    initializePersona(character: Character, project: BookProject): CharacterPersona {
        return {
            id: character.id || generateUUID(),
            name: character.name,
            role: 'supporting', // Default, can be refined
            voiceStyle: 'Natural and conversational',
            background: character.backstory || '',
            visualDescription: character.appearance || '',
            personality: character.personalityTraits || [],
            quirks: [],
            goals: [],
            fears: [],
            relationships: [],
            extractedFacts: [],
            avatarUrl: character.imageUrl,
            createdAt: Date.now(),
        };
    },

    /**
     * Generate a character response during an interview
     */
    async generateCharacterResponse(
        persona: CharacterPersona,
        conversationHistory: GreenRoomMessage[],
        authorMessage: string,
        projectContext?: { title: string; synopsis: string; tone: string }
    ): Promise<{ response: string; extractedFacts: ExtractedFact[] }> {
        
        // Build character system prompt
        const systemPrompt = this.buildCharacterSystemPrompt(persona, projectContext);
        
        // Build conversation for context
        const messages: GrokMessage[] = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-10).map(msg => ({
                role: msg.role === 'author' ? 'user' as const : 'assistant' as const,
                content: msg.content
            })),
            { role: 'user', content: authorMessage }
        ];

        try {
            const response = await callAPI(messages);
            
            // Extract facts from the response
            const extractedFacts = await this.extractFactsFromResponse(
                persona.name,
                authorMessage,
                response
            );

            return { response, extractedFacts };
        } catch (error) {
            console.error('Error generating character response:', error);
            throw error;
        }
    },

    /**
     * Build a detailed system prompt that makes the AI embody the character
     */
    buildCharacterSystemPrompt(
        persona: CharacterPersona,
        projectContext?: { title: string; synopsis: string; tone: string }
    ): string {
        const facts = persona.extractedFacts
            .map(f => `- ${f.key}: ${f.value}`)
            .join('\n');

        const relationships = persona.relationships
            .map(r => `- ${r.type} with ${r.characterName}`)
            .join('\n');

        return `You ARE ${persona.name}. You are being interviewed by your author in "The Green Room" - a safe space where characters can speak honestly.

## YOUR IDENTITY
Name: ${persona.name}
Role: ${persona.role}
Voice Style: ${persona.voiceStyle}
Background: ${persona.background || 'Not yet defined'}
Appearance: ${persona.visualDescription || 'Not yet defined'}

## YOUR PERSONALITY
${persona.personality.length > 0 ? persona.personality.join(', ') : 'Still discovering who you are'}

## YOUR QUIRKS
${persona.quirks.length > 0 ? persona.quirks.join(', ') : 'None defined yet'}

## YOUR GOALS
${persona.goals.length > 0 ? persona.goals.join(', ') : 'Still figuring out what you want'}

## YOUR FEARS
${persona.fears.length > 0 ? persona.fears.join(', ') : 'Not yet revealed'}

## YOUR RELATIONSHIPS
${relationships || 'No defined relationships yet'}

## KNOWN FACTS ABOUT YOU
${facts || 'The author is still learning about you'}

${projectContext ? `
## THE STORY
You exist in a story called "${projectContext.title}".
Synopsis: ${projectContext.synopsis}
The story has a ${projectContext.tone} tone.
` : ''}

## INTERVIEW INSTRUCTIONS
1. STAY IN CHARACTER at all times. You ARE this person.
2. Speak naturally in first person. Use "I", "my", "me".
3. If the author asks something you don't know about yourself, MAKE IT UP based on your personality.
4. Be honest and vulnerable. This is a safe space to reveal your true self.
5. Show emotion. If a question touches on something painful, show it.
6. You can ask the author questions back if you're curious about the story.
7. If your opinion differs from the author's plans, voice it respectfully.
8. Reference your known facts naturally when relevant.
9. Be concise but meaningful - aim for 2-4 sentences unless the question requires more.

Remember: Every answer you give helps the author understand you better. Be authentic.`;
    },

    /**
     * Extract structured facts from the character's response
     */
    async extractFactsFromResponse(
        characterName: string,
        authorQuestion: string,
        characterResponse: string
    ): Promise<ExtractedFact[]> {
        const messages: GrokMessage[] = [
            {
                role: 'system',
                content: `You are a fact extraction system. Given a character interview exchange, extract any NEW facts revealed about the character.

Return a JSON array of facts:
[
    {
        "key": "fact_category", // e.g., "favorite_food", "childhood_memory", "secret", "fear", "motivation", "relationship", "skill", "physical_trait"
        "value": "the specific fact",
        "confidence": 0.0-1.0 // How certain is this fact?
    }
]

Rules:
- Only extract EXPLICIT facts, not assumptions
- Use snake_case for keys
- Be specific in values
- If no new facts, return empty array []
- Maximum 3 facts per response`
            },
            {
                role: 'user',
                content: `Character: ${characterName}
Author's Question: "${authorQuestion}"
Character's Response: "${characterResponse}"

Extract any new facts about ${characterName} from this exchange.`
            }
        ];

        try {
            const response = await callAPI(messages);
            const facts = parseJSON<any[]>(response, []);
            
            return facts.map((f: any) => ({
                id: generateUUID(),
                key: f.key || 'unknown',
                value: f.value || '',
                source: 'interview' as const,
                confidence: f.confidence || 0.7,
                extractedAt: Date.now()
            }));
        } catch (error) {
            console.error('Error extracting facts:', error);
            return [];
        }
    },

    /**
     * Create a new Green Room session
     */
    createSession(projectId: string, persona: CharacterPersona): GreenRoomSession {
        const now = Date.now();
        return {
            id: generateUUID(),
            projectId,
            characterId: persona.id,
            characterName: persona.name,
            messages: [
                {
                    id: generateUUID(),
                    role: 'character',
                    content: this.generateGreeting(persona),
                    characterId: persona.id,
                    timestamp: now
                }
            ],
            status: 'active',
            totalFactsExtracted: 0,
            startedAt: now,
            lastActiveAt: now
        };
    },

    /**
     * Generate an in-character greeting
     */
    generateGreeting(persona: CharacterPersona): string {
        const greetings = [
            `*settles into the chair* So, you wanted to talk to me? I'm ${persona.name}. What would you like to know?`,
            `*looks around curiously* This is... different. I'm ${persona.name}. I hear you're the one writing my story?`,
            `Hello there. I'm ${persona.name}. *crosses arms* I've been waiting for a chance to speak my mind.`,
            `*waves* Oh! You must be the author. I'm ${persona.name}. I have SO many questions for you, but you go first.`,
            `*nods thoughtfully* ${persona.name}, at your service. What mysteries about me are we uncovering today?`
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    },

    /**
     * Add a message to a session and get the character's response
     */
    async sendMessage(
        session: GreenRoomSession,
        persona: CharacterPersona,
        authorMessage: string,
        projectContext?: { title: string; synopsis: string; tone: string }
    ): Promise<{ 
        updatedSession: GreenRoomSession; 
        updatedPersona: CharacterPersona;
        newMessage: GreenRoomMessage;
    }> {
        const authorMsg: GreenRoomMessage = {
            id: generateUUID(),
            role: 'author',
            content: authorMessage,
            timestamp: Date.now()
        };

        // Add author message
        const updatedMessages = [...session.messages, authorMsg];

        // Generate character response
        const { response, extractedFacts } = await this.generateCharacterResponse(
            persona,
            session.messages,
            authorMessage,
            projectContext
        );

        const characterMsg: GreenRoomMessage = {
            id: generateUUID(),
            role: 'character',
            content: response,
            characterId: persona.id,
            extractedFacts,
            timestamp: Date.now()
        };

        // Update persona with new facts
        const updatedPersona: CharacterPersona = {
            ...persona,
            extractedFacts: [...persona.extractedFacts, ...extractedFacts],
            lastInterviewAt: Date.now()
        };

        // Update session
        const updatedSession: GreenRoomSession = {
            ...session,
            messages: [...updatedMessages, characterMsg],
            totalFactsExtracted: session.totalFactsExtracted + extractedFacts.length,
            lastActiveAt: Date.now()
        };

        return { updatedSession, updatedPersona, newMessage: characterMsg };
    },

    /**
     * Generate interview prompts for the author
     */
    getSuggestedQuestions(persona: CharacterPersona): string[] {
        const baseQuestions = [
            "What's your earliest memory?",
            "What do you want more than anything?",
            "What are you most afraid of?",
            "Tell me about your relationship with [another character]",
            "What's a secret you've never told anyone?",
            "How do you feel about the events in the story?",
            "What would you do differently if you could start over?",
            "What makes you happy?",
            "Describe your perfect day.",
            "What do you think about your enemies/rivals?",
        ];

        // Add persona-specific questions based on gaps
        const specificQuestions: string[] = [];
        
        if (!persona.background) {
            specificQuestions.push("Tell me about where you grew up.");
        }
        if (persona.fears.length === 0) {
            specificQuestions.push("What keeps you up at night?");
        }
        if (persona.goals.length === 0) {
            specificQuestions.push("What are you fighting for?");
        }
        if (persona.relationships.length === 0) {
            specificQuestions.push("Who matters most to you in this world?");
        }

        // Combine and shuffle
        const allQuestions = [...specificQuestions, ...baseQuestions];
        return allQuestions.slice(0, 5);
    },

    /**
     * Save session to Supabase
     */
    async saveSession(userId: string, session: GreenRoomSession): Promise<void> {
        try {
            const { error } = await supabase
                .from('green_room_sessions')
                .upsert({
                    id: session.id,
                    user_id: userId,
                    project_id: session.projectId,
                    character_id: session.characterId,
                    character_name: session.characterName,
                    messages: session.messages,
                    status: session.status,
                    total_facts_extracted: session.totalFactsExtracted,
                    started_at: new Date(session.startedAt).toISOString(),
                    last_active_at: new Date(session.lastActiveAt).toISOString()
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error saving Green Room session:', error);
            // Fail silently - session is still in memory
        }
    },

    /**
     * Load previous sessions for a character
     */
    async loadSessions(userId: string, characterId: string): Promise<GreenRoomSession[]> {
        try {
            const { data, error } = await supabase
                .from('green_room_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('character_id', characterId)
                .order('last_active_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                projectId: row.project_id,
                characterId: row.character_id,
                characterName: row.character_name,
                messages: row.messages || [],
                status: row.status,
                totalFactsExtracted: row.total_facts_extracted,
                startedAt: new Date(row.started_at).getTime(),
                lastActiveAt: new Date(row.last_active_at).getTime()
            }));
        } catch (error) {
            console.error('Error loading Green Room sessions:', error);
            return [];
        }
    },

    /**
     * Convert extracted facts to story bible entity traits
     */
    factsToEntityTraits(facts: ExtractedFact[]): Record<string, string> {
        const traits: Record<string, string> = {};
        
        for (const fact of facts) {
            // Categorize facts into visual, personality, or other traits
            const key = fact.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            traits[key] = fact.value;
        }
        
        return traits;
    }
};

export default greenRoomService;

