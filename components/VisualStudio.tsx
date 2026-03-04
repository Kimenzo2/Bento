import {
  ArrowLeft,
  Bell,
  Download,
  Edit2,
  Map,
  Maximize2,
  Palette,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { generateRefinedImage } from '../services/geminiService';
import type { UserProfile } from '../services/profileService';
import { AppMode, ArtStyle, type BookProject, type Character, type VisualSettings } from '../types';
import CharacterDepthPanel from './CharacterDepthPanel';
import MobileBottomNav from './MobileBottomNav';
import StoryMap from './StoryMap';
import { BroadcastStudio, NotificationCenter } from './collaboration';
import { Button } from './ui/button';
import { Label, Textarea } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/sonner';

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
  const [activeTab, setActiveTab] = useState<'character' | 'scene' | 'style'>('character');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'storymap'>('individual');

  // Advanced features state
  const [showBroadcastStudio, setShowBroadcastStudio] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showCharacterDepth, setShowCharacterDepth] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const notificationBtnRef = useRef<HTMLButtonElement>(null);

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
  const [unreadCount, _setUnreadCount] = useState(0);
  const [mobileActiveTab, setMobileActiveTab] = useState<'character' | 'scene' | 'style' | 'chat'>(
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

  const handleMobileTabChange = (tab: 'character' | 'scene' | 'style' | 'chat') => {
    if (tab === 'chat') {
      // Chat removed, maybe show toast or ignore
    } else {
      setMobileActiveTab(tab);
      setActiveTab(tab);
    }
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
    <div
      className={`w-full mx-auto animate-fadeIn ${viewMode === 'storymap' ? 'h-dvh flex flex-col overflow-x-hidden overflow-y-auto lg:overflow-hidden' : 'max-w-[1800px] p-3 md:p-6 pb-20 md:pb-24'}`}
    >
      {/* Header with Mode Switcher */}
      <div
        className={`relative text-center mb-4 md:mb-6 shrink-0 ${viewMode === 'storymap' ? 'px-2 sm:px-4 md:px-8 pt-2 md:pt-4' : 'px-10 sm:px-12 md:px-20'}`}
      >
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 rounded-full text-cocoa-light hover:text-coral-burst hover:bg-cream-soft z-10 min-h-11 min-w-11"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        )}

        {/* Right Side Actions - Notifications, Go Live */}
        <div className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          {/* Notification Bell Button */}
          <Button
            ref={notificationBtnRef}
            variant="ghost"
            size="icon"
            onClick={() => userProfile && setShowNotificationCenter(!showNotificationCenter)}
            className={`relative p-2 border border-peach-soft/50 min-h-11 min-w-11 ${userProfile ? 'bg-surface/80 hover:bg-surface text-cocoa-light hover:text-coral-burst' : 'bg-peach-soft/30 text-cocoa-light/60'}`}
            title={userProfile ? 'Notifications' : 'Login to access notifications'}
          >
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
          </Button>

          {/* Go Live Button - Always visible if user is logged in */}
          <Button
            variant="destructive"
            onClick={() => userProfile && setShowBroadcastStudio(true)}
            className={`hidden xs:flex px-2 md:px-4 py-2 border border-white/20 min-h-11 ${userProfile ? 'bg-linear-to-r from-red-500 to-pink-500 text-white hover:scale-105 active:scale-95' : 'bg-peach-light/50 text-cocoa-light/60'}`}
            disabled={!userProfile}
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline">Live</span>
          </Button>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex bg-cream-soft p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-peach-soft/50">
          <Button
            variant="ghost"
            onClick={() => setViewMode('individual')}
            className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 font-heading flex min-h-10 ${
              viewMode === 'individual'
                ? 'bg-surface text-coral-burst border border-peach-soft'
                : 'text-cocoa-light hover:text-charcoal-soft border border-transparent'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden xs:inline">Individual</span>
            <span className="xs:hidden">Solo</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setViewMode('storymap')}
            className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 font-heading flex min-h-10 ${
              viewMode === 'storymap'
                ? 'bg-surface text-emerald-500 border border-peach-soft'
                : 'text-cocoa-light hover:text-charcoal-soft border border-transparent'
            }`}
          >
            <Map className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden xs:inline">Story Map</span>
            <span className="xs:hidden">Map</span>
          </Button>
        </div>

        <p className="text-cocoa-light font-body text-xs sm:text-sm mt-2 md:mt-3 px-2 line-clamp-2">
          {viewMode === 'individual'
            ? 'Fine-tune characters, compose scenes, and experiment with style alchemy.'
            : 'Visualize your narrative journey and structure.'}
        </p>
      </div>

      <div
        className={`flex flex-col gap-4 md:gap-6 ${viewMode === 'storymap' ? 'flex-1 overflow-hidden' : 'min-h-[600px]'}`}
      >
        {/* Individual Mode Content */}
        {viewMode === 'individual' && (
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            {/* Control Panel - Left Side (40%) */}
            <div className="bg-surface rounded-3xl border border-peach-soft overflow-y-auto transition-all duration-500 ease-in-out z-20 w-full lg:w-2/5 p-4 md:p-6 max-h-125 lg:max-h-[680px] panel-breathing">
              {/* Tabs */}
              <div className="flex bg-cream-soft p-1.5 rounded-2xl mb-6 md:mb-8 border border-peach-soft/50">
                {['character', 'scene', 'style'].map((tab) => (
                  <Button
                    key={tab}
                    variant="ghost"
                    onClick={() => {
                      setActiveTab(tab as 'character' | 'scene' | 'style');
                      setSettings(prev => ({ ...prev, generatedImage: null }));
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
                      <Label className="text-xs text-cocoa-light uppercase">
                        Select Character
                      </Label>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleCreateNewCharacter}
                        className="flex px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                        title="Create new character"
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
                                            ${
                                              settings.selectedCharacterId === char.id
                                                ? 'border-coral-burst bg-cream-base'
                                                : 'border-transparent hover:bg-surface/50'
                                            }`}
                        >
                          <div
                            onClick={() =>
                              setSettings(prev => ({ ...prev, selectedCharacterId: char.id }))
                            }
                            className="flex items-center gap-2 md:gap-3"
                          >
                            <img
                              src={
                                char.imageUrl ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`
                              }
                              alt={char.name}
                              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface border border-peach-soft/50 object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs md:text-sm text-charcoal-soft truncate">
                                {char.name}
                              </div>
                              <div className="text-[10px] md:text-xs text-cocoa-light truncate">
                                {char.role || 'Character'}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCharacterId(char.id);
                              setShowCharacterDepth(true);
                            }}
                            className="absolute top-1 right-1 p-1 bg-surface hover:bg-emerald-50 opacity-0 group-hover:opacity-100 border border-peach-soft/50"
                            title="Edit character depth"
                          >
                            <Edit2 className="w-3 h-3 text-emerald-600" />
                          </Button>
                        </div>
                      ))}
                      {availableCharacters.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-cocoa-light/60 text-sm">
                          No characters yet. Click "New" to create one!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-cocoa-light uppercase">
                      Expression & Pose
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={settings.expression} onValueChange={(v) => setSettings(prev => ({ ...prev, expression: v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Expression" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="happy">Happy</SelectItem>
                          <SelectItem value="sad">Sad</SelectItem>
                          <SelectItem value="angry">Angry</SelectItem>
                          <SelectItem value="surprised">Surprised</SelectItem>
                          <SelectItem value="determined">Determined</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={settings.pose} onValueChange={(v) => setSettings(prev => ({ ...prev, pose: v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standing">Standing</SelectItem>
                          <SelectItem value="sitting">Sitting</SelectItem>
                          <SelectItem value="walking">Walking</SelectItem>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="fighting">Fighting</SelectItem>
                          <SelectItem value="flying">Flying</SelectItem>
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
                    <Label className="text-xs text-cocoa-light uppercase">
                      Lighting & Angle
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={settings.lighting} onValueChange={(v) => setSettings(prev => ({ ...prev, lighting: v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Lighting" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="natural">Natural Light</SelectItem>
                          <SelectItem value="golden-hour">Golden Hour</SelectItem>
                          <SelectItem value="night">Night / Dark</SelectItem>
                          <SelectItem value="studio">Studio Lighting</SelectItem>
                          <SelectItem value="neon">Neon / Cyberpunk</SelectItem>
                          <SelectItem value="dramatic">Dramatic Shadows</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={settings.cameraAngle} onValueChange={(v) => setSettings(prev => ({ ...prev, cameraAngle: v }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Camera angle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eye-level">Eye Level</SelectItem>
                          <SelectItem value="low-angle">Low Angle</SelectItem>
                          <SelectItem value="high-angle">High Angle</SelectItem>
                          <SelectItem value="wide-shot">Wide Shot</SelectItem>
                          <SelectItem value="close-up">Close Up</SelectItem>
                          <SelectItem value="aerial">Aerial View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-cocoa-light uppercase">
                      Scene Description
                    </Label>
                    <Textarea
                      value={settings.prompt}
                      onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                      className="h-24 md:h-32 bg-cream-base p-2.5 md:p-3 md:text-base"
                      placeholder="Describe the setting, props, and atmosphere..."
                    />
                  </div>
                </div>
              )}

              {/* Tab Content: Style Alchemy */}
              {activeTab === 'style' && (
                <div className="space-y-4 md:space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <Label className="text-xs text-cocoa-light uppercase flex items-center gap-2">
                      <Palette className="w-4 h-4" /> Style Alchemy
                    </Label>
                    <div className="bg-cream-base border border-peach-soft rounded-2xl p-3 md:p-4 space-y-3 md:space-y-4">
                      <div>
                        <div className="text-xs text-cocoa-light mb-1">
                          Primary Style ({settings.mixRatio}%)
                        </div>
                        <Select value={settings.styleA} onValueChange={(v) => setSettings(prev => ({ ...prev, styleA: v as ArtStyle }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Primary style" />
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
                            setSettings(prev => ({ ...prev, mixRatio: Number.parseInt(e.target.value) }))
                          }
                          title={`Mix ratio: ${settings.mixRatio}%`}
                          aria-label="Style mix ratio"
                          className="w-full accent-coral-burst h-1.5 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-cocoa-light mb-1">
                          Secondary Style ({100 - settings.mixRatio}%)
                        </div>
                        <Select value={settings.styleB} onValueChange={(v) => setSettings(prev => ({ ...prev, styleB: v as ArtStyle }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Secondary style" />
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
                    <Label className="text-xs text-cocoa-light uppercase">
                      Test Prompt
                    </Label>
                    <Textarea
                      value={settings.prompt}
                      onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                      className="h-20 md:h-24 bg-cream-base p-2.5 md:p-3 md:text-base"
                      placeholder="A landscape with a castle..."
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
                  <Wand2 className="w-4 h-4 md:w-5 md:h-5" />
                )}
                {activeTab === 'character' ? 'Generate' : activeTab === 'scene' ? 'Render' : 'Mix'}
              </Button>
            </div>

            {/* Preview Panel - Right Side (60%) */}
            <div className="w-full lg:w-3/5 h-100 lg:h-[680px] bg-surface rounded-3xl border border-peach-soft overflow-hidden relative group">
              {settings.generatedImage ? (
                <>
                  <img
                    src={settings.generatedImage}
                    alt="Generated result"
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
                        <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-coral-burst animate-pulse" />
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
                        <Wand2 className="w-10 h-10 text-coral-burst/50" />
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
        )}

        {/* Story Map Mode */}
        {viewMode === 'storymap' &&
          (project ? (
            <StoryMap
              project={project}
              onNavigateToEditor={() => onNavigate?.(AppMode.EDITOR)}
              onClose={() => setViewMode('individual')}
              onUpdateProject={onUpdateProject}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Map className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-600 mb-2">No Project Loaded</h3>
              <p className="text-slate-500 max-w-md">
                Please open a project from the Dashboard to view its Story Map.
              </p>
              <Button
                variant="primary"
                onClick={onBack}
                className="mt-6"
              >
                Go to Dashboard
              </Button>
            </div>
          ))}
      </div>

      {/* Notification Center Modal */}
      {showNotificationCenter && userProfile && (
        <NotificationCenter
          isOpen={showNotificationCenter}
          onClose={() => setShowNotificationCenter(false)}
          anchorRef={notificationBtnRef}
        />
      )}

      {/* Broadcast Studio Modal */}
      {showBroadcastStudio && userProfile && (
        <div className="fixed inset-0 bg-black/50  z-70 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden animate-fadeIn flex flex-col">
            <BroadcastStudio onClose={() => setShowBroadcastStudio(false)} />
          </div>
        </div>
      )}

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
      <MobileBottomNav
        activeTab={mobileActiveTab}
        onTabChange={handleMobileTabChange}
        unreadCount={unreadCount}
      />
    </div>
  );
};

export default VisualStudio;
