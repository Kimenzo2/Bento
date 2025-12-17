import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Target } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface PeerComparisonProps {
    tier: TierConfig;
}

const levels = [
    { id: 'beginner', label: 'Beginner', books: '0-1', revenue: '$0-500' },
    { id: 'intermediate', label: 'Growing', books: '2-5', revenue: '$1k-5k' },
    { id: 'advanced', label: 'Pro', books: '6-12', revenue: '$10k+' },
    { id: 'expert', label: 'Elite', books: '12+', revenue: '$50k+' }
];

export const PeerComparison: React.FC<PeerComparisonProps> = ({ tier }) => {
    const [selectedLevel, setSelectedLevel] = useState('beginner');

    return (
        <div className="bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-lg my-12">
            <div className="text-center mb-8">
                <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-2">See Where You Stand</h3>
                <p className="text-charcoal-soft/60">Compare your current output with top Genesis creators</p>
            </div>

            {/* Selector */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
                {levels.map((level) => (
                    <button
                        key={level.id}
                        onClick={() => setSelectedLevel(level.id)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedLevel === level.id
                                ? `bg-charcoal-soft text-white shadow-lg`
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        {level.label}
                    </button>
                ))}
            </div>

            {/* Comparison Viz */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* Your current path */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 md:text-right">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Traditional Path</div>
                    <div className="text-gray-500 text-sm mb-4">Without Genesis, creators at this stage typically produce:</div>
                    <div className="text-3xl font-bold text-gray-400 flex items-center justify-end gap-2">
                        {levels.find(l => l.id === selectedLevel)?.books} Books/yr
                        <Users className="w-6 h-6" />
                    </div>
                    <p className="text-red-400 text-xs mt-2 font-medium">high burnout risk</p>
                </div>

                {/* Genesis path */}
                <div className={`p-6 rounded-xl border border-${tier.accentColor}-100 bg-${tier.accentColor}-50`}>
                    <div className={`text-xs font-bold text-${tier.accentColor}-600 uppercase tracking-wider mb-2`}>With Genesis {tier.name}</div>
                    <div className="text-charcoal-soft text-sm mb-4">Genesis creators at the {selectedLevel} stage typically produce:</div>

                    <div className="flex items-center gap-3">
                        <span className={`text-4xl font-heading font-bold bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                            {selectedLevel === 'beginner' ? '5-8' : selectedLevel === 'intermediate' ? '12-20' : '30+'} Books/yr
                        </span>
                        <TrendingUp className={`w-8 h-8 text-${tier.accentColor}-500`} />
                    </div>
                    <p className={`text-${tier.accentColor}-600 text-xs mt-2 font-bold`}>
                        {selectedLevel === 'beginner' ? '5x' : '4x'} more output
                    </p>
                </div>
            </div>
        </div>
    );
};
