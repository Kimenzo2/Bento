import { FontPairing } from '../types/fonts';

export const fontPairings: FontPairing[] = [
    {
        id: 'default',
        name: "Playful Classic",
        description: "Friendly and approachable, perfect for children's stories.",
        category: 'playful',
        headingFont: {
            family: 'Fredoka',
            weights: [400, 500, 600, 700],
            fallback: 'sans-serif'
        },
        bodyFont: {
            family: 'Manrope',
            weights: [400, 500, 600, 700, 800],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "The Magic Treehouse",
            bodyText: "Once upon a time, in a forest far away, there lived a tiny squirrel who loved to bake cookies."
        },
        bestFor: ["Children's Books", "Creative Stories", "Friendly UI"]
    },
    {
        id: 'classic-academic',
        name: "Classic Academic",
        description: "Timeless and scholarly, ideal for educational content.",
        category: 'professional',
        headingFont: {
            family: 'Playfair Display',
            weights: [600, 700, 800],
            fallback: 'serif'
        },
        bodyFont: {
            family: 'Source Sans 3',
            weights: [400, 500, 600],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "History of the World",
            bodyText: "The study of history reveals patterns in human behavior that have repeated throughout the centuries."
        },
        bestFor: ["Literature", "History", "Scholarly Content"]
    },
    {
        id: 'modern-tech',
        name: "Modern Tech",
        description: "Clean and precise, designed for technical clarity.",
        category: 'modern',
        headingFont: {
            family: 'Inter',
            weights: [600, 700, 800],
            fallback: 'sans-serif'
        },
        bodyFont: {
            family: 'IBM Plex Sans',
            weights: [400, 500, 600],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "Introduction to Coding",
            bodyText: "Algorithms are step-by-step instructions that tell a computer how to perform a specific task."
        },
        bestFor: ["STEM", "Coding Tutorials", "Technical Docs"]
    },
    {
        id: 'storybook-magic',
        name: "Storybook Magic",
        description: "Soft and whimsical, sparking imagination.",
        category: 'playful',
        headingFont: {
            family: 'Quicksand',
            weights: [600, 700],
            fallback: 'sans-serif'
        },
        bodyFont: {
            family: 'Nunito',
            weights: [400, 500, 600],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "The Dragon's Dream",
            bodyText: "In a land of clouds and stardust, a young dragon dreamed of flying higher than any dragon before."
        },
        bestFor: ["Young Readers", "Fantasy", "Imagination"]
    },
    {
        id: 'editorial-elegance',
        name: "Editorial Elegance",
        description: "Sophisticated and readable, like a high-end magazine.",
        category: 'editorial',
        headingFont: {
            family: 'Spectral',
            weights: [600, 700, 800],
            fallback: 'serif'
        },
        bodyFont: {
            family: 'Lato',
            weights: [400, 500, 600],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "The Art of Living",
            bodyText: "True elegance is not just about appearance, but about the grace with which one moves through the world."
        },
        bestFor: ["Long-form Reading", "Magazines", "Premium Content"]
    },
    {
        id: 'handwritten-warmth',
        name: "Handwritten Warmth",
        description: "Personal and organic, feeling like a handwritten note.",
        category: 'handwritten',
        headingFont: {
            family: 'Caveat',
            weights: [600, 700],
            fallback: 'cursive'
        },
        bodyFont: {
            family: 'Karla',
            weights: [400, 500, 600],
            fallback: 'sans-serif'
        },
        preview: {
            headingText: "My Secret Diary",
            bodyText: "Today was an adventure! I discovered a hidden path in the garden that led to a secret meadow."
        },
        bestFor: ["Personal Journals", "Creative Expression", "Informal Learning"]
    }
];
