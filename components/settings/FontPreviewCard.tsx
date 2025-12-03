import React, { useEffect, useState } from 'react';
import { CheckCircle, Type } from 'lucide-react';
import { FontPairing } from '../../src/types/fonts';
import { loadFont } from '../../src/utils/fontLoader';

interface FontPreviewCardProps {
    pairing: FontPairing;
    isActive: boolean;
    onSelect: () => void;
}

const FontPreviewCard: React.FC<FontPreviewCardProps> = ({ pairing, isActive, onSelect }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    // Lazy load fonts for this card when it mounts
    useEffect(() => {
        const loadPreviewFonts = async () => {
            try {
                await Promise.all([
                    loadFont(pairing.headingFont),
                    loadFont(pairing.bodyFont)
                ]);
                setIsLoaded(true);
            } catch (err) {
                console.warn(`Failed to load preview fonts for ${pairing.name}`, err);
                // Still set loaded to true to show fallback
                setIsLoaded(true);
            }
        };

        // Use IntersectionObserver to only load when visible (optimization)
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadPreviewFonts();
                observer.disconnect();
            }
        });

        const element = document.getElementById(`font-card-${pairing.id}`);
        if (element) {
            observer.observe(element);
        }

        return () => observer.disconnect();
    }, [pairing]);

    return (
        <button
            id={`font-card-${pairing.id}`}
            onClick={onSelect}
            className={`relative w-full text-left group transition-all duration-300 rounded-2xl border-2 overflow-hidden
        ${isActive
                    ? 'border-coral-burst bg-white shadow-soft-md scale-[1.02]'
                    : 'border-transparent bg-cream-soft hover:bg-white hover:shadow-soft-sm hover:border-peach-soft'
                }`}
        >
            {/* Active Indicator */}
            {isActive && (
                <div className="absolute top-3 right-3 text-coral-burst animate-fadeIn">
                    <CheckCircle className="w-6 h-6 fill-coral-burst/10" />
                </div>
            )}

            <div className="p-5">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider
            ${isActive ? 'bg-coral-burst text-white' : 'bg-peach-soft/50 text-cocoa-light'}
          `}>
                        {pairing.category}
                    </span>
                </div>

                {/* Preview Area */}
                <div className={`space-y-2 mb-4 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <h3
                        className="text-2xl font-bold text-charcoal-soft leading-tight"
                        style={{ fontFamily: `'${pairing.headingFont.family}', ${pairing.headingFont.fallback}` }}
                    >
                        {pairing.preview.headingText}
                    </h3>
                    <p
                        className="text-sm text-cocoa-dark leading-relaxed"
                        style={{ fontFamily: `'${pairing.bodyFont.family}', ${pairing.bodyFont.fallback}` }}
                    >
                        {pairing.preview.bodyText}
                    </p>
                </div>

                {/* Footer Info */}
                <div className="pt-3 border-t border-peach-soft/30">
                    <div className="flex justify-between items-end">
                        <div>
                            <h4 className="font-bold text-charcoal-soft text-sm">{pairing.name}</h4>
                            <p className="text-xs text-cocoa-light mt-0.5 line-clamp-1">{pairing.description}</p>
                        </div>
                        <Type className={`w-4 h-4 ${isActive ? 'text-coral-burst' : 'text-peach-soft'}`} />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {pairing.bestFor.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[10px] text-cocoa-light bg-white px-1.5 py-0.5 rounded border border-peach-soft/30">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </button>
    );
};

export default FontPreviewCard;
