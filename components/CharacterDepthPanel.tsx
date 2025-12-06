import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronDown, 
    User, 
    Brain, 
    Heart, 
    Target, 
    MessageCircle,
    Book,
    Zap,
    Save,
    Plus,
    X,
    Edit2
} from 'lucide-react';
import { Character } from '../types';

interface CharacterDepthPanelProps {
    character: Character;
    onUpdateCharacter: (updatedCharacter: Character) => void;
    onClose?: () => void;
}

const CharacterDepthPanel: React.FC<CharacterDepthPanelProps> = ({ 
    character, 
    onUpdateCharacter,
    onClose 
}) => {
    const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);
    const [localCharacter, setLocalCharacter] = useState<Character>(character);
    const [hasChanges, setHasChanges] = useState(false);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => 
            prev.includes(section) 
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const updateField = (path: string[], value: any) => {
        setLocalCharacter(prev => {
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

    const Section = ({ 
        id, 
        title, 
        icon: Icon, 
        children 
    }: { 
        id: string; 
        title: string; 
        icon: any; 
        children: React.ReactNode 
    }) => {
        const isExpanded = expandedSections.includes(id);
        
        return (
            <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/50">
                <button
                    onClick={() => toggleSection(id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-emerald-400" />
                        <span className="font-heading font-bold text-white">{title}</span>
                    </div>
                    <ChevronDown 
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                        }`} 
                    />
                </button>
                
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 pt-0 space-y-4">
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const Slider = ({ 
        label, 
        value, 
        onChange, 
        color = 'emerald' 
    }: { 
        label: string; 
        value: number; 
        onChange: (val: number) => void;
        color?: string;
    }) => (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm text-slate-300">{label}</label>
                <span className="text-xs font-bold text-emerald-400">{value}%</span>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value={value || 50}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${color}-500`}
            />
        </div>
    );

    const Input = ({ 
        label, 
        value, 
        onChange, 
        placeholder = '',
        multiline = false 
    }: { 
        label: string; 
        value: string; 
        onChange: (val: string) => void;
        placeholder?: string;
        multiline?: boolean;
    }) => (
        <div className="space-y-2">
            <label className="text-sm text-slate-300">{label}</label>
            {multiline ? (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm focus:border-emerald-500 outline-none resize-none h-20"
                />
            ) : (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm focus:border-emerald-500 outline-none"
                />
            )}
        </div>
    );

    const Select = ({ 
        label, 
        value, 
        onChange, 
        options 
    }: { 
        label: string; 
        value: string; 
        onChange: (val: string) => void;
        options: { value: string; label: string }[];
    }) => (
        <div className="space-y-2">
            <label className="text-sm text-slate-300">{label}</label>
            <select
                value={value || options[0].value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm focus:border-emerald-500 outline-none"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <User className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-heading font-bold text-white">Character Depth</h2>
                            <p className="text-sm text-slate-400">{localCharacter.name}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {hasChanges && (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        )}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    
                    {/* Basic Info */}
                    <Section id="basic" title="Basic Information" icon={User}>
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Name" 
                                value={localCharacter.name}
                                onChange={(val) => updateField(['name'], val)}
                                placeholder="Character name"
                            />
                            <Input 
                                label="Role" 
                                value={localCharacter.role || ''}
                                onChange={(val) => updateField(['role'], val)}
                                placeholder="Protagonist, Villain, Mentor..."
                            />
                        </div>
                        <Input 
                            label="Description" 
                            value={localCharacter.description}
                            onChange={(val) => updateField(['description'], val)}
                            placeholder="Brief character summary"
                            multiline
                        />
                        <Input 
                            label="Appearance" 
                            value={localCharacter.appearance || ''}
                            onChange={(val) => updateField(['appearance'], val)}
                            placeholder="Physical description for AI generation"
                            multiline
                        />
                    </Section>

                    {/* Psychological Profile (OCEAN Model) */}
                    <Section id="psychology" title="Psychological Profile" icon={Brain}>
                        <div className="space-y-3">
                            <Slider 
                                label="Openness (Creativity & Curiosity)"
                                value={localCharacter.psychologicalProfile?.openness || 50}
                                onChange={(val) => updateField(['psychologicalProfile', 'openness'], val)}
                            />
                            <Slider 
                                label="Conscientiousness (Organization & Discipline)"
                                value={localCharacter.psychologicalProfile?.conscientiousness || 50}
                                onChange={(val) => updateField(['psychologicalProfile', 'conscientiousness'], val)}
                            />
                            <Slider 
                                label="Extraversion (Sociability & Energy)"
                                value={localCharacter.psychologicalProfile?.extraversion || 50}
                                onChange={(val) => updateField(['psychologicalProfile', 'extraversion'], val)}
                            />
                            <Slider 
                                label="Agreeableness (Empathy & Cooperation)"
                                value={localCharacter.psychologicalProfile?.agreeableness || 50}
                                onChange={(val) => updateField(['psychologicalProfile', 'agreeableness'], val)}
                            />
                            <Slider 
                                label="Neuroticism (Emotional Stability)"
                                value={localCharacter.psychologicalProfile?.neuroticism || 50}
                                onChange={(val) => updateField(['psychologicalProfile', 'neuroticism'], val)}
                            />
                        </div>
                    </Section>

                    {/* Core Identity */}
                    <Section id="identity" title="Core Identity" icon={Target}>
                        <div className="space-y-4">
                            <Input 
                                label="Core Belief"
                                value={localCharacter.coreIdentity?.coreBelief || ''}
                                onChange={(val) => updateField(['coreIdentity', 'coreBelief'], val)}
                                placeholder="How they see the world fundamentally..."
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Greatest Desire"
                                    value={localCharacter.coreIdentity?.greatestDesire || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'greatestDesire'], val)}
                                    placeholder="What they want most"
                                />
                                <Input 
                                    label="Greatest Fear"
                                    value={localCharacter.coreIdentity?.greatestFear || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'greatestFear'], val)}
                                    placeholder="What they avoid at all costs"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Fatal Flaw"
                                    value={localCharacter.coreIdentity?.flaw || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'flaw'], val)}
                                    placeholder="Their tragic weakness"
                                />
                                <Input 
                                    label="Greatest Strength"
                                    value={localCharacter.coreIdentity?.strength || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'strength'], val)}
                                    placeholder="Their most powerful asset"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="The Lie They Believe"
                                    value={localCharacter.coreIdentity?.lie || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'lie'], val)}
                                    placeholder="False belief holding them back"
                                />
                                <Input 
                                    label="The Truth They Need"
                                    value={localCharacter.coreIdentity?.truth || ''}
                                    onChange={(val) => updateField(['coreIdentity', 'truth'], val)}
                                    placeholder="What they must learn"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Backstory */}
                    <Section id="backstory" title="Formative Experiences" icon={Book}>
                        <div className="space-y-4">
                            <Input 
                                label="Defining Childhood Memory"
                                value={localCharacter.formativeExperiences?.childhoodMemory || ''}
                                onChange={(val) => updateField(['formativeExperiences', 'childhoodMemory'], val)}
                                multiline
                            />
                            <Input 
                                label="Defining Moment"
                                value={localCharacter.formativeExperiences?.definingMoment || ''}
                                onChange={(val) => updateField(['formativeExperiences', 'definingMoment'], val)}
                                placeholder="The event that made them who they are"
                                multiline
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Biggest Regret"
                                    value={localCharacter.formativeExperiences?.biggestRegret || ''}
                                    onChange={(val) => updateField(['formativeExperiences', 'biggestRegret'], val)}
                                />
                                <Input 
                                    label="Proudest Achievement"
                                    value={localCharacter.formativeExperiences?.proudestAchievement || ''}
                                    onChange={(val) => updateField(['formativeExperiences', 'proudestAchievement'], val)}
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Relationships */}
                    <Section id="relationships" title="Relationship Style" icon={Heart}>
                        <div className="grid grid-cols-2 gap-4">
                            <Select 
                                label="Attachment Style"
                                value={localCharacter.relationshipStyle?.attachmentStyle || 'secure'}
                                onChange={(val) => updateField(['relationshipStyle', 'attachmentStyle'], val)}
                                options={[
                                    { value: 'secure', label: 'Secure' },
                                    { value: 'anxious', label: 'Anxious' },
                                    { value: 'avoidant', label: 'Avoidant' },
                                    { value: 'disorganized', label: 'Disorganized' }
                                ]}
                            />
                            <Select 
                                label="Trust Level"
                                value={localCharacter.relationshipStyle?.trustLevel || 'cautious'}
                                onChange={(val) => updateField(['relationshipStyle', 'trustLevel'], val)}
                                options={[
                                    { value: 'trusting', label: 'Trusting' },
                                    { value: 'cautious', label: 'Cautious' },
                                    { value: 'suspicious', label: 'Suspicious' },
                                    { value: 'paranoid', label: 'Paranoid' }
                                ]}
                            />
                            <Select 
                                label="Conflict Style"
                                value={localCharacter.relationshipStyle?.conflictStyle || 'diplomatic'}
                                onChange={(val) => updateField(['relationshipStyle', 'conflictStyle'], val)}
                                options={[
                                    { value: 'confrontational', label: 'Confrontational' },
                                    { value: 'diplomatic', label: 'Diplomatic' },
                                    { value: 'avoidant', label: 'Avoidant' },
                                    { value: 'passive-aggressive', label: 'Passive-Aggressive' }
                                ]}
                            />
                            <Select 
                                label="Love Language"
                                value={localCharacter.relationshipStyle?.loveLanguage || 'words'}
                                onChange={(val) => updateField(['relationshipStyle', 'loveLanguage'], val)}
                                options={[
                                    { value: 'words', label: 'Words of Affirmation' },
                                    { value: 'acts', label: 'Acts of Service' },
                                    { value: 'gifts', label: 'Receiving Gifts' },
                                    { value: 'time', label: 'Quality Time' },
                                    { value: 'touch', label: 'Physical Touch' }
                                ]}
                            />
                        </div>
                    </Section>

                    {/* Voice & Behavior */}
                    <Section id="behavior" title="Voice & Behavior" icon={MessageCircle}>
                        <div className="space-y-4">
                            <Input 
                                label="Speech Patterns"
                                value={localCharacter.behavioralPatterns?.speechPatterns || ''}
                                onChange={(val) => updateField(['behavioralPatterns', 'speechPatterns'], val)}
                                placeholder="Formal, slang, poetic, stutters, etc."
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Tone of Voice"
                                    value={localCharacter.voiceProfile?.tone || ''}
                                    onChange={(val) => updateField(['voiceProfile', 'tone'], val)}
                                    placeholder="Warm, cold, sarcastic..."
                                />
                                <Select 
                                    label="Vocabulary Level"
                                    value={localCharacter.voiceProfile?.vocabulary || 'moderate'}
                                    onChange={(val) => updateField(['voiceProfile', 'vocabulary'], val)}
                                    options={[
                                        { value: 'simple', label: 'Simple' },
                                        { value: 'moderate', label: 'Moderate' },
                                        { value: 'sophisticated', label: 'Sophisticated' },
                                        { value: 'archaic', label: 'Archaic/Old' }
                                    ]}
                                />
                            </div>
                            <Input 
                                label="Stress Response"
                                value={localCharacter.behavioralPatterns?.stressResponse || ''}
                                onChange={(val) => updateField(['behavioralPatterns', 'stressResponse'], val)}
                                placeholder="How they react under pressure"
                            />
                        </div>
                    </Section>

                </div>
            </motion.div>
        </div>
    );
};

export default CharacterDepthPanel;
