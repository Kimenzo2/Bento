import React from 'react';
import { useFonts } from '../../src/hooks/useFonts';
import FontPreviewCard from './FontPreviewCard';
import { Loader2 } from 'lucide-react';

const FontSelector: React.FC = () => {
    const { activeFontPairing, setFontPairing, availablePairings, isLoading } = useFonts();

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft mb-2">Typography</h3>
                <p className="text-cocoa-light text-sm">Choose a font pairing that sets the perfect tone for your stories.</p>
            </div>

            {/* Loading State Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-4 rounded-2xl shadow-soft-lg flex items-center gap-3">
                        <Loader2 className="w-6 h-6 text-coral-burst animate-spin" />
                        <span className="font-bold text-charcoal-soft">Updating fonts...</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePairings.map((pairing) => (
                    <FontPreviewCard
                        key={pairing.id}
                        pairing={pairing}
                        isActive={activeFontPairing.id === pairing.id}
                        onSelect={() => setFontPairing(pairing.id)}
                    />
                ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 flex gap-3">
                <div className="w-1 bg-blue-400 rounded-full shrink-0"></div>
                <p>
                    <strong>Pro Tip:</strong> Fonts are automatically optimized for readability.
                    Changing fonts will update your entire interface and all your books instantly.
                </p>
            </div>
        </div>
    );
};

export default FontSelector;
