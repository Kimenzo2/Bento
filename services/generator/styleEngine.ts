import { generateStructuredContent, generateIllustration } from '../geminiService';
import { EbookRequest, StyleGuide, ColorPalette } from '../../types/generator';
import { Type } from '@google/genai';

const SYSTEM_INSTRUCTION_STYLE_ARCHITECT = `
You are the "Lead Art Director" for a premium ebook studio.
Your role is to define a comprehensive Style Guide that ensures PERFECT visual consistency across all pages.
You must specify every technical detail of the art style so that different AI models (or artists) 
produce visually identical results.

Focus on:
- Precise rendering techniques (lighting, shadows, textures)
- Color theory and palette restrictions
- Line weights and stroke characteristics
- Composition rules and camera angles
`;

export const generateStyleGuide = async (request: EbookRequest): Promise<StyleGuide> => {
    const prompt = `
    Create a comprehensive Style Guide for an ebook with these requirements:
    Topic: ${request.topic}
    Style: ${request.style}
    Tone: ${request.tone}
    Target Audience: ${request.targetAudience}
    
    Return a JSON object with:
    
    1. artStyle:
       - name: The specific art style name (e.g., "Modern 3D Cartoon", "Flat Design")
       - description: Detailed description of the visual aesthetic
       - technicalSpecs:
         * lineWeight: Exact stroke specifications
         * renderingTechnique: How images should be rendered (shading, lighting)
         * textureApproach: Texture and material treatment
         * lightingModel: Lighting setup (e.g., "soft three-point lighting")
    
    2. colorPalette:
       - primary: Array of 2-3 hex codes for dominant colors
       - accent: Array of 2-3 hex codes for highlights
       - neutral: Array of 2-3 hex codes for backgrounds/text
       - special: Array of 1-2 hex codes for key moments
       - background: Single hex code for default background
       - text: Single hex code for default text
    
    3. styleEnforcementPrompt: A concise string (50-100 words) describing the exact style 
       to append to EVERY image generation prompt for consistency. Include:
       - Art style keywords
       - Lighting instructions
       - Rendering technique
       - Quality level
    
    4. consistencyRules: Array of specific rules (e.g., "Always use soft shadows", 
       "No gradients in backgrounds", "Character outlines must be 2px")
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            artStyle: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    technicalSpecs: {
                        type: Type.OBJECT,
                        properties: {
                            lineWeight: { type: Type.STRING },
                            renderingTechnique: { type: Type.STRING },
                            textureApproach: { type: Type.STRING },
                            lightingModel: { type: Type.STRING }
                        }
                    }
                }
            },
            colorPalette: {
                type: Type.OBJECT,
                properties: {
                    primary: { type: Type.ARRAY, items: { type: Type.STRING } },
                    accent: { type: Type.ARRAY, items: { type: Type.STRING } },
                    neutral: { type: Type.ARRAY, items: { type: Type.STRING } },
                    special: { type: Type.ARRAY, items: { type: Type.STRING } },
                    background: { type: Type.STRING },
                    text: { type: Type.STRING }
                }
            },
            styleEnforcementPrompt: { type: Type.STRING },
            consistencyRules: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    };

    try {
        const result = await generateStructuredContent<{
            artStyle: StyleGuide['artStyle'];
            colorPalette: ColorPalette;
            styleEnforcementPrompt: string;
            consistencyRules: string[];
        }>(prompt, schema, SYSTEM_INSTRUCTION_STYLE_ARCHITECT);

        return {
            id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            artStyle: result.artStyle,
            colorPalette: result.colorPalette,
            styleEnforcementPrompt: result.styleEnforcementPrompt,
            consistencyRules: result.consistencyRules
        };
    } catch (error) {
        console.error("Failed to generate style guide:", error);
        throw error;
    }
};

/**
 * Creates a style-enforced image prompt by combining the base prompt with style guide rules
 */
export const createStyleEnforcedPrompt = (
    basePrompt: string,
    styleGuide: StyleGuide,
    previousPageImageUrl?: string
): string => {
    let enforcedPrompt = basePrompt;

    // Add style enforcement
    enforcedPrompt += `\n\n===== STYLE CONSISTENCY REQUIREMENTS =====\n`;
    enforcedPrompt += styleGuide.styleEnforcementPrompt;

    // Add technical specs
    enforcedPrompt += `\n\nTECHNICAL SPECIFICATIONS:\n`;
    enforcedPrompt += `- Line Weight: ${styleGuide.artStyle.technicalSpecs.lineWeight}\n`;
    enforcedPrompt += `- Rendering: ${styleGuide.artStyle.technicalSpecs.renderingTechnique}\n`;
    enforcedPrompt += `- Textures: ${styleGuide.artStyle.technicalSpecs.textureApproach}\n`;
    enforcedPrompt += `- Lighting: ${styleGuide.artStyle.technicalSpecs.lightingModel}\n`;

    // Add color palette
    enforcedPrompt += `\nCOLOR PALETTE (USE ONLY THESE):\n`;
    enforcedPrompt += `- Primary: ${styleGuide.colorPalette.primary.join(', ')}\n`;
    enforcedPrompt += `- Accent: ${styleGuide.colorPalette.accent.join(', ')}\n`;
    enforcedPrompt += `- Neutral: ${styleGuide.colorPalette.neutral.join(', ')}\n`;

    // Add consistency rules
    enforcedPrompt += `\nCONSISTENCY RULES:\n`;
    styleGuide.consistencyRules.forEach(rule => {
        enforcedPrompt += `- ${rule}\n`;
    });

    // Add reference to previous page if available
    if (previousPageImageUrl) {
        enforcedPrompt += `\n===== CRITICAL =====\n`;
        enforcedPrompt += `MATCH THE EXACT STYLE OF THE PREVIOUS PAGE.\n`;
        enforcedPrompt += `Reference Image: ${previousPageImageUrl}\n`;
        enforcedPrompt += `Maintain IDENTICAL rendering technique, lighting, and visual quality.\n`;
    }

    enforcedPrompt += `\nQuality: Publication-ready, 4K resolution, professional illustration.`;

    return enforcedPrompt;
};
