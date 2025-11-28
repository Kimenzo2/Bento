import { GenerationRequest, InfographicData, InfographicType, AgeGroup, InfographicStyle, GuideCharacter } from '../../types/infographic';
import { MASTER_GROK_PROMPT, MASTER_GEMINI_PROMPT } from './prompts/infographicPrompts';
import { generateStructuredContent, generateIllustration } from '../../services/geminiService';

export const InfographicService = {
    /**
     * Step 1: Generate Structured Content (The "Grok" Step)
     */
    generateContent: async (request: GenerationRequest): Promise<any> => {
        console.log('Generating infographic content with Grok persona...');

        const prompt = MASTER_GROK_PROMPT
            .replace('{USER_TOPIC}', request.topic)
            .replace('{AGE_GROUP}', request.ageGroup)
            .replace('{INFOGRAPHIC_TYPE}', request.type || 'Process');

        try {
            // Use generateStructuredContent which handles JSON parsing and error handling
            // We pass an empty schema/instruction because the prompt already contains strict JSON instructions
            const content = await generateStructuredContent(prompt);
            return content;
        } catch (error) {
            console.error('Error generating content:', error);
            throw new Error('Failed to generate infographic content');
        }
    },

    /**
     * Step 2: Generate Visual (The "Gemini" Step)
     */
    generateImage: async (content: any, request: GenerationRequest): Promise<string> => {
        console.log('Generating infographic image with Gemini persona...');

        const prompt = MASTER_GEMINI_PROMPT
            .replace('{INSERT_GROK_JSON_OUTPUT_HERE}', JSON.stringify(content, null, 2))
            .replace('{WIDTH}', '1200')
            .replace('{HEIGHT}', '1600')
            .replace('{ORIENTATION}', 'Portrait')
            .replace('{STYLE_TYPE}', request.style)
            .replace('{COLOR_SCHEME}', 'Age-appropriate vibrant colors')
            .replace('{AGE_GROUP}', request.ageGroup)
            .replace('{TYPE}', request.type || 'Process')
            .replace('{TITLE}', content.title)
            .replace('{SUBTITLE}', content.subtitle || '')
            .replace('{TITLE_SIZE}', '48')
            .replace('{TITLE_FONT}', 'Fredoka Bold')
            .replace('{HEADING_SIZE}', '32')
            .replace('{HEADING_FONT}', 'Fredoka SemiBold')
            .replace('{BODY_SIZE}', '18')
            .replace('{BODY_FONT}', 'Manrope Regular')
            .replace('{CHARACTER_TYPE}', request.guideCharacter)
            .replace('{INTERACTION_POINTS}', 'At each main section')
            .replace('{CHARACTER_DIALOGUE}', 'Educational commentary')
            .replace('{EMOTIONAL_STATE}', 'Friendly and encouraging')
            .replace('{FUN_FACT}', content.fun_facts?.[0] || '')
            .replace('{QUESTION}', content.questions_to_ponder?.[0] || '')
            .replace('{CONNECTION}', content.real_world_connection || '')
            .replace('{FLOW_DESCRIPTION}', 'Logical progression')
            .replace('{SEQUENCE}', 'Numbered 1-N');

        try {
            // Call the real Image Generation API
            const imageUrl = await generateIllustration(prompt, request.style);

            if (!imageUrl) {
                console.warn('Image generation returned null, using placeholder');
                return 'https://via.placeholder.com/1200x1600?text=Image+Generation+Failed';
            }

            return imageUrl;
        } catch (error) {
            console.error('Error generating image:', error);
            return 'https://via.placeholder.com/1200x1600?text=Image+Generation+Error';
        }
    },

    /**
     * Main Orchestrator
     */
    generate: async (request: GenerationRequest): Promise<InfographicData> => {
        // 1. Generate Content
        const content = await InfographicService.generateContent(request);

        // 2. Generate Image (Now using real API)
        // Note: In the future, we might want to store this URL or upload it to storage
        // For now, we'll use the returned URL directly (assuming it's a valid public URL or base64)
        // If generateIllustration returns base64, we might want to handle that.
        // But for now, let's assume it returns a URL or we handle it in the renderer.
        // Actually, let's comment this out for now to save credits while testing the FLOW, 
        // unless the user explicitly wants to burn credits.
        // The user asked "What do you mean we dont have a live image generation API connected?", implying they WANT it connected.
        // So I will uncomment it.
        const imageUrl = await InfographicService.generateImage(content, request);

        // 3. Map to InfographicData
        return {
            id: crypto.randomUUID(),
            topic: request.topic,
            title: content.title,
            ageGroup: request.ageGroup,
            type: request.type || InfographicType.PROCESS,
            style: request.style,
            guideCharacter: request.guideCharacter,
            colors: ['#FF6B6B', '#4ECDC4', '#FFE66D'], // Extract from content.color_coding_suggestions if possible
            content: {
                intro: content.core_concept,
                mainPoints: content.main_points.map((p: any) => p.heading),
                funFact: content.fun_facts?.[0] || 'Did you know?',
                keyTerm: {
                    term: content.vocabulary_to_highlight?.[0] || 'Term',
                    definition: 'Definition placeholder'
                },
                // Map structured content based on type
                steps: content.main_points.map((p: any) => ({
                    order: p.point_number,
                    title: p.heading,
                    description: p.content,
                    icon: p.visual_suggestion
                })),
                comparisonPoints: [], // TODO: Map if type is Comparison
                stats: [], // TODO: Map if type is Statistical
                timelineEvents: [] // TODO: Map if type is Timeline
            },
            createdAt: new Date()
        };
    }
};
