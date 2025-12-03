import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
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
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleGenerate = async () => {
        // Validate topic before proceeding
        if (!request.topic || request.topic.trim().length < 3) {
            setError('Please enter a topic with at least 3 characters');
            return;
        }
        
        setError(null);
        setStep(3); // Loading state
        
        try {
            console.log('🚀 Starting infographic generation for topic:', request.topic);
            const data = await InfographicService.generate(request);
            
            // Validate generated data
            if (!data || !data.title || !data.content) {
                throw new Error('Generated data is incomplete');
            }
            
            console.log('✅ Infographic generated successfully:', data.title);
            setGeneratedData(data);
            setStep(4); // Preview state
        } catch (error) {
            console.error("❌ Generation failed:", error);
            setStep(2);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setError(`Failed to generate infographic: ${errorMessage}. Please try again.`);
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

            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fadeIn">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-red-700 font-medium text-sm">{error}</p>
                        <button 
                            onClick={() => setError(null)}
                            className="text-red-500 text-xs mt-1 hover:underline"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

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
            </div>

            {/* Render InfographicResultPage in a Portal so it escapes overflow:hidden containers */}
            {step === 4 && generatedData && createPortal(
                <InfographicResultPage
                    data={generatedData}
                    onClose={onClose}
                    onRegenerate={() => {
                        setGeneratedData(null);
                        setStep(1);
                    }}
                />,
                document.body
            )}
        </>
    );
};

export default InfographicWizard;
