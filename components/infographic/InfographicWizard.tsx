import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { InfographicData, GenerationRequest, AgeGroup, InfographicType, InfographicStyle, GuideCharacter } from '../../types/infographic';
import TopicInputStep from './TopicInputStep.tsx';
import CustomizationStep from './CustomizationStep.tsx';
import GenerationLoading from './GenerationLoading.tsx';
import InfographicPreview from './InfographicPreview.tsx';
import { InfographicService } from '../../services/generator/infographicService';

interface InfographicWizardProps {
    onClose: () => void;
}

const InfographicWizard: React.FC<InfographicWizardProps> = ({ onClose }) => {
    const [step, setStep] = useState<number>(1);
    const [request, setRequest] = useState<GenerationRequest>({
        topic: '',
        ageGroup: AgeGroup.EARLY_ELEMENTARY,
        type: InfographicType.PROCESS,
        style: InfographicStyle.ILLUSTRATED,
        guideCharacter: GuideCharacter.NONE,
        includeInteractive: true
    });
    const [generatedData, setGeneratedData] = useState<InfographicData | null>(null);

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleGenerate = async () => {
        setStep(3); // Loading state
        try {
            const data = await InfographicService.generate(request);
            setGeneratedData(data);
            setStep(4); // Preview state
        } catch (error) {
            console.error("Generation failed:", error);
            setStep(2);
            // In a real app, we'd show a toast or error message here
            alert("Failed to generate infographic. Please try again.");
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-0">
            <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-soft-lg border border-white/50 overflow-hidden min-h-[500px] sm:min-h-[600px] flex flex-col animate-fadeIn">
                {/* Header */}
                <div className="p-4 sm:p-6 md:p-8 border-b border-peach-soft/30 flex items-center justify-between bg-cream-soft/50 gap-4">
                    <div className="flex-1 min-w-0">
                        <h2 className="font-heading font-bold text-lg sm:text-xl md:text-2xl text-charcoal-soft flex items-center gap-2 truncate">
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-gold-sunshine flex-shrink-0" />
                            <span className="truncate">Educational Infographic Wizard</span>
                        </h2>
                        <p className="text-cocoa-light text-xs sm:text-sm mt-1">Create stunning visual lessons in seconds</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {[1, 2, 3, 4].map(s => (
                            <div
                                key={s}
                                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${step >= s ? 'bg-coral-burst' : 'bg-peach-soft/50'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative overflow-y-auto">
                    {step === 1 && (
                        <TopicInputStep
                            request={request}
                            onChange={setRequest}
                            onNext={handleNext}
                        />
                    )}
                    {step === 2 && (
                        <CustomizationStep
                            request={request}
                            onChange={setRequest}
                            onBack={handleBack}
                            onGenerate={handleGenerate}
                        />
                    )}
                    {step === 3 && (
                        <GenerationLoading topic={request.topic} />
                    )}
                    {step === 4 && generatedData && (
                        <InfographicPreview
                            data={generatedData}
                            onClose={onClose}
                            onRegenerate={() => setStep(1)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default InfographicWizard;
