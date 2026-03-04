import { ArrowRight, Layout, Users } from 'lucide-react';
import type React from 'react';
import { AgeGroup, type GenerationRequest, InfographicType } from '../../types/infographic';
import { Input, Label } from '../ui/input';

interface TopicInputStepProps {
  request: GenerationRequest;
  onChange: (req: GenerationRequest) => void;
  onNext: () => void;
}

const TopicInputStep: React.FC<TopicInputStepProps> = ({ request, onChange, onNext }) => {
  const ageGroups = [
    {
      id: AgeGroup.PRESCHOOL,
      label: 'Preschool (3-5)',
      icon: '🧸',
      desc: 'Simple shapes & mascots',
    },
    {
      id: AgeGroup.EARLY_ELEMENTARY,
      label: 'Early Elem (6-8)',
      icon: '🎒',
      desc: 'Visual steps & fun facts',
    },
    {
      id: AgeGroup.LATE_ELEMENTARY,
      label: 'Late Elem (9-12)',
      icon: '🔬',
      desc: 'Detailed & scientific',
    },
    { id: AgeGroup.TEEN, label: 'Teen (13+)', icon: '🎓', desc: 'Complex systems & data' },
  ];

  const types = [
    { id: InfographicType.PROCESS, label: 'How it Works', desc: 'Step-by-step flow' },
    { id: InfographicType.COMPARISON, label: 'Comparison', desc: 'This vs That' },
    { id: InfographicType.ANATOMY, label: 'Anatomy', desc: 'Inside look' },
    { id: InfographicType.TIMELINE, label: 'Timeline', desc: 'History & events' },
    { id: InfographicType.GEOGRAPHIC, label: 'Map', desc: 'Where things are' },
    { id: InfographicType.CATEGORY, label: 'Types', desc: 'Classification' },
    { id: InfographicType.STATISTICAL, label: 'Data', desc: 'Visual numbers' },
    { id: InfographicType.STORY, label: 'Story', desc: 'Narrative lesson' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="text-center mb-6 sm:mb-8">
        <h3 className="font-heading font-bold text-2xl sm:text-3xl text-charcoal-soft mb-2 px-2">
          What should we teach today?
        </h3>
        <p className="text-cocoa-light text-sm sm:text-base px-2">
          Enter a topic and we'll design the perfect lesson.
        </p>
      </div>

      {/* Topic Input */}
      <div className="space-y-3">
        <Label className="text-xs sm:text-sm uppercase tracking-wide">
          Topic
        </Label>
        <Input
          type="text"
          value={request.topic}
          onChange={(e) => onChange({ ...request, topic: e.target.value })}
          placeholder="e.g., How do volcanoes erupt?"
          className="bg-cream-soft rounded-2xl p-3 sm:p-4 text-base sm:text-lg"
          autoFocus
        />
      </div>

      {/* Age Selection */}
      <div className="space-y-3">
        <Label className="text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4" />
          Target Age Group
        </Label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {ageGroups.map((age) => (
            <button
              key={age.id}
              onClick={() => onChange({ ...request, ageGroup: age.id })}
              className={`p-3 sm:p-4 rounded-xl border transition-all text-left group relative overflow-hidden min-h-11 active:scale-95 ${
                request.ageGroup === age.id
                  ? 'border-coral-burst bg-coral-burst/5'
                  : 'border-peach-soft bg-surface hover:border-coral-burst/50'
              }`}
            >
              <div className="text-xl sm:text-2xl mb-2">{age.icon}</div>
              <div className="font-heading font-bold text-charcoal-soft text-xs sm:text-sm">
                {age.label}
              </div>
              <div className="text-[10px] sm:text-xs text-cocoa-light mt-1">{age.desc}</div>
              {request.ageGroup === age.id && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-coral-burst rounded-full animate-pulse"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Type Selection */}
      <div className="space-y-3">
        <Label className="text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
          <Layout className="w-4 h-4" />
          Infographic Type
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {types.map((type) => (
            <button
              key={type.id}
              onClick={() => onChange({ ...request, type: type.id })}
              className={`p-2.5 sm:p-3 rounded-xl border transition-all text-center text-xs sm:text-sm font-medium min-h-11 active:scale-95 ${
                request.type === type.id
                  ? 'border-gold-sunshine bg-gold-sunshine/10 text-charcoal-soft'
                  : 'border-peach-soft bg-surface text-cocoa-light hover:border-gold-sunshine/50'
              }`}
            >
              <div className="font-bold mb-1">{type.label}</div>
              <div className="text-[10px] opacity-70">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!request.topic.trim()}
          className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-linear-to-r from-coral-burst to-gold-sunshine text-white rounded-full font-heading font-bold text-sm sm:text-base border border-white/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95 min-h-11"
        >
          Next Step
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopicInputStep;
