import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Upload, Sparkles, FileText } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface MigrationAssistantProps {
    tier: TierConfig;
}

const steps = [
    { id: 1, title: 'Import Content', icon: Upload, desc: 'Paste your existing manuscript or notes.' },
    { id: 2, title: 'Style Match', icon: Sparkles, desc: 'AI analyzes your vibe and suggests art styles.' },
    { id: 3, title: 'Auto-Format', icon: FileText, desc: 'Instantly convert text to storyboard layout.' }
];

export const MigrationAssistant: React.FC<MigrationAssistantProps> = ({ tier }) => {
    const [currentStep, setCurrentStep] = useState(1);

    return (
        <div className="py-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                    <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-4">Switching is Simple</h3>
                    <p className="text-charcoal-soft/70 mb-6">
                        Worried about losing work? Don't be. Genesis imports your existing drafts and transforms them in seconds.
                    </p>

                    <div className="space-y-4">
                        {steps.map((step) => (
                            <button
                                key={step.id}
                                onClick={() => setCurrentStep(step.id)}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${currentStep === step.id
                                        ? `bg-white shadow-md border border-${tier.accentColor}-200`
                                        : 'bg-transparent hover:bg-gray-50 border border-transparent'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${currentStep === step.id
                                        ? `bg-${tier.accentColor}-100 text-${tier.accentColor}-600`
                                        : currentStep > step.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                                </div>
                                <div>
                                    <h4 className={`font-bold ${currentStep === step.id ? 'text-charcoal-soft' : 'text-gray-500'}`}>{step.title}</h4>
                                    <p className="text-xs text-charcoal-soft/60">{step.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Visualizer */}
                <div className="flex-1 w-full relative h-[300px] bg-charcoal-soft rounded-2xl overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="text-center z-10"
                        >
                            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center shadow-2xl`}>
                                {React.createElement(steps[currentStep - 1].icon, { className: "w-10 h-10 text-white" })}
                            </div>
                            <h4 className="text-white font-bold text-xl mb-2">{steps[currentStep - 1].title}</h4>
                            <div className="w-32 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                                <motion.div
                                    className={`h-full bg-gradient-to-r ${tier.gradient}`}
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
