export interface FontDefinition {
    family: string;
    weights: number[];
    googleFontsUrl?: string; // Optional, constructed dynamically if missing
    fallback: string;
}

export type FontCategory = 'playful' | 'professional' | 'editorial' | 'modern' | 'handwritten';

export interface FontPairing {
    id: string;
    name: string;
    description: string;
    category: FontCategory;
    headingFont: FontDefinition;
    bodyFont: FontDefinition;
    preview: {
        headingText: string;
        bodyText: string;
    };
    bestFor: string[];
}
