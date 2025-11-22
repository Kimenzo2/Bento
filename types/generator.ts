// Generator Types for the Genesis Brain System

export interface ContentStructure {
    title: string;
    synopsis: string;
    targetAudience: string;
    estimatedReadingTime: number;
    chapters: ChapterStructure[];
    characterNeeds: CharacterProfile[];
    styleRecommendations: string[];
    pages: PageStructure[];
    narrativeArc: {
        introduction: string;
        learning: string;
        mastery: string;
    };
    visualStrategy: {
        artStyleDetails: string;
        motifs: string[];
    };
    colorPalette: {
        primary: string[];
        accent: string[];
    };
}

export interface ChapterStructure {
    chapterNumber: number;
    title: string;
    summary: string;
    pageRange: [number, number];
    keyEvents: string[];
    emotionalArc: string;
}

export interface PageStructure {
    pageNumber: number;
    chapterNumber: number;
    scene: string;
    narrativePurpose: string;
    visualFocus: string;
    layoutTemplate: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-only';
    estimatedWordCount: number;
    visualEnergy: string;
    characterAction: string;
}

export interface CharacterProfile {
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
    description: string;
    visualTraits: {
        eyes: string;
        hair: string;
        clothing: string;
    };
    personalityTraits: string[];
    importance: 'critical' | 'major' | 'minor';
}

export interface VisualIdentity {
    faceStructure: string;
    bodyType: string;
    clothingStyle: string;
    accessories: string[];
    expressionRange: string[];
    colorPalette: string[];
    coreFeatures?: string[];
    styleNotes?: string;
}

export interface CharacterSheet {
    id: string;
    baseProfile: CharacterProfile;
    visualIdentity: VisualIdentity;
    consistencyPrompt?: string;
    referenceImagePrompt: string;
    styleEnforcement: string;
    midjourneyRefUrl?: string;
}

export interface ColorPalette {
    primary: string[];
    accent: string[];
    neutral: string[];
    special: string[];
    background: string;
    text: string;
}

export interface StyleGuide {
    id: string;
    artStyle: {
        name: string;
        description: string;
        technicalSpecs: {
            lineWeight: string;
            renderingTechnique: string;
            textureApproach: string;
            lightingModel: string;
        };
    };
    colorPalette: ColorPalette;
    styleEnforcementPrompt: string;
    consistencyRules: string[];
}

export interface EbookRequest {
    topic: string;
    targetAudience: string;
    pageCount: number;
    style: string;
    tone: string;
    brandProfile?: {
        name: string;
        guidelines: string;
        colors: string[];
        sampleText: string;
    };
}

export interface GenerationRequest {
    topic: string;
    targetAudience: string;
    pageCount: number;
    style: string;
    tone: string;
    brandProfile?: {
        name: string;
        guidelines: string;
        colors: string[];
        sampleText: string;
    };
}

export interface AnalysisResult {
    structure: ContentStructure;
    confidence: number;
    warnings: string[];
    suggestions: string[];
}

export interface PageOutline {
    pageNumber: number;
    layoutTemplate: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-only' | 'text-overlay' | 'comic-panel';
}

export interface PageLayout {
    layoutId: string;
    cssGrid: string;
    areas: string[];
    textStyle: {
        fontFamily: string;
        fontSize: string;
        color: string;
        position: string;
        alignment: string;
    };
    imageStyle: {
        filter: string;
        mask: string;
        objectFit: string;
    };
    animation: string;
}
