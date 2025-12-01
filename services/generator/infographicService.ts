import { GenerationRequest, InfographicData, InfographicType, AgeGroup, InfographicStyle, GuideCharacter } from '../../types/infographic';
import { MASTER_GROK_PROMPT, MASTER_GEMINI_PROMPT } from './prompts/infographicPrompts';
import { generateStructuredContent, generateIllustration } from '../../services/geminiService';

// Type for the AI-generated content structure
interface GeneratedContent {
    title: string;
    subtitle?: string;
    core_concept: string;
    main_points: Array<{
        point_number: number;
        heading: string;
        content: string;
        visual_suggestion?: string;
        visual_metaphor?: string;
        character_interaction?: string;
    }>;
    fun_facts?: string[];
    questions_to_ponder?: string[];
    real_world_connection?: string;
    vocabulary_to_highlight?: string[];
    common_misconceptions?: string;
    color_coding_suggestions?: Record<string, string>;
    difficulty_level?: string;
    estimated_reading_time?: string;
}

// Default content structure when API fails or returns invalid data
const createFallbackContent = (topic: string, type: string): GeneratedContent => ({
    title: `Learn About ${topic}`,
    subtitle: 'An educational infographic',
    core_concept: `Exploring the fascinating world of ${topic}`,
    main_points: [
        { point_number: 1, heading: 'Introduction', content: `Let's learn about ${topic}!`, visual_suggestion: 'Overview illustration', visual_metaphor: '', character_interaction: 'Introducing the topic' },
        { point_number: 2, heading: 'Key Facts', content: 'Important information about this topic.', visual_suggestion: 'Fact icons', visual_metaphor: '', character_interaction: 'Explaining facts' },
        { point_number: 3, heading: 'How It Works', content: 'Understanding the basics.', visual_suggestion: 'Process diagram', visual_metaphor: '', character_interaction: 'Breaking it down' }
    ],
    fun_facts: ['There\'s always something new to learn!'],
    questions_to_ponder: ['What would you like to know more about?'],
    real_world_connection: 'This topic relates to our everyday lives.',
    vocabulary_to_highlight: ['learning', 'discovery'],
    common_misconceptions: 'Keep an open mind and always verify information.',
    color_coding_suggestions: { main: 'blue', accent: 'yellow' },
    difficulty_level: 'Medium',
    estimated_reading_time: '3 minutes'
});

export const InfographicService = {
    /**
     * Step 1: Generate Structured Content (The "Grok" Step)
     */
    generateContent: async (request: GenerationRequest): Promise<GeneratedContent> => {
        console.log('📚 Generating infographic content with Grok persona...');
        console.log('📝 Topic:', request.topic);
        console.log('👶 Age Group:', request.ageGroup);
        console.log('📊 Type:', request.type);

        const prompt = MASTER_GROK_PROMPT
            .replace('{USER_TOPIC}', request.topic)
            .replace('{AGE_GROUP}', request.ageGroup)
            .replace('{INFOGRAPHIC_TYPE}', request.type || 'Process');

        try {
            // Use generateStructuredContent which handles JSON parsing and error handling
            const content = await generateStructuredContent<GeneratedContent>(prompt);
            
            // Validate the response has required fields
            if (!content || typeof content !== 'object') {
                console.warn('⚠️ Invalid content response, using fallback');
                return createFallbackContent(request.topic, request.type || 'Process');
            }
            
            // Ensure main_points exists and has items
            if (!content.main_points || !Array.isArray(content.main_points) || content.main_points.length === 0) {
                console.warn('⚠️ Missing main_points in response, using fallback');
                return createFallbackContent(request.topic, request.type || 'Process');
            }
            
            console.log('✅ Content generated successfully with', content.main_points?.length || 0, 'main points');
            return content;
        } catch (error) {
            console.error('❌ Error generating content:', error);
            // Return fallback content instead of throwing to allow graceful degradation
            console.log('⚠️ Using fallback content due to error');
            return createFallbackContent(request.topic, request.type || 'Process');
        }
    },

    /**
     * Step 2: Generate Visual (The "Gemini" Step)
     */
    generateImage: async (content: GeneratedContent, request: GenerationRequest): Promise<string> => {
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
        console.log('🎯 Starting infographic generation orchestration...');
        console.log('📋 Request:', JSON.stringify(request, null, 2));
        
        try {
            // 1. Generate Content
            console.log('📝 Step 1: Generating content...');
            const content = await InfographicService.generateContent(request);
            
            if (!content || !content.title) {
                throw new Error('Content generation returned invalid data');
            }
            console.log('✅ Content generated:', content.title);

            // 2. Generate Image (Now using real API)
            console.log('🎨 Step 2: Generating image...');
            const imageUrl = await InfographicService.generateImage(content, request);
            console.log('✅ Image URL:', imageUrl?.substring(0, 50) + '...');

            // 3. Map to InfographicData
            console.log('📦 Step 3: Mapping to InfographicData...');
            const result: InfographicData = {
                id: crypto.randomUUID(),
                topic: request.topic,
                title: content.title || `Learn About ${request.topic}`,
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
                    definition: content.common_misconceptions || 'A key concept to understand'
                },
                // Map structured content based on type
                steps: request.type === InfographicType.PROCESS ? content.main_points.map((p: any) => ({
                    order: p.point_number || 1,
                    title: p.heading || 'Step',
                    description: p.content || '',
                    icon: p.visual_suggestion || '📌'
                })) : [],
                comparisonPoints: request.type === InfographicType.COMPARISON ? content.main_points.map((p: any) => {
                    // Split heading by 'vs' to get the two items being compared
                    const parts = (p.heading || '').split(/\s+vs\s+/i);
                    return {
                        itemA: parts[0]?.trim() || 'Item A',
                        itemB: parts[1]?.trim() || 'Item B',
                        category: p.content || 'Comparison'
                    };
                }) : [],
                stats: request.type === InfographicType.STATISTICAL ? content.main_points.map((p: any) => {
                    // Try to extract numeric value from content
                    const numMatch = (p.content || '').match(/(\d+(?:\.\d+)?%?)/);
                    return {
                        label: p.heading || 'Statistic',
                        value: numMatch ? numMatch[1] : '0',
                        description: p.content || ''
                    };
                }) : [],
                timelineEvents: request.type === InfographicType.TIMELINE ? content.main_points.map((p: any) => {
                    // Try to extract year from heading
                    const yearMatch = (p.heading || '').match(/\d{4}/);
                    return {
                        date: yearMatch ? yearMatch[0] : `Event ${p.point_number || 1}`,
                        title: (p.heading || '').replace(/\d{4}/, '').trim() || 'Event',
                        description: p.content || ''
                    };
                }) : []
            },
            createdAt: new Date()
        };

            console.log('✅ Infographic data mapped successfully');
            return result;
        } catch (error) {
            console.error('❌ Error in generate orchestrator:', error);
            throw error;
        }
    }
};
