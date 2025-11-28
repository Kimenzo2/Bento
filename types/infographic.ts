export enum InfographicType {
    PROCESS = 'PROCESS', // How things work
    COMPARISON = 'COMPARISON', // This vs That
    ANATOMY = 'ANATOMY', // Inside look
    TIMELINE = 'TIMELINE', // When things happen
    GEOGRAPHIC = 'GEOGRAPHIC', // Where things are
    CATEGORY = 'CATEGORY', // Types of things
    STATISTICAL = 'STATISTICAL', // Numbers made visual
    STORY = 'STORY' // Narrative + Education
}

export enum AgeGroup {
    PRESCHOOL = '3-5',
    EARLY_ELEMENTARY = '6-8',
    LATE_ELEMENTARY = '9-12',
    TEEN = '13+'
}

export enum InfographicStyle {
    ILLUSTRATED = 'ILLUSTRATED', // Colorful, friendly
    DIAGRAM = 'DIAGRAM', // Technical, educational
    COMIC = 'COMIC', // Story-driven panels
    MIXED = 'MIXED' // Best of both
}

export enum GuideCharacter {
    NONE = 'NONE',
    OWL = 'OWL', // Professor Owl (Science)
    MOUSE = 'MOUSE', // Lab Mouse (Science)
    FOX = 'FOX', // Explorer Fox (Nature)
    ROBOT = 'ROBOT', // Microscope Bot (Tech)
    DRAGON = 'DRAGON', // Number Dragon (Math)
    ASTRONAUT = 'ASTRONAUT' // Astronaut Pup (Space)
}

export interface InfographicElement {
    id: string;
    type: 'text' | 'image' | 'icon' | 'chart' | 'arrow';
    content: string; // Text content or image URL
    position: { x: number; y: number };
    size: { width: number; height: number };
    style?: any;
    animation?: string;
    interaction?: {
        type: 'hover' | 'click';
        content: string; // Tooltip or modal content
        audioUrl?: string;
    };
}

export interface InfographicData {
    id: string;
    topic: string;
    title: string;
    ageGroup: AgeGroup;
    type: InfographicType;
    style: InfographicStyle;
    guideCharacter: GuideCharacter;
    colors: string[];
    content: {
        intro: string;
        mainPoints: string[];
        funFact: string;
        keyTerm?: {
            term: string;
            definition: string;
        };
        // Structured content for specific types
        steps?: { order: number; title: string; description: string; icon?: string }[];
        comparisonPoints?: { category: string; itemA: string; itemB: string }[];
        stats?: { label: string; value: string; description?: string }[];
        anatomyLabels?: { label: string; description: string; position: { x: number; y: number } }[];
        timelineEvents?: { date: string; title: string; description: string }[];
    };
    createdAt: Date;
}

export interface GenerationRequest {
    topic: string;
    ageGroup: AgeGroup;
    type?: InfographicType; // Optional, system can decide
    style: InfographicStyle;
    guideCharacter: GuideCharacter;
    includeInteractive: boolean;
}
