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
import { callGreenRoomAI, generateCharacterResponse, extractFactsFromConversation } from './greenRoomAIService';
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
     * Initialize a character persona from existing character data with deep personality integration
     */
    initializePersona(character: Character, project: BookProject): CharacterPersona {
        // Build a rich voice style from personality data
        let voiceStyle = 'Natural and conversational';
        if (character.voiceProfile) {
            const vp = character.voiceProfile;
            voiceStyle = `${vp.tone}. Vocabulary: ${vp.vocabulary}. ${vp.laughStyle ? `Laughs: ${vp.laughStyle}` : ''}`;
        } else if (character.behavioralPatterns?.speechPatterns) {
            voiceStyle = character.behavioralPatterns.speechPatterns;
        }

        // Build comprehensive background from all available data
        let background = character.backstory || '';
        if (character.formativeExperiences) {
            const fe = character.formativeExperiences;
            if (fe.definingMoment) background += `\n\nDefining moment: ${fe.definingMoment}`;
            if (fe.childhoodMemory) background += `\n\nCore memory: ${fe.childhoodMemory}`;
        }
        if (character.coreIdentity) {
            const ci = character.coreIdentity;
            if (ci.coreBelief) background += `\n\nCore belief: ${ci.coreBelief}`;
            if (ci.moralCode) background += `\n\nMoral code: ${ci.moralCode}`;
        }

        // Combine all personality traits
        const personality = [
            ...(character.personalityTraits || []),
            ...(character.traits || [])
        ];

        // Extract quirks from multiple sources
        const quirks = [
            ...(character.quirks || []),
            ...(character.voiceProfile?.nonverbalTics || []),
            ...(character.behavioralPatterns?.habits || [])
        ];

        // Extract goals
        const goals = character.goals || (character.coreIdentity ? [
            character.coreIdentity.greatestDesire
        ].filter(Boolean) as string[] : []);

        // Extract fears
        const fears = character.fears || (character.coreIdentity ? [
            character.coreIdentity.greatestFear
        ].filter(Boolean) as string[] : []);

        // Build visual description from all appearance data
        let visualDescription = character.appearance || character.visualTraits || '';
        
        // Create initial extracted facts from deep personality data
        const extractedFacts: ExtractedFact[] = [];
        
        if (character.coreIdentity) {
            if (character.coreIdentity.flaw) {
                extractedFacts.push({ id: generateUUID(), key: 'character_flaw', value: character.coreIdentity.flaw, source: 'profile', confidence: 1.0, extractedAt: Date.now() });
            }
            if (character.coreIdentity.strength) {
                extractedFacts.push({ id: generateUUID(), key: 'character_strength', value: character.coreIdentity.strength, source: 'profile', confidence: 1.0, extractedAt: Date.now() });
            }
            if (character.coreIdentity.lie) {
                extractedFacts.push({ id: generateUUID(), key: 'lie_believed', value: character.coreIdentity.lie, source: 'profile', confidence: 1.0, extractedAt: Date.now() });
            }
            if (character.coreIdentity.truth) {
                extractedFacts.push({ id: generateUUID(), key: 'truth_to_learn', value: character.coreIdentity.truth, source: 'profile', confidence: 1.0, extractedAt: Date.now() });
            }
        }
        
        if (character.innerConflicts?.length) {
            extractedFacts.push({ id: generateUUID(), key: 'inner_conflicts', value: character.innerConflicts.join('; '), source: 'profile', confidence: 1.0, extractedAt: Date.now() });
        }
        
        if (character.psychologicalProfile) {
            const pp = character.psychologicalProfile;
            extractedFacts.push({ 
                id: generateUUID(),
                key: 'big_five_profile', 
                value: `Openness: ${pp.openness}, Conscientiousness: ${pp.conscientiousness}, Extraversion: ${pp.extraversion}, Agreeableness: ${pp.agreeableness}, Neuroticism: ${pp.neuroticism}`, 
                source: 'profile', 
                confidence: 1.0,
                extractedAt: Date.now() 
            });
        }
        
        if (character.relationshipStyle) {
            const rs = character.relationshipStyle;
            extractedFacts.push({ 
                id: generateUUID(),
                key: 'relationship_style', 
                value: `Attachment: ${rs.attachmentStyle}, Trust: ${rs.trustLevel}, Conflict: ${rs.conflictStyle}, Love language: ${rs.loveLanguage}`, 
                source: 'profile', 
                confidence: 1.0,
                extractedAt: Date.now() 
            });
        }
        
        if (character.voiceProfile?.catchphrases?.length) {
            extractedFacts.push({ id: generateUUID(), key: 'catchphrases', value: character.voiceProfile.catchphrases.join(' | '), source: 'profile', confidence: 1.0, extractedAt: Date.now() });
        }
        
        if (character.arcPotential) {
            extractedFacts.push({ 
                id: generateUUID(),
                key: 'character_arc', 
                value: `From: ${character.arcPotential.startingState} → Through: ${character.arcPotential.potentialGrowth} → To: ${character.arcPotential.endingState}`, 
                source: 'profile', 
                confidence: 1.0,
                extractedAt: Date.now() 
            });
        }

        return {
            id: character.id || generateUUID(),
            name: character.name,
            role: 'supporting', // Default, can be refined
            voiceStyle,
            background,
            visualDescription,
            personality,
            quirks,
            goals,
            fears,
            relationships: [],
            extractedFacts,
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
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system' as const, content: systemPrompt },
            ...conversationHistory.slice(-10).map(msg => ({
                role: msg.role === 'author' ? 'user' as const : 'assistant' as const,
                content: msg.content
            })),
            { role: 'user', content: authorMessage }
        ];

        try {
            const response = await callGreenRoomAI(messages);
            
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
     * Build a detailed system prompt that makes the AI embody the character with deep psychology
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

        // Build Big Five interpretation if available
        const bigFiveFact = persona.extractedFacts.find(f => f.key === 'big_five_profile');
        let bigFiveSection = '';
        if (bigFiveFact) {
            bigFiveSection = `
## YOUR PSYCHOLOGICAL PROFILE (Big Five Traits)
${bigFiveFact.value}
Interpret these in your responses - high openness means creative and curious, high neuroticism means more anxious, etc.`;
        }

        // Build inner conflicts section if available
        const conflictsFact = persona.extractedFacts.find(f => f.key === 'inner_conflicts');
        let conflictsSection = '';
        if (conflictsFact) {
            conflictsSection = `
## YOUR INNER CONFLICTS
${conflictsFact.value}
Let these tensions subtly influence your responses. You are not a simple person.`;
        }

        // Build character arc section if available
        const arcFact = persona.extractedFacts.find(f => f.key === 'character_arc');
        let arcSection = '';
        if (arcFact) {
            arcSection = `
## YOUR CHARACTER ARC
${arcFact.value}
You are currently at the beginning of this journey. Hints of your potential growth may emerge.`;
        }

        // Build lie/truth section if available
        const lieFact = persona.extractedFacts.find(f => f.key === 'lie_believed');
        const truthFact = persona.extractedFacts.find(f => f.key === 'truth_to_learn');
        let lieSection = '';
        if (lieFact || truthFact) {
            lieSection = `
## YOUR DEEPEST BELIEFS
${lieFact ? `The lie you believe: "${lieFact.value}"` : ''}
${truthFact ? `The truth you need to learn: "${truthFact.value}"` : ''}
You cling to your lie because it protects you. The truth is what your journey will teach you.`;
        }

        // Build catchphrases section if available
        const catchphrasesFact = persona.extractedFacts.find(f => f.key === 'catchphrases');
        let catchphrasesSection = '';
        if (catchphrasesFact) {
            catchphrasesSection = `
## YOUR SIGNATURE PHRASES
Use these naturally when appropriate: ${catchphrasesFact.value}`;
        }

        // Build relationship style section if available
        const relStyleFact = persona.extractedFacts.find(f => f.key === 'relationship_style');
        let relStyleSection = '';
        if (relStyleFact) {
            relStyleSection = `
## HOW YOU CONNECT WITH OTHERS
${relStyleFact.value}
This affects how you interact with the author and discuss relationships.`;
        }

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
${bigFiveSection}
${conflictsSection}
${arcSection}
${lieSection}
${catchphrasesSection}
${relStyleSection}

## KNOWN FACTS ABOUT YOU
${facts || 'The author is still learning about you'}

${projectContext ? `
## THE STORY
You exist in a story called "${projectContext.title}".
Synopsis: ${projectContext.synopsis}
The story has a ${projectContext.tone} tone.
` : ''}

## INTERVIEW INSTRUCTIONS
1. STAY IN CHARACTER at all times. You ARE this person, with all your complexities and contradictions.
2. Speak naturally in first person. Use "I", "my", "me".
3. Your Big Five traits should subtly influence how you communicate - introverts pause more, agreeable characters soften criticism, neurotic characters show anxiety.
4. If the author asks something you don't know about yourself, MAKE IT UP based on your deep psychological profile.
5. Be honest and vulnerable. This is a safe space to reveal your true self, including your inner conflicts.
6. Show emotion. If a question touches on something painful or relates to your fears/regrets, show it in your response.
7. You can ask the author questions back if you're curious about the story.
8. If your opinion differs from the author's plans, voice it respectfully - your inner conflicts may make you uncertain.
9. Reference your known facts and use your catchphrases naturally when relevant.
10. Be concise but meaningful - aim for 2-4 sentences unless the question requires more.
11. Let your character flaw and lie subtly influence your perspective - you don't see them as flaws.

Remember: Every answer you give helps the author understand you better. Be authentic, complex, and real.`;
    },

    /**
     * Extract structured facts from the character's response
     */
    async extractFactsFromResponse(
        characterName: string,
        authorQuestion: string,
        characterResponse: string
    ): Promise<ExtractedFact[]> {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            {
                role: 'system' as const,
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
            const response = await callGreenRoomAI(messages);
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

