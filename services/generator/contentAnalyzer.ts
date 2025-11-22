import { generateStructuredContent } from '../geminiService';
import { EbookRequest, ContentStructure } from '../../types/generator';
import { Type } from '@google/genai';

const SYSTEM_INSTRUCTION_ANALYZER = `
You are the "Brain" of the Next-Gen Ebook Generator.
Your goal is to analyze a user's request and create a comprehensive "Ebook Blueprint".
You must define the narrative arc, visual strategy, emotional color palette, and character needs.
Do NOT generate the full book text yet. Focus on the STRUCTURE and VISUAL DIRECTION.
`;

export const analyzeContent = async (request: EbookRequest): Promise<ContentStructure> => {
    const prompt = `
    Analyze this ebook request and create a blueprint:
    Topic: ${request.topic}
    Target Audience: ${request.targetAudience}
    Tone: ${request.tone}
    Style: ${request.style}
    Page Count: ${request.pageCount}
    ${request.brandProfile ? `Brand: ${request.brandProfile.name} (${request.brandProfile.guidelines})` : ''}

    REQUIREMENTS:
    1. Narrative Arc: Break down the flow (Intro -> Learning -> Mastery)
    2. Visual Strategy: Define metaphors (e.g., "Data as water", "Ideas as light bulbs")
    3. Color Palette: Choose colors based on emotion (e.g., Blue for trust, Orange for energy)
    4. Character Needs: Define the main character/mascot needed
    5. Pages: Outline each page with scene description, mood, and layout type

    Return a JSON object matching the ContentStructure interface.
  `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            synopsis: { type: Type.STRING },
            narrativeArc: {
                type: Type.OBJECT,
                properties: {
                    introduction: { type: Type.STRING },
                    learning: { type: Type.STRING },
                    mastery: { type: Type.STRING }
                }
            },
            visualStrategy: {
                type: Type.OBJECT,
                properties: {
                    metaphors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    motifs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    artStyleDetails: { type: Type.STRING }
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
            characterNeeds: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        role: { type: Type.STRING },
                        description: { type: Type.STRING },
                        visualTraits: {
                            type: Type.OBJECT,
                            properties: {
                                eyes: { type: Type.STRING },
                                hair: { type: Type.STRING },
                                body: { type: Type.STRING },
                                clothing: { type: Type.STRING },
                                distinctiveFeatures: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        },
                        personality: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            },
            pages: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        pageNumber: { type: Type.INTEGER },
                        purpose: { type: Type.STRING },
                        scene: { type: Type.STRING },
                        characterAction: { type: Type.STRING },
                        expression: { type: Type.STRING },
                        background: { type: Type.STRING },
                        props: { type: Type.ARRAY, items: { type: Type.STRING } },
                        cameraAngle: { type: Type.STRING },
                        mood: { type: Type.STRING },
                        visualMetaphor: { type: Type.STRING },
                        textPlacement: { type: Type.STRING },
                        visualEnergy: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        wordCount: { type: Type.INTEGER },
                        layoutTemplate: { type: Type.STRING, enum: ['full-bleed', 'split-horizontal', 'split-vertical', 'text-overlay', 'comic-panel'] }
                    }
                }
            }
        }
    };

    return generateStructuredContent<ContentStructure>(prompt, schema, SYSTEM_INSTRUCTION_ANALYZER);
};
