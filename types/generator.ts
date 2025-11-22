
export interface EbookRequest {
    topic: string;
    targetAudience: string;
    pageCount: number;
    style: string;
    tone: string;
    brandProfile?: {
        name: string;
        colors: string[];
        guidelines: string;
    };
}

export interface ColorPalette {
    primary: string[];
    accent: string[];
    neutral: string[];
    special: string[];
    background: string;
    text: string;
}

export interface CharacterProfile {
    name: string;
    role: string;
    description: string;
    visualTraits: {
        eyes: string;
        hair: string;
        body: string;
        clothing: string;
        distinctiveFeatures: string[];
    };
    personality: string[];
}

export interface PageOutline {
    pageNumber: number;
    purpose: string;
    scene: string;
    characterAction: string;
    expression: string;
    background: string;
    props: string[];
    cameraAngle: string;
    mood: string;
    visualMetaphor?: string;
    textPlacement: string;
    visualEnergy: string;
    keyPoints: string[];
    wordCount: number;
    layoutTemplate: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-overlay' | 'comic-panel';
}

export interface ContentStructure {
    title: string;
    synopsis: string;
    narrativeArc: {
        introduction: string;
        learning: string;
        mastery: string;
    };
    visualStrategy: {
        metaphors: string[];
        motifs: string[];
        artStyleDetails: string;
    };
    colorPalette: ColorPalette;
    characterNeeds: CharacterProfile[];
    pages: PageOutline[];
}

export interface VisualIdentity {
    faceStructure: string;
    bodyType: string;
    clothingStyle: string;
    accessories: string[];
    expressionRange: string[];
    colorPalette: string[]; // Specific colors for this character
}

export interface CharacterSheet {
    id: string;
    baseProfile: CharacterProfile;
    visualIdentity: VisualIdentity;
    referenceImagePrompt: string; // The "Master Prompt" for consistency
    styleEnforcement: string; // Keywords to always include (e.g. "Pixar style, 3D render")
    midjourneyRefUrl?: string; // Optional: if we generate a reference image and host it
}

export interface PageLayout {
    layoutId: string;
    cssGrid: string;
    areas: string[]; // Grid areas
    textStyle: {
        fontFamily: string;
        fontSize: string;
        color: string;
        position: string; // 'overlay', 'side', 'bottom'
        alignment: 'left' | 'center' | 'right' | 'justify';
    };
    imageStyle: {
        filter: string;
        mask: string; // CSS mask for interesting shapes
        objectFit: 'cover' | 'contain';
    };
    animation: string; // 'fade-in', 'slide-up', etc.
}

export interface StyleGuide {
    id: string;
    artStyle: {
        name: string; // e.g., "Pixar 3D Style", "Flat Design Cartoon"
        description: string;
        technicalSpecs: {
            lineWeight: string; // e.g., "2px consistent stroke"
            renderingTechnique: string; // e.g., "soft shadows with ambient occlusion"
            textureApproach: string; // e.g., "realistic textures with stylization"
            lightingModel: string; // e.g., "three-point cinematic lighting"
        };
    };
    colorPalette: ColorPalette;
    referenceImageUrl?: string; // The "master style reference" image
    styleEnforcementPrompt: string; // Keywords to append to EVERY image generation
    consistencyRules: string[]; // Specific rules like "always use soft shadows", "no gradients"
}
