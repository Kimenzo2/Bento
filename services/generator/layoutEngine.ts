import { PageOutline, PageLayout } from '../../types/generator';

export const generateLayout = (page: PageOutline, style: string): PageLayout => {
    // Basic layout mapping
    // In the future, this could be AI-driven or have more complex logic

    const baseLayout: PageLayout = {
        layoutId: `layout_${Date.now()}`,
        cssGrid: "1fr",
        areas: ["content"],
        textStyle: {
            fontFamily: "Inter, sans-serif",
            fontSize: "1rem",
            color: "#000000",
            position: "bottom",
            alignment: "left"
        },
        imageStyle: {
            filter: "none",
            mask: "none",
            objectFit: "cover"
        },
        animation: "fade-in"
    };

    switch (page.layoutTemplate) {
        case 'full-bleed':
            return {
                ...baseLayout,
                cssGrid: "1fr",
                areas: ["image"],
                textStyle: {
                    ...baseLayout.textStyle,
                    position: "overlay",
                    color: "#FFFFFF",
                    alignment: "center",
                    fontSize: "1.5rem"
                },
                imageStyle: {
                    ...baseLayout.imageStyle,
                    objectFit: "cover"
                }
            };
        case 'split-horizontal':
            return {
                ...baseLayout,
                cssGrid: "1fr 1fr", // Two columns
                areas: ["image text"],
                textStyle: {
                    ...baseLayout.textStyle,
                    position: "side",
                    color: "#333333",
                    alignment: "left"
                }
            };
        case 'split-vertical':
            return {
                ...baseLayout,
                cssGrid: "1fr / 1fr", // Two rows
                areas: ["image", "text"],
                textStyle: {
                    ...baseLayout.textStyle,
                    position: "bottom",
                    color: "#333333",
                    alignment: "center"
                }
            };
        case 'text-overlay':
            return {
                ...baseLayout,
                cssGrid: "1fr",
                areas: ["image"],
                textStyle: {
                    ...baseLayout.textStyle,
                    position: "overlay",
                    color: "#FFFFFF",
                    alignment: "center",
                    fontSize: "2rem" // Larger for emphasis
                },
                imageStyle: {
                    ...baseLayout.imageStyle,
                    filter: "brightness(0.7)" // Darken image for readability
                }
            };
        case 'comic-panel':
            return {
                ...baseLayout,
                cssGrid: "repeat(2, 1fr) / repeat(2, 1fr)", // 2x2 grid
                areas: ["panel1 panel2", "panel3 panel4"], // Simplified
                textStyle: {
                    ...baseLayout.textStyle,
                    fontFamily: "Comic Sans MS, cursive", // Placeholder
                    position: "overlay",
                    color: "#000000",
                    alignment: "center"
                },
                imageStyle: {
                    ...baseLayout.imageStyle,
                    mask: "none" // Maybe add borders
                }
            };
        default:
            return baseLayout;
    }
};
