export interface ThemeColors {
    primary: [string, string]; // Gradient start/end
    accent: [string, string]; // Gradient start/end
    background: string;
    text: string;
    textLight: string;
    border: string;
    shadow: string;
}

export interface Theme {
    id: string;
    name: string;
    description: string;
    colors: ThemeColors;
    // We'll use these for the CSS variables injection
    cssVariables: Record<string, string>;
}

export type ThemeId = 'genesis' | 'aurora' | 'ocean' | 'forest' | 'nebula' | 'sunset';
