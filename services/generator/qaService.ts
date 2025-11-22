import { generateStructuredContent } from '../geminiService';
import { Type } from '@google/genai';

export interface QualityMetrics {
    readabilityScore: number;
    grammarScore: number;
    coherenceScore: number;
    ageAppropriateness: number;
    overallQuality: number;
    issues: QualityIssue[];
    suggestions: string[];
}

export interface QualityIssue {
    type: 'grammar' | 'readability' | 'coherence' | 'age-appropriateness' | 'style';
    severity: 'low' | 'medium' | 'high';
    location: string;
    description: string;
    suggestion?: string;
}

/**
 * Analyzes the quality of generated content
 */
export const analyzeQuality = async (
    content: string,
    targetAudience: string,
    tone: string
): Promise<QualityMetrics> => {
    const prompt = `
    Analyze the following book content for quality:
    
    Target Audience: ${targetAudience}
    Intended Tone: ${tone}
    
    Content:
    ${content}
    
    Provide a comprehensive quality analysis including:
    - Readability score (0-100)
    - Grammar score (0-100)
    - Coherence score (0-100)
    - Age appropriateness score (0-100)
    - Overall quality score (0-100)
    - List of specific issues found
    - Suggestions for improvement
  `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            readabilityScore: { type: Type.NUMBER },
            grammarScore: { type: Type.NUMBER },
            coherenceScore: { type: Type.NUMBER },
            ageAppropriateness: { type: Type.NUMBER },
            overallQuality: { type: Type.NUMBER },
            issues: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        severity: { type: Type.STRING },
                        location: { type: Type.STRING },
                        description: { type: Type.STRING },
                        suggestion: { type: Type.STRING }
                    }
                }
            },
            suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    };

    const systemInstruction = `
    You are a professional editor and quality assurance specialist for children's and general literature.
    Analyze content objectively and provide actionable feedback.
  `;

    return generateStructuredContent<QualityMetrics>(prompt, schema, systemInstruction);
};

/**
 * Improves content based on quality analysis
 */
export const improveContent = async (
    originalContent: string,
    qualityMetrics: QualityMetrics,
    targetAudience: string
): Promise<string> => {
    const issuesSummary = qualityMetrics.issues
        .map(issue => `- ${issue.type}: ${issue.description}`)
        .join('\n');

    const suggestionsSummary = qualityMetrics.suggestions.join('\n');

    const prompt = `
    Improve the following content based on the quality analysis:
    
    Original Content:
    ${originalContent}
    
    Issues Found:
    ${issuesSummary}
    
    Suggestions:
    ${suggestionsSummary}
    
    Target Audience: ${targetAudience}
    
    Rewrite the content to address all issues while maintaining the original story and intent.
    Return only the improved content, no explanations.
  `;

    const response = await generateStructuredContent<{ improvedContent: string }>(
        prompt,
        {
            type: Type.OBJECT,
            properties: {
                improvedContent: { type: Type.STRING }
            }
        },
        'You are an expert editor. Improve the content while preserving the author\'s voice and story.'
    );

    return response.improvedContent;
};
