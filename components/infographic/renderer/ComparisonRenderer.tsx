import React from 'react';
import { InfographicData } from '../../../types/infographic';
import { Swords } from 'lucide-react';

interface ComparisonRendererProps {
    data: InfographicData;
}

const ComparisonRenderer: React.FC<ComparisonRendererProps> = ({ data }) => {
    const points = data.content.comparisonPoints || [];
    const [itemA, itemB] = data.content.mainPoints.length >= 2 ? data.content.mainPoints : ['Option A', 'Option B'];

    return (
        <div className="w-full h-full p-4 sm:p-8 flex flex-col">
            {/* Header Comparison */}
            <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-center flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h3 className="font-heading font-bold text-xl text-blue-800">{itemA}</h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-charcoal-soft text-white flex items-center justify-center font-bold text-sm shadow-lg z-10 -mx-6">
                    VS
                </div>
                <div className="text-center flex-1 bg-red-50 p-4 rounded-xl border border-red-100">
                    <h3 className="font-heading font-bold text-xl text-red-800">{itemB}</h3>
                </div>
            </div>

            {/* Comparison Points */}
            <div className="space-y-4">
                {points.map((point, index) => (
                    <div key={index} className="flex items-stretch gap-4">
                        {/* Left Side */}
                        <div className="flex-1 bg-white p-4 rounded-l-xl border-r-4 border-blue-200 shadow-sm text-right flex items-center justify-end">
                            <span className="text-sm text-charcoal-soft font-medium">{point.itemA}</span>
                        </div>

                        {/* Center Label */}
                        <div className="w-24 flex items-center justify-center bg-gray-100 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider px-2 text-center">
                            {point.category}
                        </div>

                        {/* Right Side */}
                        <div className="flex-1 bg-white p-4 rounded-r-xl border-l-4 border-red-200 shadow-sm flex items-center">
                            <span className="text-sm text-charcoal-soft font-medium">{point.itemB}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComparisonRenderer;
