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
            console.log('🎨 Calling generateIllustration with style:', request.style);
            // Call the real Image Generation API
            const imageUrl = await generateIllustration(prompt, request.style);

            if (!imageUrl) {
                console.error('❌ generateIllustration returned null');
                console.log('Prompt used (first 200 chars):', prompt.substring(0, 200) + '...');
                console.warn('Image generation returned null, using placeholder');
                return 'https://via.placeholder.com/1200x1600?text=Image+Generation+Failed';
            }

            console.log('✅ Image generated successfully:', imageUrl.substring(0, 100) + '...');
            return imageUrl;
        } catch (error) {
            console.error('💥 Error generating image:', error);
            // Log more details
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
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
            imageUrl: imageUrl,
            content: {
                intro: content.core_concept,
                mainPoints: content.main_points.map((p: any) => p.heading),
                funFact: content.fun_facts?.[0] || 'Did you know?',
                keyTerm: {
                    term: content.vocabulary_to_highlight?.[0] || 'Term',
                    definition: 'Definition placeholder'
                },
                // Map structured content based on type
                // Map structured content based on type
                steps: request.type === InfographicType.PROCESS ? content.main_points.map((p: any) => ({
                    order: p.point_number,
                    title: p.heading,
                    description: p.content,
                    icon: p.visual_suggestion
                })) : [],
                comparisonPoints: request.type === InfographicType.COMPARISON ? content.main_points.map((p: any) => ({
                    itemA: p.heading.split(' vs ')[0] || 'Item A',
                    itemB: p.heading.split(' vs ')[1] || 'Item B',
                    category: p.content, // Fixed: was 'attribute', renderer expects 'category'
                    winner: 'DRAW' // AI would need to determine this, defaulting to DRAW
                })) : [],
                stats: request.type === InfographicType.STATISTICAL ? content.main_points.map((p: any) => ({
                    label: p.heading,
                    value: p.content.match(/\d+%?/) ? p.content.match(/\d+%?/)[0] : '50%', // Extract number or default
                    description: p.content
                })) : [],
                timelineEvents: request.type === InfographicType.TIMELINE ? content.main_points.map((p: any) => ({
                    date: p.heading.match(/\d{4}/) ? p.heading.match(/\d{4}/)[0] : `Step ${p.point_number}`, // Fixed: was 'year', renderer expects 'date'
                    title: p.heading.replace(/\d{4}/, '').trim(),
                    description: p.content
                })) : []
            },
            createdAt: new Date()
        };
    }
};
