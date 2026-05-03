import { IcoPalette, IcoWand } from './IconscoutIcons';
import {
  ArrowLeft,
  Download,
  Edit2,
  Maximize2,
  Plus,
  RefreshCw,
  Share2,
  Sliders,
} from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateRefinedImage } from '../services/aiGatewayService';
import type { UserProfile } from '../services/profileService';
import { AppMode, ArtStyle, type BookProject, type Character, type VisualSettings } from '../types';
import CharacterDepthPanel from './CharacterDepthPanel';
import MobileBottomNav from './MobileBottomNav';
import { Button } from './ui/button';
import { Label, Textarea } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/sonner';
import { usePageSEO } from '../hooks/usePageSEO';

interface VisualStudioProps {
  project: BookProject | null;
  onBack?: () => void;
  userProfile: UserProfile | null;
  onNavigate?: (mode: AppMode) => void;
  onUpdateProject?: (project: BookProject) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const VisualStudio: React.FC<VisualStudioProps> = ({
  project,
  onBack,
  userProfile,
  onNavigate,
  onUpdateProject,
}) => {
  usePageSEO({
    title: 'Visual Studio — Genesis AI Visual Storytelling',
    description:
      'Advanced AI visual workspace. Refine illustrations, build scenes, and craft stunning visual narratives with Genesis Visual Studio.',
    canonical: '/visual-studio',
  });

  const [activeTab, setActiveTab] = useState<'character' | 'scene' | 'style'>('character');
  const { t } = useTranslation('creation');
  const [isGenerating, setIsGenerating] = useState(false);
  // Advanced features state
  const [showCharacterDepth, setShowCharacterDepth] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<VisualSettings>({
    activeTab: 'character',
    prompt: '',
    styleA: ArtStyle.WATERCOLOR,
    styleB: ArtStyle.PIXAR_3D,
    mixRatio: 50,
    lighting: 'natural',
    cameraAngle: 'eye-level',
    generatedImage: null,
    selectedCharacterId: null,
    expression: 'neutral',
    pose: 'standing',
    costume: 'default',
  });

  // UI State
  const [_showShareModal, setShowShareModal] = useState(false);
  const [_expandedVisual, setExpandedVisual] = useState<'current' | null>(null);
  const [mobileActiveTab, setMobileActiveTab] = useState<'character' | 'scene' | 'style'>(
    'character'
  );

  // Styles list
  const styles = Object.values(ArtStyle);

  // Available characters (Project + Defaults)
  const availableCharacters = project?.characters || [];

  // Handle generation
  const handleGenerate = async () => {
    if (!settings.prompt && !settings.selectedCharacterId) {
      toast.info('Please enter a prompt or select a character');
      return;
    }

    setIsGenerating(true);
    try {
      // Construct the params object expected by generateRefinedImage
      const params = {
        styleA: settings.styleA,
        styleB: settings.styleB,
        mixRatio: settings.mixRatio,
        lighting: settings.lighting,
        camera: settings.cameraAngle,
      };

      // Build comprehensive character description from depth data
      let finalPrompt = settings.prompt;
      if (settings.selectedCharacterId) {
        const character = availableCharacters.find((c) => c.id === settings.selectedCharacterId);
        if (character) {
          // Build rich character prompt using depth data
          const parts: string[] = [];

          // Basic identity
          parts.push(`${character.name}, ${character.role || 'character'}`);

          // Physical appearance (priority for visual generation)
          if (character.appearance) {
            parts.push(`Appearance: ${character.appearance}`);
          } else if (character.visualTraits) {
            parts.push(character.visualTraits);
          }

          // Expression and pose from settings
          parts.push(`${settings.expression} expression, ${settings.pose} pose`);

          // Personality hints for visual interpretation
          if (character.psychologicalProfile) {
            const profile = character.psychologicalProfile;
            if (profile.extraversion > 70) parts.push('confident and outgoing body language');
            else if (profile.extraversion < 30) parts.push('reserved and introspective demeanor');

            if (profile.neuroticism > 70) parts.push('tense or anxious posture');
            else if (profile.neuroticism < 30) parts.push('calm and relaxed presence');
          }

          // Core identity for atmosphere
          if (character.coreIdentity?.strength) {
            parts.push(`radiating ${character.coreIdentity.strength.toLowerCase()}`);
          }

          // Voice/behavior hints for visual tone
          if (character.voiceProfile?.tone) {
            parts.push(`${character.voiceProfile.tone} demeanor`);
          }

          // Add scene context
          if (settings.prompt) {
            parts.push(`Scene: ${settings.prompt}`);
          }

          finalPrompt = parts.join('. ');
        }
      }

      const result = await generateRefinedImage(finalPrompt, params);
      if (result) {
        setSettings((prev) => ({ ...prev, generatedImage: result }));
      }
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMobileTabChange = (tab: 'character' | 'scene' | 'style') => {
    setMobileActiveTab(tab);
    setActiveTab(tab);
  };

  const handleCreateNewCharacter = () => {
    if (!project || !onUpdateProject) return;

    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      name: 'New Character',
      description: '',
      visualTraits: '',
      role: 'character',
      psychologicalProfile: {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50,
      },
    };

    const updatedProject = {
      ...project,
      characters: [...(project.characters || []), newCharacter],
    };

    onUpdateProject(updatedProject);
    setEditingCharacterId(newCharacter.id);
    setShowCharacterDepth(true);
  };

  const handleUpdateCharacter = (updatedCharacter: Character) => {
    if (!project || !onUpdateProject) return;

    const updatedProject = {
      ...project,
      characters: project.characters.map((c) =>
        c.id === updatedCharacter.id ? updatedCharacter : c
      ),
    };

    onUpdateProject(updatedProject);
    setShowCharacterDepth(false);
    setEditingCharacterId(null);
  };

  const editingCharacter = editingCharacterId
    ? availableCharacters.find((c) => c.id === editingCharacterId)
    : null;

  return (
    <div className="w-full mx-auto animate-fadeIn max-w-450 p-3 md:p-6 pb-20 md:pb-24">
      {/* Header */}
      <div className="relative text-center mb-4 md:mb-6 shrink-0 px-10 sm:px-12 md:px-20">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 rounded-full text-cocoa-light hover:text-coral-burst hover:bg-cream-soft z-10 min-h-11 min-w-11"
            aria-label={t('visualStudio.goBack', 'Go back')}
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        )}

        {/* Right Side Actions - Notifications, Go Live */}
        <div className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10" />

        <p className="text-cocoa-light font-body text-xs sm:text-sm mt-2 md:mt-3 px-2 line-clamp-2">
          {t(
            'visualStudio.modeIndividualDescription',
            'Fine-tune characters, compose scenes, and experiment with style alchemy.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 min-h-150">
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Control Panel - Left Side (40%) */}
          <div className="bg-surface rounded-3xl border border-peach-soft overflow-y-auto transition-all duration-500 ease-in-out z-20 w-full lg:w-2/5 p-4 md:p-6 max-h-125 lg:max-h-170 panel-breathing">
            {/* Tabs */}
            <div className="flex bg-cream-soft p-1.5 rounded-2xl mb-6 md:mb-8 border border-peach-soft/50">
              {['character', 'scene', 'style'].map((tab) => (
                <Button
                  key={tab}
                  variant="ghost"
                  onClick={() => {
                    setActiveTab(tab as 'character' | 'scene' | 'style');
                    setSettings((prev) => ({ ...prev, generatedImage: null }));
                  }}
                  className={`flex-1 py-2 md:py-2.5 font-heading capitalize
                              ${activeTab === tab ? 'bg-surface text-coral-burst border border-peach-soft' : 'text-cocoa-light hover:text-charcoal-soft border border-transparent'}`}
                >
                  {tab}
                </Button>
              ))}
            </div>
            {/* Tab Content: Character */}
            {activeTab === 'character' && (
              <div className="space-y-4 md:space-y-6 animate-fadeIn">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-cocoa-light uppercase">Select Character</Label>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreateNewCharacter}
                      className="flex px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                      title={t('visualStudio.createNewCharacter', 'Create new character')}
                    >
                      <Plus className="w-3 h-3" />
                      New
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:gap-3 max-h-50 md:max-h-75 overflow-y-auto pr-1 custom-scrollbar">
                    {availableCharacters.map((char) => (
                      <div
                        key={char.id}
                        className={`p-2 rounded-xl border cursor-pointer transition-all relative group
                          ${settings.selectedCharacterId === char.id ? 'border-coral-burst bg-coral-burst/5' : 'border-peach-soft hover:border-coral-burst/30'}`}
                        onClick={() =>
                          setSettings((prev) => ({ ...prev, selectedCharacterId: char.id }))
                        }
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-coral-burst to-gold-sunshine flex items-center justify-center text-white text-xs font-bold">
                            {char.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-charcoal-soft truncate">
                              {char.name}
                            </p>
                            <p className="text-xs text-cocoa-light truncate">
                              {char.role || 'Character'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-cocoa-light uppercase">Expression & Pose</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={settings.expression}
                      onValueChange={(v) => setSettings((prev) => ({ ...prev, expression: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('visualStudio.expression', 'Expression')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neutral">
                          {t('visualStudio.expressionNeutral', 'Neutral')}
                        </SelectItem>
                        <SelectItem value="happy">
                          {t('visualStudio.expressionHappy', 'Happy')}
                        </SelectItem>
                        <SelectItem value="sad">
                          {t('visualStudio.expressionSad', 'Sad')}
                        </SelectItem>
                        <SelectItem value="angry">
                          {t('visualStudio.expressionAngry', 'Angry')}
                        </SelectItem>
                        <SelectItem value="surprised">
                          {t('visualStudio.expressionSurprised', 'Surprised')}
                        </SelectItem>
                        <SelectItem value="determined">
                          {t('visualStudio.expressionDetermined', 'Determined')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={settings.pose}
                      onValueChange={(v) => setSettings((prev) => ({ ...prev, pose: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('visualStudio.pose', 'Pose')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standing">
                          {t('visualStudio.poseStanding', 'Standing')}
                        </SelectItem>
                        <SelectItem value="sitting">
                          {t('visualStudio.poseSitting', 'Sitting')}
                        </SelectItem>
                        <SelectItem value="walking">
                          {t('visualStudio.poseWalking', 'Walking')}
                        </SelectItem>
                        <SelectItem value="running">
                          {t('visualStudio.poseRunning', 'Running')}
                        </SelectItem>
                        <SelectItem value="fighting">
                          {t('visualStudio.poseFighting', 'Fighting')}
                        </SelectItem>
                        <SelectItem value="flying">
                          {t('visualStudio.poseFlying', 'Flying')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Scene */}
            {activeTab === 'scene' && (
              <div className="space-y-4 md:space-y-6 animate-fadeIn">
                <div className="space-y-2">
                  <Label className="text-xs text-cocoa-light uppercase">Lighting & Angle</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={settings.lighting}
                      onValueChange={(v) => setSettings((prev) => ({ ...prev, lighting: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('visualStudio.lighting', 'Lighting')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="natural">
                          {t('visualStudio.lightNatural', 'Natural Light')}
                        </SelectItem>
                        <SelectItem value="golden-hour">
                          {t('visualStudio.lightGoldenHour', 'Golden Hour')}
                        </SelectItem>
                        <SelectItem value="night">
                          {t('visualStudio.lightNightDark', 'Night / Dark')}
                        </SelectItem>
                        <SelectItem value="studio">
                          {t('visualStudio.lightStudio', 'Studio Lighting')}
                        </SelectItem>
                        <SelectItem value="neon">
                          {t('visualStudio.lightNeon', 'Neon / Cyberpunk')}
                        </SelectItem>
                        <SelectItem value="dramatic">
                          {t('visualStudio.lightDramatic', 'Dramatic Shadows')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={settings.cameraAngle}
                      onValueChange={(v) => setSettings((prev) => ({ ...prev, cameraAngle: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('visualStudio.cameraAngle', 'Camera angle')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eye-level">
                          {t('visualStudio.cameraEyeLevel', 'Eye Level')}
                        </SelectItem>
                        <SelectItem value="low-angle">
                          {t('visualStudio.cameraLow', 'Low Angle')}
                        </SelectItem>
                        <SelectItem value="high-angle">
                          {t('visualStudio.cameraHigh', 'High Angle')}
                        </SelectItem>
                        <SelectItem value="wide-shot">
                          {t('visualStudio.cameraWide', 'Wide Shot')}
                        </SelectItem>
                        <SelectItem value="close-up">
                          {t('visualStudio.cameraClose', 'Close Up')}
                        </SelectItem>
                        <SelectItem value="aerial">
                          {t('visualStudio.cameraAerial', 'Aerial View')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-cocoa-light uppercase">Scene Description</Label>
                  <Textarea
                    value={settings.prompt}
                    onChange={(e) => setSettings((prev) => ({ ...prev, prompt: e.target.value }))}
                    className="h-24 md:h-32 bg-cream-base p-2.5 md:p-3 md:text-base"
                    placeholder={t(
                      'visualStudio.describeScene',
                      'Describe the setting, props, and atmosphere...'
                    )}
                  />
                </div>
              </div>
            )}

            {/* Tab Content: Style Alchemy */}
            {activeTab === 'style' && (
              <div className="space-y-4 md:space-y-6 animate-fadeIn">
                <div className="space-y-2">
                  <Label className="text-xs text-cocoa-light uppercase flex items-center gap-2">
                    <IcoPalette className="w-4 h-4" /> Style Alchemy
                  </Label>
                  <div className="bg-cream-base border border-peach-soft rounded-2xl p-3 md:p-4 space-y-3 md:space-y-4">
                    <div>
                      <div className="text-xs text-cocoa-light mb-1">
                        Primary Style ({settings.mixRatio}%)
                      </div>
                      <Select
                        value={settings.styleA}
                        onValueChange={(v) =>
                          setSettings((prev) => ({ ...prev, styleA: v as ArtStyle }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('visualStudio.primaryStyle', 'Primary style')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {styles.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3">
                      <Sliders className="text-coral-burst w-4 h-4" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.mixRatio}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            mixRatio: Number.parseInt(e.target.value),
                          }))
                        }
                        title={t('visualStudio.mixRatioTitle', 'Mix ratio: {{ratio}}%', {
                          ratio: settings.mixRatio,
                        })}
                        aria-label={t('visualStudio.styleMixRatio', 'Style mix ratio')}
                        className="w-full accent-coral-burst h-1.5 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-cocoa-light mb-1">
                        Secondary Style ({100 - settings.mixRatio}%)
                      </div>
                      <Select
                        value={settings.styleB}
                        onValueChange={(v) =>
                          setSettings((prev) => ({ ...prev, styleB: v as ArtStyle }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('visualStudio.secondaryStyle', 'Secondary style')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {styles.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-cocoa-light uppercase">Test Prompt</Label>
                  <Textarea
                    value={settings.prompt}
                    onChange={(e) => setSettings((prev) => ({ ...prev, prompt: e.target.value }))}
                    className="h-20 md:h-24 bg-cream-base p-2.5 md:p-3 md:text-base"
                    placeholder={t(
                      'visualStudio.testPromptPlaceholder',
                      'A landscape with a castle...'
                    )}
                  />
                </div>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full mt-4"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <IcoWand className="w-4 h-4 md:w-5 md:h-5" />
              )}
              {activeTab === 'character'
                ? t('visualStudio.generate', 'Generate')
                : activeTab === 'scene'
                  ? t('visualStudio.render', 'Render')
                  : t('visualStudio.mix', 'Mix')}
            </Button>
          </div>

          {/* Preview Panel - Right Side (60%) */}
          <div className="w-full lg:w-3/5 h-100 lg:h-170 bg-surface rounded-3xl border border-peach-soft overflow-hidden relative group">
            {settings.generatedImage ? (
              <>
                <img
                  src={settings.generatedImage}
                  alt={t('visualStudio.generatedResult', 'Generated result')}
                  className="w-full h-full object-contain bg-surface/50"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowShareModal(true)}
                      className="p-2 bg-surface/20  text-white hover:bg-surface/40"
                      title="Share"
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = settings.generatedImage!;
                        link.download = `genesis-${Date.now()}.png`;
                        link.click();
                      }}
                      className="p-2 bg-surface/20  text-white hover:bg-surface/40"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedVisual('current')}
                    className="p-2 bg-surface/20  text-white hover:bg-surface/40"
                    title="Expand"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-cream-soft/50 text-cocoa-light p-8 text-center">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-coral-burst/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-coral-burst rounded-full border-t-transparent animate-spin"></div>
                      <IcoWand className="absolute inset-0 m-auto w-8 h-8 text-coral-burst animate-pulse" />
                    </div>
                    <p className="font-heading font-bold text-xl text-charcoal-soft animate-pulse">
                      Dreaming...
                    </p>
                    <p className="text-sm max-w-xs">
                      Our AI is painting your imagination. This usually takes 10-15 seconds.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 opacity-60">
                    <div className="w-20 h-20 rounded-full bg-surface border border-peach-soft/50 flex items-center justify-center mb-2">
                      <IcoWand className="w-10 h-10 text-coral-burst/50" />
                    </div>
                    <div>
                      <p className="text-charcoal-soft font-heading font-bold text-lg">
                        Ready to Create
                      </p>
                      <p className="text-cocoa-light text-sm mt-1">
                        Configure your settings above and click Generate
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Character Depth Panel */}
      {showCharacterDepth && editingCharacter && (
        <CharacterDepthPanel
          character={editingCharacter}
          onUpdateCharacter={handleUpdateCharacter}
          onClose={() => {
            setShowCharacterDepth(false);
            setEditingCharacterId(null);
          }}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={mobileActiveTab} onTabChange={handleMobileTabChange} />
    </div>
  );
};

export default VisualStudio;
