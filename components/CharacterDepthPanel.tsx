import { AnimatePresence, motion } from 'framer-motion';
import {
  Book,
  Brain,
  ChevronDown,
  Heart,
  MessageCircle,
  Save,
  Target,
  User,
  X,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { Character } from '../types';
import { Button } from './ui/button';
import { Input as ShadcnInput, Label } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/input';

interface CharacterDepthPanelProps {
  character: Character;
  onUpdateCharacter: (updatedCharacter: Character) => void;
  onClose?: () => void;
}

interface CharacterSectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

const CharacterSection = ({
  id,
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: CharacterSectionProps) => (
  <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
    <Button
      variant="ghost"
      onClick={() => onToggle(id)}
      className="w-full flex justify-between p-4 hover:bg-white/5"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-emerald-400" />
        <span className="font-heading font-bold text-white">{title}</span>
      </div>
      <ChevronDown
        className={[
          'w-5 h-5 text-white/50 transition-transform',
          isExpanded ? 'rotate-180' : '',
        ].join(' ')}
      />
    </Button>

    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="p-4 pt-0 space-y-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface CharacterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
}

const CharacterSlider = ({
  label,
  value,
  onChange,
  color = 'emerald',
}: CharacterSliderProps) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="text-white/70">{label}</Label>
      <span className="text-xs font-bold text-emerald-400">{value}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value || 50}
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
      className={'w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-' + color + '-500'}
    />
  </div>
);

interface CharacterInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

const CharacterInputField = ({
  label,
  value,
  onChange,
  placeholder = '',
  multiline = false,
}: CharacterInputFieldProps) => (
  <div className="space-y-2">
    <Label className="text-white/70">{label}</Label>
    {multiline ? (
      <Textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="bg-black/20 border-white/20 rounded-lg p-3 text-white focus:border-emerald-500 h-20"
      />
    ) : (
      <ShadcnInput
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="bg-black/20 border-white/20 p-3 text-white focus:border-emerald-500"
      />
    )}
  </div>
);

interface CharacterSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const CharacterSelectField = ({
  label,
  value,
  onChange,
  options,
}: CharacterSelectFieldProps) => (
  <div className="space-y-2">
    <Label className="text-white/70">{label}</Label>
    <Select value={value || options[0].value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);


const CharacterDepthPanel: React.FC<CharacterDepthPanelProps> = ({
  character,
  onUpdateCharacter,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);
  const [localCharacter, setLocalCharacter] = useState<Character>(character);
  const [hasChanges, setHasChanges] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const updateField = (path: string[], value: any) => {
    setLocalCharacter((prev) => {
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = () => {
    onUpdateCharacter(localCharacter);
    setHasChanges(false);
  };


  return (
    <div className="fixed inset-0 bg-black/60  z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      className="bg-slate-900 rounded-3xl border border-peach-soft w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-white">Character Depth</h2>
              <p className="text-sm text-white/50">{localCharacter.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                className="flex px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="p-2 hover:bg-red-500/20 text-white/50 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Basic Info */}
          <CharacterSection id="basic" isExpanded={expandedSections.includes('basic')} onToggle={toggleSection} title="Basic Information" icon={User}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CharacterInputField
                label="Name"
                value={localCharacter.name}
                onChange={(val) => updateField(['name'], val)}
                placeholder="Character name"
              />
              <CharacterInputField
                label="Role"
                value={localCharacter.role || ''}
                onChange={(val) => updateField(['role'], val)}
                placeholder="Protagonist, Villain, Mentor..."
              />
            </div>
            <CharacterInputField
              label="Description"
              value={localCharacter.description}
              onChange={(val) => updateField(['description'], val)}
              placeholder="Brief character summary"
              multiline
            />
            <CharacterInputField
              label="Appearance"
              value={localCharacter.appearance || ''}
              onChange={(val) => updateField(['appearance'], val)}
              placeholder="Physical description for AI generation"
              multiline
            />
          </CharacterSection>

          {/* Psychological Profile (OCEAN Model) */}
          <CharacterSection id="psychology" isExpanded={expandedSections.includes('psychology')} onToggle={toggleSection} title="Psychological Profile" icon={Brain}>
            <div className="space-y-3">
              <CharacterSlider
                label="Openness (Creativity & Curiosity)"
                value={localCharacter.psychologicalProfile?.openness || 50}
                onChange={(val) => updateField(['psychologicalProfile', 'openness'], val)}
              />
              <CharacterSlider
                label="Conscientiousness (Organization & Discipline)"
                value={localCharacter.psychologicalProfile?.conscientiousness || 50}
                onChange={(val) => updateField(['psychologicalProfile', 'conscientiousness'], val)}
              />
              <CharacterSlider
                label="Extraversion (Sociability & Energy)"
                value={localCharacter.psychologicalProfile?.extraversion || 50}
                onChange={(val) => updateField(['psychologicalProfile', 'extraversion'], val)}
              />
              <CharacterSlider
                label="Agreeableness (Empathy & Cooperation)"
                value={localCharacter.psychologicalProfile?.agreeableness || 50}
                onChange={(val) => updateField(['psychologicalProfile', 'agreeableness'], val)}
              />
              <CharacterSlider
                label="Neuroticism (Emotional Stability)"
                value={localCharacter.psychologicalProfile?.neuroticism || 50}
                onChange={(val) => updateField(['psychologicalProfile', 'neuroticism'], val)}
              />
            </div>
          </CharacterSection>

          {/* Core Identity */}
          <CharacterSection id="identity" isExpanded={expandedSections.includes('identity')} onToggle={toggleSection} title="Core Identity" icon={Target}>
            <div className="space-y-4">
              <CharacterInputField
                label="Core Belief"
                value={localCharacter.coreIdentity?.coreBelief || ''}
                onChange={(val) => updateField(['coreIdentity', 'coreBelief'], val)}
                placeholder="How they see the world fundamentally..."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CharacterInputField
                  label="Greatest Desire"
                  value={localCharacter.coreIdentity?.greatestDesire || ''}
                  onChange={(val) => updateField(['coreIdentity', 'greatestDesire'], val)}
                  placeholder="What they want most"
                />
                <CharacterInputField
                  label="Greatest Fear"
                  value={localCharacter.coreIdentity?.greatestFear || ''}
                  onChange={(val) => updateField(['coreIdentity', 'greatestFear'], val)}
                  placeholder="What they avoid at all costs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CharacterInputField
                  label="Fatal Flaw"
                  value={localCharacter.coreIdentity?.flaw || ''}
                  onChange={(val) => updateField(['coreIdentity', 'flaw'], val)}
                  placeholder="Their tragic weakness"
                />
                <CharacterInputField
                  label="Greatest Strength"
                  value={localCharacter.coreIdentity?.strength || ''}
                  onChange={(val) => updateField(['coreIdentity', 'strength'], val)}
                  placeholder="Their most powerful asset"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CharacterInputField
                  label="The Lie They Believe"
                  value={localCharacter.coreIdentity?.lie || ''}
                  onChange={(val) => updateField(['coreIdentity', 'lie'], val)}
                  placeholder="False belief holding them back"
                />
                <CharacterInputField
                  label="The Truth They Need"
                  value={localCharacter.coreIdentity?.truth || ''}
                  onChange={(val) => updateField(['coreIdentity', 'truth'], val)}
                  placeholder="What they must learn"
                />
              </div>
            </div>
          </CharacterSection>

          {/* Backstory */}
          <CharacterSection id="backstory" isExpanded={expandedSections.includes('backstory')} onToggle={toggleSection} title="Formative Experiences" icon={Book}>
            <div className="space-y-4">
              <CharacterInputField
                label="Defining Childhood Memory"
                value={localCharacter.formativeExperiences?.childhoodMemory || ''}
                onChange={(val) => updateField(['formativeExperiences', 'childhoodMemory'], val)}
                multiline
              />
              <CharacterInputField
                label="Defining Moment"
                value={localCharacter.formativeExperiences?.definingMoment || ''}
                onChange={(val) => updateField(['formativeExperiences', 'definingMoment'], val)}
                placeholder="The event that made them who they are"
                multiline
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CharacterInputField
                  label="Biggest Regret"
                  value={localCharacter.formativeExperiences?.biggestRegret || ''}
                  onChange={(val) => updateField(['formativeExperiences', 'biggestRegret'], val)}
                />
                <CharacterInputField
                  label="Proudest Achievement"
                  value={localCharacter.formativeExperiences?.proudestAchievement || ''}
                  onChange={(val) =>
                    updateField(['formativeExperiences', 'proudestAchievement'], val)
                  }
                />
              </div>
            </div>
          </CharacterSection>

          {/* Relationships */}
          <CharacterSection id="relationships" isExpanded={expandedSections.includes('relationships')} onToggle={toggleSection} title="Relationship Style" icon={Heart}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CharacterSelectField
                label="Attachment Style"
                value={localCharacter.relationshipStyle?.attachmentStyle || 'secure'}
                onChange={(val) => updateField(['relationshipStyle', 'attachmentStyle'], val)}
                options={[
                  { value: 'secure', label: 'Secure' },
                  { value: 'anxious', label: 'Anxious' },
                  { value: 'avoidant', label: 'Avoidant' },
                  { value: 'disorganized', label: 'Disorganized' },
                ]}
              />
              <CharacterSelectField
                label="Trust Level"
                value={localCharacter.relationshipStyle?.trustLevel || 'cautious'}
                onChange={(val) => updateField(['relationshipStyle', 'trustLevel'], val)}
                options={[
                  { value: 'trusting', label: 'Trusting' },
                  { value: 'cautious', label: 'Cautious' },
                  { value: 'suspicious', label: 'Suspicious' },
                  { value: 'paranoid', label: 'Paranoid' },
                ]}
              />
              <CharacterSelectField
                label="Conflict Style"
                value={localCharacter.relationshipStyle?.conflictStyle || 'diplomatic'}
                onChange={(val) => updateField(['relationshipStyle', 'conflictStyle'], val)}
                options={[
                  { value: 'confrontational', label: 'Confrontational' },
                  { value: 'diplomatic', label: 'Diplomatic' },
                  { value: 'avoidant', label: 'Avoidant' },
                  { value: 'passive-aggressive', label: 'Passive-Aggressive' },
                ]}
              />
              <CharacterSelectField
                label="Love Language"
                value={localCharacter.relationshipStyle?.loveLanguage || 'words'}
                onChange={(val) => updateField(['relationshipStyle', 'loveLanguage'], val)}
                options={[
                  { value: 'words', label: 'Words of Affirmation' },
                  { value: 'acts', label: 'Acts of Service' },
                  { value: 'gifts', label: 'Receiving Gifts' },
                  { value: 'time', label: 'Quality Time' },
                  { value: 'touch', label: 'Physical Touch' },
                ]}
              />
            </div>
          </CharacterSection>

          {/* Voice & Behavior */}
          <CharacterSection id="behavior" isExpanded={expandedSections.includes('behavior')} onToggle={toggleSection} title="Voice & Behavior" icon={MessageCircle}>
            <div className="space-y-4">
              <CharacterInputField
                label="Speech Patterns"
                value={localCharacter.behavioralPatterns?.speechPatterns || ''}
                onChange={(val) => updateField(['behavioralPatterns', 'speechPatterns'], val)}
                placeholder="Formal, slang, poetic, stutters, etc."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CharacterInputField
                  label="Tone of Voice"
                  value={localCharacter.voiceProfile?.tone || ''}
                  onChange={(val) => updateField(['voiceProfile', 'tone'], val)}
                  placeholder="Warm, cold, sarcastic..."
                />
                <CharacterSelectField
                  label="Vocabulary Level"
                  value={localCharacter.voiceProfile?.vocabulary || 'moderate'}
                  onChange={(val) => updateField(['voiceProfile', 'vocabulary'], val)}
                  options={[
                    { value: 'simple', label: 'Simple' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'sophisticated', label: 'Sophisticated' },
                    { value: 'archaic', label: 'Archaic/Old' },
                  ]}
                />
              </div>
              <CharacterInputField
                label="Stress Response"
                value={localCharacter.behavioralPatterns?.stressResponse || ''}
                onChange={(val) => updateField(['behavioralPatterns', 'stressResponse'], val)}
                placeholder="How they react under pressure"
              />
            </div>
          </CharacterSection>
        </div>
      </motion.div>
    </div>
  );
};

export default CharacterDepthPanel;
