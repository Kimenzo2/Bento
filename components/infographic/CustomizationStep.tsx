import { IcoPalette, IcoWand } from '../IconscoutIcons';
import { ArrowLeft, Brain, User } from 'lucide-react';
import type React from 'react';
import { type GenerationRequest, GuideCharacter, InfographicStyle } from '../../types/infographic';
import { Label } from '../ui/input';
import { Switch } from '../ui/switch';

interface CustomizationStepProps {
  request: GenerationRequest;
  onChange: (req: GenerationRequest) => void;
  onBack: () => void;
  onGenerate: () => void;
}

const CustomizationStep: React.FC<CustomizationStepProps> = ({
  request,
  onChange,
  onBack,
  onGenerate,
}) => {
  const styles = [
    {
      id: InfographicStyle.ILLUSTRATED,
      label: 'Illustrated',
      desc: 'Colorful & friendly',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: InfographicStyle.DIAGRAM,
      label: 'Diagram',
      desc: 'Technical & clear',
      color: 'bg-green-100 text-green-600',
    },
    {
      id: InfographicStyle.COMIC,
      label: 'Comic',
      desc: 'Story panels',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      id: InfographicStyle.MIXED,
      label: 'Mixed',
      desc: 'Best of both',
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  const characters = [
    { id: GuideCharacter.NONE, label: 'No Guide', icon: '🚫' },
    { id: GuideCharacter.OWL, label: 'Prof. Owl', icon: '🦉' },
    { id: GuideCharacter.MOUSE, label: 'Lab Mouse', icon: '🐭' },
    { id: GuideCharacter.FOX, label: 'Explorer Fox', icon: '🦊' },
    { id: GuideCharacter.ROBOT, label: 'Micro Bot', icon: '🤖' },
    { id: GuideCharacter.DRAGON, label: 'Math Dragon', icon: '🐉' },
    { id: GuideCharacter.ASTRONAUT, label: 'Astro Pup', icon: '🐶' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="text-center mb-6 sm:mb-8">
        <h3 className="font-heading font-bold text-2xl sm:text-3xl text-charcoal-soft mb-2 px-2">
          Customize the Look
        </h3>
        <p className="text-cocoa-light text-sm sm:text-base px-2">
          Choose how your lesson should look and feel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Visual Style */}
        <div className="space-y-3">
          <Label className="text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
            <IcoPalette className="w-4 h-4" />
            Visual Style
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => onChange({ ...request, style: style.id })}
                className={`p-3 sm:p-4 rounded-xl border transition-all text-left min-h-11 active:scale-95 ${
                  request.style === style.id
                    ? 'border-coral-burst'
                    : 'border-peach-soft bg-surface hover:border-coral-burst/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg ${style.color} flex items-center justify-center mb-2`}
                >
                  <IcoPalette className="w-4 h-4" />
                </div>
                <div className="font-bold text-charcoal-soft text-xs sm:text-sm">{style.label}</div>
                <div className="text-[10px] sm:text-xs text-cocoa-light">{style.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Guide Character */}
        <div className="space-y-3">
          <Label className="text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" />
            Guide Character
          </Label>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => onChange({ ...request, guideCharacter: char.id })}
                className={`p-3 sm:p-4 lg:p-5 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 aspect-square min-h-11 active:scale-95 ${
                  request.guideCharacter === char.id
                    ? 'border-gold-sunshine bg-gold-sunshine/10'
                    : 'border-peach-soft bg-surface hover:border-gold-sunshine/50'
                }`}
              >
                <div className="text-2xl sm:text-3xl lg:text-4xl">{char.icon}</div>
                <div className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-center leading-tight">
                  {char.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Toggle */}
      <div className="bg-mint-breeze/10 border border-mint-breeze/30 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-mint-breeze/20 flex items-center justify-center text-emerald-600 shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-bold text-charcoal-soft text-sm sm:text-base">
              Interactive Elements
            </div>
            <div className="text-xs text-cocoa-light truncate">
              Click-to-learn, animations, and audio
            </div>
          </div>
        </div>
        <Switch
          checked={request.includeInteractive}
          onCheckedChange={(val) => onChange({ ...request, includeInteractive: val })}
          aria-label="Toggle interactive elements"
        />
      </div>

      {/* Navigation */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-peach-soft/30">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 px-6 py-3 text-cocoa-light hover:text-charcoal-soft font-heading font-bold transition-colors min-h-11 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onGenerate}
          className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-linear-to-r from-coral-burst to-gold-sunshine text-white rounded-full font-heading font-bold text-sm sm:text-base border border-white/20 hover:-translate-y-1 transition-all min-h-11 active:scale-95"
        >
          <IcoWand className="w-5 h-5" />
          Generate Infographic
        </button>
      </div>
    </div>
  );
};

export default CustomizationStep;
