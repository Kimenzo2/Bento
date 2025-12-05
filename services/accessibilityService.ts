import { callAPI, GrokMessage } from './grokService';

interface AltTextResult {
    shortAlt: string;      // Brief alt text for screen readers
    longDescription: string; // Extended description for detailed context
    keywords: string[];     // Key visual elements
}

/**
 * Generates accessible alt text for story images
 * This provides screen reader support for visually impaired users
 */
export async function generateImageAltText(
    pageText: string,
    artStyle: string,
    pageNumber: number,
    context?: {
        characterNames?: string[];
        setting?: string;
        bookTitle?: string;
    }
): Promise<AltTextResult> {
    const messages: GrokMessage[] = [
        {
            role: 'system',
            content: `You are an accessibility expert generating alt text for children's book illustrations.
Your alt text must:
1. Be descriptive but concise (under 125 characters for short alt)
2. Describe the key visual elements and emotions
3. Include character positions and actions
4. Mention the art style naturally
5. Be child-friendly and engaging
6. Not start with "Image of" or "Picture of"

Return JSON format:
{
    "shortAlt": "Brief description for screen readers",
    "longDescription": "Detailed 2-3 sentence description for extended reading",
    "keywords": ["key", "visual", "elements"]
}`
        },
        {
            role: 'user',
            content: `Generate alt text for a ${artStyle} illustration on page ${pageNumber}.

Page text: "${pageText}"

${context?.characterNames ? `Characters in story: ${context.characterNames.join(', ')}` : ''}
${context?.setting ? `Story setting: ${context.setting}` : ''}
${context?.bookTitle ? `Book title: ${context.bookTitle}` : ''}

Create accessible, vivid alt text that helps visually impaired children experience this illustration.`
        }
    ];

    try {
        const response = await callAPI(messages);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                shortAlt: result.shortAlt || `${artStyle} illustration for page ${pageNumber}`,
                longDescription: result.longDescription || result.shortAlt,
                keywords: result.keywords || []
            };
        }
    } catch (error) {
        console.error('Alt text generation failed:', error);
    }

    // Fallback alt text
    return {
        shortAlt: `${artStyle} illustration accompanying the story text`,
        longDescription: `A ${artStyle.toLowerCase()} style illustration depicting the scene described in the story.`,
        keywords: [artStyle.toLowerCase(), 'illustration', 'children']
    };
}

/**
 * Generates alt text for multiple pages efficiently
 */
export async function batchGenerateAltText(
    pages: Array<{ text: string; pageNumber: number }>,
    artStyle: string,
    context?: {
        characterNames?: string[];
        setting?: string;
        bookTitle?: string;
    }
): Promise<Map<number, AltTextResult>> {
    const results = new Map<number, AltTextResult>();

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < pages.length; i += 3) {
        const batch = pages.slice(i, i + 3);
        const promises = batch.map(page =>
            generateImageAltText(page.text, artStyle, page.pageNumber, context)
                .then(result => ({ pageNumber: page.pageNumber, result }))
        );

        const batchResults = await Promise.all(promises);
        batchResults.forEach(({ pageNumber, result }) => {
            results.set(pageNumber, result);
        });

        // Small delay between batches
        if (i + 3 < pages.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}

/**
 * Screen reader announcement utilities
 */
export const screenReaderAnnounce = {
    /**
     * Announce a message to screen readers using ARIA live region
     */
    announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        // Remove after announcement is made
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    },

    /**
     * Announce page navigation
     */
    pageChange: (pageNumber: number, totalPages: number) => {
        screenReaderAnnounce.announce(
            `Page ${pageNumber} of ${totalPages}`,
            'polite'
        );
    },

    /**
     * Announce book generation progress
     */
    generationProgress: (step: string, progress: number) => {
        screenReaderAnnounce.announce(
            `${step}: ${Math.round(progress)}% complete`,
            'polite'
        );
    }
};

/**
 * Keyboard navigation helpers
 */
export const keyboardNav = {
    /**
     * Handle book navigation keyboard events
     */
    handleBookNavigation: (
        event: KeyboardEvent,
        currentPage: number,
        totalPages: number,
        onPageChange: (page: number) => void
    ) => {
        switch (event.key) {
            case 'ArrowLeft':
            case 'PageUp':
                if (currentPage > 0) {
                    event.preventDefault();
                    onPageChange(currentPage - 1);
                }
                break;
            case 'ArrowRight':
            case 'PageDown':
            case ' ':
                if (currentPage < totalPages - 1) {
                    event.preventDefault();
                    onPageChange(currentPage + 1);
                }
                break;
            case 'Home':
                event.preventDefault();
                onPageChange(0);
                break;
            case 'End':
                event.preventDefault();
                onPageChange(totalPages - 1);
                break;
        }
    }
};
