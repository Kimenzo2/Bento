import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Users, X } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface UsageHeatmapProps {
    tier: TierConfig;
}

const locations = [
    { city: 'New York', action: 'exported a book' },
    { city: 'London', action: 'started a new project' },
    { city: 'Tokyo', action: 'generated 50 illustrations' },
    { city: 'Berlin', action: 'upgrade to Studio' },
    { city: 'Sydney', action: 'published to KDP' },
    { city: 'Toronto', action: 'created a character' }
];

export const UsageHeatmap: React.FC<UsageHeatmapProps> = ({ tier }) => {
    const [activeEvent, setActiveEvent] = useState(locations[0]);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            const randomLoc = locations[Math.floor(Math.random() * locations.length)];
            setActiveEvent(randomLoc);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-40 hidden md:block">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-full shadow-2xl border border-charcoal-soft/10 p-1 pr-4 flex items-center gap-3"
            >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tier.gradient} flex items-center justify-center text-white`}>
                    <Globe className="w-5 h-5 animate-pulse" />
                </div>

                <div className="text-sm">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeEvent.city}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex flex-col"
                        >
                            <span className="font-bold text-charcoal-soft">Someone in {activeEvent.city}</span>
                            <span className="text-xs text-charcoal-soft/60">just {activeEvent.action}</span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <button
                    onClick={() => setIsVisible(false)}
                    className="ml-2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </motion.div>
        </div>
    );
};
