import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Users, Wand2, MonitorPlay } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface FeatureExplorerProps {
    tier: TierConfig;
}

const features = [
    {
        id: 'mixer',
        label: 'Style Mixer',
        icon: Palette,
        content: (
            <div className="p-6 bg-gray-900 text-white rounded-xl h-64 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full" />
                <div className="flex gap-4 mb-4">
                    <div className="w-16 h-20 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-xs text-gray-400">Watercolor</div>
                    <div className="text-2xl font-light text-gray-600">+</div>
                    <div className="w-16 h-20 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-xs text-gray-400">Cyberpunk</div>
                </div>
                <div className="w-40 h-10 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
                    Resulting Style
                </div>
                <p className="mt-4 text-xs text-gray-400">Seamlessly blend any two art styles</p>
            </div>
        )
    },
    {
        id: 'consistent',
        label: 'Character Consistency',
        icon: Users,
        content: (
            <div className="p-6 bg-gray-900 text-white rounded-xl h-64 flex flex-col items-center justify-center border border-white/10">
                <div className="flex gap-2 mb-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-indigo-400 opacity-80" />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-500/10 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    99.8% Match Rate
                </div>
                <p className="mt-4 text-xs text-gray-400">AI remembers your character's face across pages</p>
            </div>
        )
    },
    {
        id: 'editor',
        label: 'Smart Editor',
        icon: Wand2,
        content: (
            <div className="p-6 bg-white border border-gray-200 rounded-xl h-64 shadow-inner relative">
                <div className="h-2 w-24 bg-gray-200 rounded mb-4" />
                <div className="space-y-2">
                    <div className="h-2 w-full bg-gray-100 rounded" />
                    <div className="h-2 w-3/4 bg-gray-100 rounded" />
                    <div className="h-2 w-5/6 bg-gray-100 rounded" />
                </div>
                <div className="absolute bottom-6 right-6">
                    <div className="bg-charcoal-soft text-white text-xs px-3 py-2 rounded-lg shadow-xl flex items-center gap-2">
                        <Wand2 className="w-3 h-3 text-gold-sunshine" />
                        Rewrite for younger audience...
                    </div>
                </div>
            </div>
        )
    }
];

export const FeatureExplorer: React.FC<FeatureExplorerProps> = ({ tier }) => {
    const [activeFeature, setActiveFeature] = useState(features[0].id);

    const activeContent = features.find(f => f.id === activeFeature)?.content;

    return (
        <div className="flex flex-col md:flex-row gap-8 bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-lg">
            <div className="w-full md:w-1/3 space-y-2">
                <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-6">Interactive Preview</h3>
                {features.map((feature) => {
                    const isActive = activeFeature === feature.id;
                    const Icon = feature.icon;
                    return (
                        <button
                            key={feature.id}
                            onClick={() => setActiveFeature(feature.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${isActive
                                ? `bg-${tier.accentColor}-50 border border-${tier.accentColor}-200 shadow-sm`
                                : 'hover:bg-gray-50 border border-transparent'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? `bg-${tier.accentColor}-200 text-${tier.accentColor}-700` : 'bg-gray-100 text-gray-500'}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <span className={`font-medium ${isActive ? 'text-charcoal-soft' : 'text-gray-500'}`}>{feature.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="w-full md:w-2/3">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={activeFeature}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {activeContent}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
