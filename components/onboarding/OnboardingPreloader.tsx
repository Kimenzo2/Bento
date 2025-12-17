import React, { useEffect } from 'react';

// Comprehensive list of all assets used in the onboarding flow
const ASSETS_TO_PRELOAD = [
    // WelcomeHero & Themes
    '/images/onboarding/Cosmos.png',
    '/images/onboarding/On 4.jpeg',
    '/images/onboarding/On 5.png',
    '/images/onboarding/Style_directive_highend_202512150033.jpeg',

    // PersonalizationQuiz
    '/images/onboarding/On 13.png',
    '/images/onboarding/On 14.png',
    '/images/onboarding/On 15.png',
    '/images/onboarding/On 16.png',
    '/images/onboarding/On 17.png',
    '/images/onboarding/On 18.png',
    '/images/onboarding/On 19.png',

    // FeatureStorybook
    '/images/onboarding/On 6.png',
    '/images/onboarding/On 7.png',
    '/images/onboarding/On 8.png',
    '/images/onboarding/On 9.png',

    // CreativePersonaQuiz
    '/images/onboarding/On 10.png',
    '/images/onboarding/On 11.png',
    '/images/onboarding/On 12.png',
];

const VIDEOS_TO_PRELOAD = [
    '/images/onboarding/Cinematic_microscopic_journey_202512151050_ve.mp4'
];

export const OnboardingPreloader: React.FC = () => {
    useEffect(() => {
        // Priority 1: Preload Images
        const preloadImages = async () => {
            // Load sequentially in chunks to avoid blocking the main thread
            const chunkSize = 3;
            for (let i = 0; i < ASSETS_TO_PRELOAD.length; i += chunkSize) {
                const chunk = ASSETS_TO_PRELOAD.slice(i, i + chunkSize);
                await Promise.all(chunk.map(src => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.src = src;
                        img.onload = resolve;
                        img.onerror = resolve; // Continue even if one fails
                    });
                }));
            }
        };

        // Priority 2: Preload Videos (just the metadata)
        const preloadVideos = () => {
            VIDEOS_TO_PRELOAD.forEach(src => {
                const video = document.createElement('video');
                video.src = src;
                video.preload = 'metadata'; // Or 'auto' if you want full buffer
                video.load();
            });
        };

        // Start preloading after a short delay to allow initial render to complete
        const timer = setTimeout(() => {
            // Use requestIdleCallback if available, otherwise just run
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    preloadImages();
                    preloadVideos();
                });
            } else {
                preloadImages();
                preloadVideos();
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return null; // Invisible component
};
