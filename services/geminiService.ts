import { GoogleGenAI, Type } from "@google/genai";
import { BookProject, GenerationSettings, ArtStyle } from "../types";

// Declare process for Vite build compatibility
declare const process: { env: { API_KEY: string } };

// API Key Rotation Logic
const API_KEYS = [
  "AIzaSyASBU6gbFFAzYcJeTzx2fUIg-Hjzthec40",
  "AIzaSyB5BKaBAsru3etCQZl6Z3V8E5f5lbkHMNw",
  process.env.API_KEY // Fallback to env var if available
].filter(key => key && key.length > 0);

let currentKeyIndex = 0;

const getClient = () => {
  if (API_KEYS.length === 0) {
    throw new Error("No API Keys available. Please configure your environment variables or check hardcoded keys.");
  }
  const apiKey = API_KEYS[currentKeyIndex];
  // console.log(`Using API Key index: ${currentKeyIndex}`); // Debug log
  return new GoogleGenAI({ apiKey });
};

const rotateKey = () => {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`Switched to API Key index: ${currentKeyIndex}`);
};

/**
 * Wrapper to execute Gemini calls with automatic key rotation on failure
 */
const executeWithRetry = async <T>(operation: (client: GoogleGenAI) => Promise<T>): Promise<T> => {
  let lastError: any;

  // Try each key once
  for (let i = 0; i < API_KEYS.length; i++) {
    try {
      const client = getClient();
      return await operation(client);
    } catch (error: any) {
      console.warn(`Attempt failed with key index ${currentKeyIndex}:`, error.message);
      lastError = error;

      // Check if error is related to quota or permission (429, 403, etc)
      // If it's a 400 (Bad Request), rotation might not help, but we'll try anyway for robustness
      rotateKey();
    }
  }

  throw new Error(`All API keys failed. Last error: ${lastError?.message}`);
};

const SYSTEM_INSTRUCTION_ARCHITECT = `
You are the "Story Architect Agent" of the Genesis Ebook System. 
Your goal is to structure a compelling book based on user input.
Create a JSON structure containing the title, synopsis, characters, and a breakdown of chapters and pages.
For each page, provide the narrative text and a highly detailed, cinematic image prompt for the "Visual Synthesis Agent" to use later.
Ensure the image prompts describe lighting, camera angle, character consistency, and style.
`;

export const generateBookStructure = async (settings: GenerationSettings): Promise<Partial<BookProject>> => {
  const modelId = "gemini-2.5-flash"; // Optimized for text and logic

  let specificInstructions = "";

  if (settings.brandProfile) {
    specificInstructions += `
    \n*** BRAND VOICE ENFORCEMENT ***
    You must strictly adhere to the following brand guidelines:
    Brand Name: ${settings.brandProfile.name}
    Tone/Guidelines: ${settings.brandProfile.guidelines}
    Sample Text (Mimic this style): "${settings.brandProfile.sampleText}"
    Visual Identity Colors: ${settings.brandProfile.colors.join(", ")} (incorporate these colors into image prompts where appropriate).
    `;
  }

  if (settings.isBranching) {
    specificInstructions += `
    \n*** CHOOSE YOUR OWN ADVENTURE MODE ***
    Create a branching narrative. 
    - Most pages should have 2-3 'choices' that lead to different page numbers.
    - Ensure the story flows logically based on these choices.
    - Some pages will be endings.
    - Map out the page numbers carefully so choices point to valid existing pages.
    `;
  } else {
    specificInstructions += `
    \n*** LINEAR NARRATIVE ***
    Create a sequential story from page 1 to ${settings.pageCount}.
    `;
  }

  const prompt = `
    Create a detailed book plan for:
    Topic: ${settings.prompt}
    Style: ${settings.style}
    Tone: ${settings.tone}
    Target Audience: ${settings.audience}
    Approximate Length: ${settings.pageCount} pages total.
    ${specificInstructions}

    Return a JSON object with:
    - title
    - synopsis
    - characters (array of name, description, visualTraits)
    - chapters (array of title, pages array)
    
    Each page object must have:
    - pageNumber (Integer)
    - text (The actual story content for this page)
    - imagePrompt (A detailed prompt for generating the illustration, include style keywords like ${settings.style})
    - layoutType (Choose one: 'full-bleed', 'split-horizontal', 'split-vertical', 'text-only')
    ${settings.isBranching ? "- choices (Array of objects with 'text' and 'targetPageNumber')" : ""}
  `;

  return executeWithRetry(async (client) => {
    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_ARCHITECT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            synopsis: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualTraits: { type: Type.STRING },
                }
              }
            },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  pages: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pageNumber: { type: Type.INTEGER },
                        text: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING },
                        layoutType: { type: Type.STRING },
                        choices: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              text: { type: Type.STRING },
                              targetPageNumber: { type: Type.INTEGER }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!response.text) throw new Error("No response from Story Architect");
    return JSON.parse(response.text) as Partial<BookProject>;
  });
};

/**
 * Generic function to generate structured JSON content using Gemini
 * @param prompt - The prompt to send to the model
 * @param schema - The JSON schema to enforce structure (optional but recommended)
 * @param systemInstruction - System prompt to guide the model
 */
export const generateStructuredContent = async <T>(
  prompt: string,
  schema?: any,
  systemInstruction?: string
): Promise<T> => {
  const modelId = "gemini-2.5-flash";

  return executeWithRetry(async (client) => {
    const config: any = {
      responseMimeType: "application/json",
    };

    if (schema) {
      config.responseSchema = schema;
    }

    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config
    });

    if (!response.text) throw new Error("No response from Gemini");
    return JSON.parse(response.text) as T;
  });
};

export const generateIllustration = async (imagePrompt: string, style: string): Promise<string | null> => {
  const modelId = "gemini-2.5-flash"; // Or an appropriate image generation model ID

  try {
    return await executeWithRetry(async (client) => {
      const fullPrompt = `Style: ${style}. ${imagePrompt}. High quality, cinematic lighting, 8k resolution.`;

      const response = await client.models.generateContent({
        model: modelId,
        contents: fullPrompt,
        config: {
          // responseMimeType is NOT supported for image generation models in this context usually, 
          // but we just want the inlineData. 
        }
      });

      // Check for inline data (image)
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      return null;
    });
  } catch (error) {
    console.error("Visual Synthesis Agent failed after retries:", error);
    return null;
  }
};

export const generateRefinedImage = async (
  prompt: string,
  params: {
    styleA: string,
    styleB?: string,
    mixRatio?: number,
    lighting?: string,
    camera?: string,
    characterDescription?: string
  }
): Promise<string | null> => {
  const modelId = "gemini-2.5-flash-image";

  let styleInstruction = `Style: ${params.styleA}`;
  if (params.styleB && params.mixRatio !== undefined) {
    styleInstruction = `Visual Style: A blend of ${params.mixRatio}% ${params.styleA} and ${100 - params.mixRatio}% ${params.styleB}.`;
  }

  let composition = "";
  if (params.lighting) composition += ` Lighting: ${params.lighting}.`;
  if (params.camera) composition += ` Camera Angle: ${params.camera}.`;

  const fullPrompt = `
    ${styleInstruction}
    ${composition}
    Subject: ${prompt}.
    ${params.characterDescription ? `Character Details: ${params.characterDescription}` : ''}
    High quality, detailed, cinematic composition, 8k resolution.
  `;

  try {
    return await executeWithRetry(async (client) => {
      const response = await client.models.generateContent({
        model: modelId,
        contents: fullPrompt,
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    });
  } catch (error) {
    console.error("Visual Studio Generation failed after retries:", error);
    return null;
  }
};