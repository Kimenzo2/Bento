import { generateStructuredContent, generateIllustration } from '../geminiService';
import { CharacterProfile, CharacterSheet, VisualIdentity, EbookRequest } from '../../types/generator';
import { Type } from '@google/genai';

const SYSTEM_INSTRUCTION_ARTIST = `
You are the "Lead Character Artist" for a high-end animation studio (Pixar/Ghibli level).
Your goal is to take a basic character description and flesh it out into a complete, consistent visual identity.
You must define every visual aspect so that different artists (or AI models) can draw the character exactly the same way every time.
Focus on:
- Distinctive silhouettes
- Color theory (harmonious palettes)
- Texture and material details (e.g., "worn denim," "silk ribbon")
- Expression range (how their face moves)
`;

export const generateCharacterSheet = async (
    profile: CharacterProfile,
    request: EbookRequest
): Promise<CharacterSheet> => {
    const prompt = `
    Create a detailed Character Sheet for:
    Name: ${profile.name}
    Role: ${profile.role}
    Basic Description: ${profile.description}
    
    Context:
    Story Style: ${request.style}
    Tone: ${request.tone}
    Target Audience: ${request.targetAudience}

    Return a JSON object with a 'visualIdentity' object containing:
    - faceStructure (detailed geometry, e.g., "round face with sharp chin")
    - bodyType (shape language, e.g., "tall and lanky, triangular shape")
    - clothingStyle (specific fabrics, cuts, and colors)
    - accessories (list of items they always carry/wear)
    - expressionRange (list of key expressions)
    - colorPalette (array of 3-5 hex codes specific to this character)

    Also provide:
    - referenceImagePrompt: A single, highly detailed paragraph describing this character in a neutral pose, suitable for generating a reference image. Include the art style keywords.
    - styleEnforcement: A short string of keywords to append to every prompt involving this character to ensure consistency (e.g., "3D render, Pixar style, soft lighting").
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            visualIdentity: {
                type: Type.OBJECT,
                properties: {
                    faceStructure: { type: Type.STRING },
                    bodyType: { type: Type.STRING },
                    clothingStyle: { type: Type.STRING },
                    accessories: { type: Type.ARRAY, items: { type: Type.STRING } },
                    expressionRange: { type: Type.ARRAY, items: { type: Type.STRING } },
                    colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            },
            referenceImagePrompt: { type: Type.STRING },
            styleEnforcement: { type: Type.STRING }
        }
    };

    try {
        const result = await generateStructuredContent<{
            visualIdentity: VisualIdentity;
            referenceImagePrompt: string;
            styleEnforcement: string;
        }>(prompt, schema, SYSTEM_INSTRUCTION_ARTIST);

        return {
            id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            baseProfile: profile,
            visualIdentity: result.visualIdentity,
            referenceImagePrompt: result.referenceImagePrompt,
            styleEnforcement: result.styleEnforcement
        };
    } catch (error) {
        console.error("Failed to generate character sheet:", error);
        throw error;
    }
};

export const createConsistentScenePrompt = (
    sheet: CharacterSheet,
    sceneDescription: string,
    action: string,
    mood: string
): string => {
    // Construct a prompt that enforces the character's visual identity
    return `
    Subject: ${sheet.baseProfile.name} (${sheet.visualIdentity.faceStructure}, ${sheet.visualIdentity.bodyType}, wearing ${sheet.visualIdentity.clothingStyle}).
    Action: ${action}.
    Scene: ${sceneDescription}.
    Mood: ${mood}.
    
    Visual Identity Enforcement:
    - Must match reference: ${sheet.referenceImagePrompt.substring(0, 100)}...
    - Accessories: ${sheet.visualIdentity.accessories.join(", ")}.
    - Colors: ${sheet.visualIdentity.colorPalette.join(", ")}.
    
    Style: ${sheet.styleEnforcement}.
    `;
};
