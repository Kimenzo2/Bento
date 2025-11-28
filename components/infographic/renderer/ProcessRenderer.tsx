import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { InfographicData } from '../../../types/infographic';

interface ProcessRendererProps {
    data: InfographicData;
}

const ProcessRenderer: React.FC<ProcessRendererProps> = ({ data }) => {
    const steps = data.content.steps || [];

    return (
        <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-white/50 rounded-xl">
            <div className="grid gap-8 w-full max-w-2xl">
                {steps.map((step, index) => (
                    <div key={index} className="relative flex items-start gap-6 group">
                        {/* Connecting Line */}
                        {index < steps.length - 1 && (
                            <div className="absolute left-6 top-12 bottom-[-32px] w-1 bg-gradient-to-b from-gray-200 to-transparent group-hover:from-coral-burst/50 transition-colors"></div>
                        )}

                        {/* Step Number */}
                        <div className="relative z-10 w-12 h-12 rounded-full bg-white border-4 border-peach-soft flex items-center justify-center flex-shrink-0 shadow-sm group-hover:border-coral-burst group-hover:scale-110 transition-all duration-300">
                            <span className="font-heading font-bold text-xl text-charcoal-soft">{step.order}</span>
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 bg-white p-6 rounded-2xl shadow-soft-sm border border-peach-soft/30 hover:shadow-soft-md hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="text-2xl">{step.icon || '📌'}</div>
                                <h3 className="font-heading font-bold text-lg text-charcoal-soft">{step.title}</h3>
                            </div>
                            <p className="text-cocoa-light text-sm leading-relaxed">{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProcessRenderer;
