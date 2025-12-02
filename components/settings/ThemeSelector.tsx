import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { CheckCircle } from 'lucide-react';

const ThemeSelector: React.FC = () => {
    const { currentTheme, setTheme, availableThemes } = useTheme();

    return (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft mb-2">Theme Gallery</h3>
                <p className="text-cocoa-light text-sm">Choose a visual theme that inspires your creativity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableThemes.map((theme) => {
                    const isActive = currentTheme.id === theme.id;
                    return (
                        <button
                            key={theme.id}
                            onClick={() => setTheme(theme.id as any)}
                            className={`relative group text-left rounded-2xl p-4 transition-all duration-300 border-2 touch-manipulation
                ${isActive
                                    ? 'border-coral-burst bg-white shadow-soft-md scale-[1.02]'
                                    : 'border-transparent bg-white/50 hover:bg-white hover:shadow-soft-sm hover:scale-[1.01]'
                                }
              `}
                        >
                            {/* Gradient Preview */}
                            <div
                                className="h-24 rounded-xl mb-4 w-full shadow-inner"
                                style={{
                                    background: `linear-gradient(135deg, ${theme.colors.primary[0]}, ${theme.colors.primary[1]})`
                                }}
                            >
                                <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-bold">
                                        Preview
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className={`font-heading font-bold text-lg ${isActive ? 'text-coral-burst' : 'text-charcoal-soft'}`}>
                                        {theme.name}
                                    </h4>
                                    <p className="text-xs text-cocoa-light mt-1 line-clamp-2">
                                        {theme.description}
                                    </p>
                                </div>
                                {isActive && (
                                    <CheckCircle className="w-5 h-5 text-coral-burst flex-shrink-0" />
                                )}
                            </div>

                            {/* Color Swatches */}
                            <div className="flex gap-2 mt-3">
                                <div className="w-4 h-4 rounded-full" style={{ background: theme.colors.accent[0] }} title="Accent 1"></div>
                                <div className="w-4 h-4 rounded-full" style={{ background: theme.colors.accent[1] }} title="Accent 2"></div>
                                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ background: theme.colors.background }} title="Background"></div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ThemeSelector;
