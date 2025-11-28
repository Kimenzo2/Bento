import React from 'react';
import { InfographicData } from '../../../types/infographic';

interface StatisticalRendererProps {
    data: InfographicData;
}

const StatisticalRenderer: React.FC<StatisticalRendererProps> = ({ data }) => {
    const stats = data.content.stats || [];

    return (
        <div className="w-full h-full p-4 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className={`bg-white p-6 rounded-2xl shadow-soft-md border border-peach-soft/30 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform duration-300 ${index === 0 ? 'sm:col-span-2 bg-gradient-to-br from-white to-cream-soft' : ''
                            }`}
                    >
                        <div className="text-5xl sm:text-6xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-coral-burst to-gold-sunshine mb-2">
                            {stat.value}
                        </div>
                        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">{stat.label}</h3>
                        {stat.description && (
                            <p className="text-cocoa-light text-sm max-w-xs">{stat.description}</p>
                        )}
                    </div>
                ))}

                {/* Placeholder Chart Visualization */}
                <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-soft-md border border-peach-soft/30 mt-4">
                    <h4 className="font-heading font-bold text-charcoal-soft mb-4 text-center">Data Distribution</h4>
                    <div className="flex items-end justify-center gap-4 h-40 px-8">
                        {stats.map((_, i) => (
                            <div
                                key={i}
                                className="w-12 bg-mint-breeze/50 rounded-t-lg hover:bg-mint-breeze transition-colors relative group"
                                style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-charcoal-soft text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {stats[i].value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticalRenderer;
