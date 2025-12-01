import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { InfographicData, GenerationRequest, AgeGroup, InfographicType, InfographicStyle, GuideCharacter } from '../../types/infographic';
import TopicInputStep from './TopicInputStep.tsx';
import CustomizationStep from './CustomizationStep.tsx';
import GenerationLoading from './GenerationLoading.tsx';
import InfographicResultPage from './InfographicResultPage.tsx';
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
        <>
            {/* Header */}
            <div className="mb-8">
                <h2 className="font-heading font-bold text-2xl text-charcoal-soft flex items-center gap-2 mb-2">
                    <Sparkles className="w-6 h-6 text-gold-sunshine" />
                    Educational Infographic Wizard
                </h2>
                <p className="text-cocoa-light text-sm">Create stunning visual lessons in seconds</p>

                {/* Progress Dots */}
                <div className="flex items-center gap-2 mt-4">
                    {[1, 2, 3, 4].map(s => (
                        <div
                            key={s}
                            className={`w-3 h-3 rounded-full transition-all ${step >= s ? 'bg-coral-burst' : 'bg-peach-soft/50'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
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
                    <InfographicResultPage
                        data={generatedData}
                        onClose={onClose}
                        onRegenerate={() => setStep(1)}
                    />
                )}
            </div>
        </>
    );
};

export default InfographicWizard;
