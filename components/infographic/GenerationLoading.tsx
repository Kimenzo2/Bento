import React, { useState, useEffect } from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';

interface GenerationLoadingProps {
    topic: string;
}

const GenerationLoading: React.FC<GenerationLoadingProps> = ({ topic }) => {
    const [progress, setProgress] = useState(0);
    const [factIndex, setFactIndex] = useState(0);

    const facts = [
        "Did you know? The average cloud weighs as much as 100 elephants!",
        "Honey never spoils. You could eat 3000-year-old honey!",
        "Octopuses have three hearts and blue blood.",
        "A day on Venus is longer than a year on Venus.",
        "Bananas are berries, but strawberries aren't!"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 1;
            });
        }, 30); // 3 seconds total

        const factInterval = setInterval(() => {
            setFactIndex(prev => (prev + 1) % facts.length);
        }, 2000);

        return () => {
            clearInterval(interval);
            clearInterval(factInterval);
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4 animate-fadeIn">
            {/* Main Animation */}
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8">
                <div className="absolute inset-0 border-4 border-peach-soft rounded-full opacity-30"></div>
                <div
                    className="absolute inset-0 border-4 border-coral-burst rounded-full border-t-transparent animate-spin"
                    style={{ animationDuration: '1.5s' }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-gold-sunshine animate-pulse" />
                </div>
            </div>

            <h3 className="font-heading font-bold text-xl sm:text-2xl text-charcoal-soft mb-2 text-center px-4">
                Creating Magic for "{topic}"...
            </h3>

            <div className="w-full max-w-md bg-peach-soft/30 rounded-full h-2 mb-6 sm:mb-8 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-coral-burst to-gold-sunshine transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* Fun Fact Card */}
            <div className="bg-white border border-mint-breeze rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-soft-md animate-slideUp">
                <div className="flex items-start gap-3">
                    <div className="bg-yellow-butter/20 p-2 rounded-full flex-shrink-0">
                        <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-gold-sunshine" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-charcoal-soft text-xs sm:text-sm mb-1">Did you know?</div>
                        <p className="text-cocoa-light text-xs sm:text-sm italic transition-opacity duration-500 min-h-[40px]">
                            {facts[factIndex]}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerationLoading;
