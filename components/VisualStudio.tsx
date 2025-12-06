import React, { useState, useEffect, useRef } from 'react';
import { ArtStyle, BookProject, VisualSettings, Character, AppMode } from '../types';
import {
    Wand2,
    Palette,
    Sparkles,
    RefreshCw,
    Sliders,
    ArrowLeft,
    Maximize2,
    Share2,
    Map,
    Radio,
    Bell,
    Download,
    Plus,
    Edit2
} from 'lucide-react';
import { generateRefinedImage } from '../services/geminiService';
import StoryMap from './StoryMap';
import MobileBottomNav from './MobileBottomNav';
import CharacterDepthPanel from './CharacterDepthPanel';
import { UserProfile } from '../services/profileService';
import {
    BroadcastStudio,
    NotificationCenter
} from './collaboration';

interface VisualStudioProps {
    project: BookProject | null;
    onBack?: () => void;
    userProfile: UserProfile | null;
    onNavigate?: (mode: AppMode) => void;
    onUpdateProject?: (project: BookProject) => void;
}

const VisualStudio: React.FC<VisualStudioProps> = ({ project, onBack, userProfile, onNavigate, onUpdateProject }) => {
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
        costume: 'default'
    });

    // UI State
    const [showShareModal, setShowShareModal] = useState(false);
    const [expandedVisual, setExpandedVisual] = useState<'current' | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileActiveTab, setMobileActiveTab] = useState<'character' | 'scene' | 'style' | 'chat'>('character');

    // Styles list
    const styles = Object.values(ArtStyle);

    // Available characters (Project + Defaults)
    const availableCharacters = project?.characters || [];

    // Handle generation
    const handleGenerate = async () => {
        if (!settings.prompt && !settings.selectedCharacterId) {
            alert('Please enter a prompt or select a character');
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
                 const character = availableCharacters.find(c => c.id === settings.selectedCharacterId);
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
                setSettings(prev => ({ ...prev, generatedImage: result }));
            }
        } catch (error) {
            console.error('Generation failed:', error);
            alert('Failed to generate image. Please try again.');
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
                neuroticism: 50
            }
        };

        const updatedProject = {
            ...project,
            characters: [...(project.characters || []), newCharacter]
        };

        onUpdateProject(updatedProject);
        setEditingCharacterId(newCharacter.id);
        setShowCharacterDepth(true);
    };

    const handleUpdateCharacter = (updatedCharacter: Character) => {
        if (!project || !onUpdateProject) return;

        const updatedProject = {
            ...project,
            characters: project.characters.map(c => 
                c.id === updatedCharacter.id ? updatedCharacter : c
            )
        };

        onUpdateProject(updatedProject);
        setShowCharacterDepth(false);
        setEditingCharacterId(null);
    };

    const editingCharacter = editingCharacterId 
        ? availableCharacters.find(c => c.id === editingCharacterId)
        : null;

    return (
        <div className={`w-full mx-auto animate-fadeIn ${viewMode === 'storymap' ? 'h-[100dvh] flex flex-col overflow-hidden' : 'max-w-[1800px] p-3 md:p-6 pb-20 md:pb-24'}`}>

            {/* Header with Mode Switcher */}
            <div className={`relative text-center mb-4 md:mb-6 flex-shrink-0 ${viewMode === 'storymap' ? 'px-2 sm:px-4 md:px-8 pt-2 md:pt-4' : 'px-10 sm:px-12 md:px-20'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                )}

                {/* Right Side Actions - Notifications, Go Live */}
                <div className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    {/* Notification Bell Button */}
                    <button
                        ref={notificationBtnRef}
                        onClick={() => userProfile && setShowNotificationCenter(!showNotificationCenter)}
                        className={`relative p-2 rounded-xl transition-all shadow-sm border border-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${userProfile ? 'bg-white/80 hover:bg-white text-gray-600 hover:text-coral-burst' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        title={userProfile ? "Notifications" : "Login to access notifications"}
                    >
                        <Bell className="w-4 h-4 md:w-5 md:h-5" />
                    </button>

                    {/* Go Live Button - Always visible if user is logged in */}
                    <button
                        onClick={() => userProfile && setShowBroadcastStudio(true)}
                        className={`hidden xs:flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-transform shadow-lg min-h-[44px] ${userProfile ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        disabled={!userProfile}
                    >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span className="hidden sm:inline">Live</span>
                    </button>
                </div>

                {/* Mode Switcher */}
                <div className="inline-flex bg-cream-soft p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-peach-soft/50 shadow-sm">
                    <button
                        onClick={() => setViewMode('individual')}
                        className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5 md:gap-2 transition-all min-h-[40px] ${viewMode === 'individual'
                            ? 'bg-white text-coral-burst shadow-sm'
                            : 'text-cocoa-light hover:text-charcoal-soft'
                            }`}
                    >
                        <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden xs:inline">Individual</span>
                        <span className="xs:hidden">Solo</span>
                    </button>
                    <button
                        onClick={() => setViewMode('storymap')}
                        className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5 md:gap-2 transition-all min-h-[40px] ${viewMode === 'storymap'
                            ? 'bg-white text-emerald-500 shadow-sm'
                            : 'text-cocoa-light hover:text-charcoal-soft'
                            }`}
                    >
                        <Map className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden xs:inline">Story Map</span>
                        <span className="xs:hidden">Map</span>
                    </button>
                </div>

                <p className="text-cocoa-light font-body text-xs sm:text-sm mt-2 md:mt-3 px-2 line-clamp-2">
                    {viewMode === 'individual'
                        ? 'Fine-tune characters, compose scenes, and experiment with style alchemy.'
                        : 'Visualize your narrative journey and structure.'}
                </p>
            </div>

            <div className={`flex flex-col gap-4 md:gap-6 ${viewMode === 'storymap' ? 'flex-1 overflow-hidden' : 'min-h-[600px]'}`}>

                {/* Individual Mode Content */}
                {viewMode === 'individual' && (
                    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                        {/* Control Panel - Left Side (40%) */}
                        <div
                            className="bg-white rounded-3xl shadow-soft-lg border border-white overflow-y-auto transition-all duration-500 ease-in-out z-20 w-full lg:w-2/5 p-4 md:p-6 max-h-[500px] lg:max-h-[680px] panel-breathing"
                        >
                            {/* Tabs */}
                            <div className="flex bg-cream-soft p-1.5 rounded-2xl mb-6 md:mb-8 border border-peach-soft/50">
                                {['character', 'scene', 'style'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab as any);
                                            setSettings({ ...settings, generatedImage: null });
                                        }}
                                        className={`flex-1 py-2 md:py-2.5 rounded-xl font-heading font-bold text-xs md:text-sm capitalize transition-all
                                ${activeTab === tab ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light hover:text-charcoal-soft'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content: Character */}
                            {activeTab === 'character' && (
                                <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-cocoa-light uppercase">Select Character</label>
                                            <button
                                                onClick={handleCreateNewCharacter}
                                                className="flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-xs font-bold"
                                                title="Create new character"
                                            >
                                                <Plus className="w-3 h-3" />
                                                New
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 md:gap-3 max-h-[200px] md:max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                            {availableCharacters.map(char => (
                                                <div
                                                    key={char.id}
                                                    className={`p-2 rounded-xl border-2 cursor-pointer transition-all relative group
                                            ${settings.selectedCharacterId === char.id
                                                            ? 'border-coral-burst bg-cream-base shadow-sm'
                                                            : 'border-transparent hover:bg-gray-50'}`}
                                                >
                                                    <div 
                                                        onClick={() => setSettings({ ...settings, selectedCharacterId: char.id })}
                                                        className="flex items-center gap-2 md:gap-3"
                                                    >
                                                        <img
                                                            src={char.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`}
                                                            alt={char.name}
                                                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white shadow-sm object-cover"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-bold text-xs md:text-sm text-charcoal-soft truncate">{char.name}</div>
                                                            <div className="text-[10px] md:text-xs text-cocoa-light truncate">{char.role || 'Character'}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCharacterId(char.id);
                                                            setShowCharacterDepth(true);
                                                        }}
                                                        className="absolute top-1 right-1 p-1 bg-white hover:bg-emerald-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                        title="Edit character depth"
                                                    >
                                                        <Edit2 className="w-3 h-3 text-emerald-600" />
                                                    </button>
                                                </div>
                                            ))}
                                            {availableCharacters.length === 0 && (
                                                <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                                                    No characters yet. Click "New" to create one!
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Expression & Pose</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={settings.expression}
                                                onChange={(e) => setSettings({ ...settings, expression: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2 text-xs md:text-sm outline-none focus:border-coral-burst"
                                            >
                                                <option value="neutral">Neutral</option>
                                                <option value="happy">Happy</option>
                                                <option value="sad">Sad</option>
                                                <option value="angry">Angry</option>
                                                <option value="surprised">Surprised</option>
                                                <option value="determined">Determined</option>
                                            </select>
                                            <select
                                                value={settings.pose}
                                                onChange={(e) => setSettings({ ...settings, pose: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2 text-xs md:text-sm outline-none focus:border-coral-burst"
                                            >
                                                <option value="standing">Standing</option>
                                                <option value="sitting">Sitting</option>
                                                <option value="walking">Walking</option>
                                                <option value="running">Running</option>
                                                <option value="fighting">Fighting</option>
                                                <option value="flying">Flying</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab Content: Scene */}
                            {activeTab === 'scene' && (
                                <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Lighting & Angle</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={settings.lighting}
                                                onChange={(e) => setSettings({ ...settings, lighting: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2 text-xs md:text-sm outline-none focus:border-coral-burst"
                                            >
                                                <option value="natural">Natural Light</option>
                                                <option value="golden-hour">Golden Hour</option>
                                                <option value="night">Night / Dark</option>
                                                <option value="studio">Studio Lighting</option>
                                                <option value="neon">Neon / Cyberpunk</option>
                                                <option value="dramatic">Dramatic Shadows</option>
                                            </select>
                                            <select
                                                value={settings.cameraAngle}
                                                onChange={(e) => setSettings({ ...settings, cameraAngle: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2 text-xs md:text-sm outline-none focus:border-coral-burst"
                                            >
                                                <option value="eye-level">Eye Level</option>
                                                <option value="low-angle">Low Angle</option>
                                                <option value="high-angle">High Angle</option>
                                                <option value="wide-shot">Wide Shot</option>
                                                <option value="close-up">Close Up</option>
                                                <option value="aerial">Aerial View</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Scene Description</label>
                                        <textarea
                                            value={settings.prompt}
                                            onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
                                            className="w-full h-24 md:h-32 bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                            placeholder="Describe the setting, props, and atmosphere..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Tab Content: Style Alchemy */}
                            {activeTab === 'style' && (
                                <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                            <Palette className="w-4 h-4" /> Style Alchemy
                                        </label>
                                        <div className="bg-cream-base border border-peach-soft rounded-2xl p-3 md:p-4 space-y-3 md:space-y-4">
                                            <div>
                                                <div className="text-xs text-cocoa-light mb-1">Primary Style ({(settings.mixRatio)}%)</div>
                                                <select
                                                    value={settings.styleA}
                                                    onChange={(e) => setSettings({ ...settings, styleA: e.target.value as ArtStyle })}
                                                    className="w-full bg-white border border-peach-soft rounded-xl p-2 text-xs md:text-sm"
                                                    title="Select primary style"
                                                    aria-label="Primary style"
                                                >
                                                    {styles.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <Sliders className="text-coral-burst w-4 h-4" />
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={settings.mixRatio}
                                                    onChange={(e) => setSettings({ ...settings, mixRatio: parseInt(e.target.value) })}
                                                    title={`Mix ratio: ${settings.mixRatio}%`}
                                                    aria-label="Style mix ratio"
                                                    className="w-full accent-coral-burst h-1.5 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>

                                            <div>
                                                <div className="text-xs text-cocoa-light mb-1">Secondary Style ({100 - settings.mixRatio}%)</div>
                                                <select
                                                    value={settings.styleB}
                                                    onChange={(e) => setSettings({ ...settings, styleB: e.target.value as ArtStyle })}
                                                    className="w-full bg-white border border-peach-soft rounded-xl p-2 text-xs md:text-sm"
                                                    title="Select secondary style"
                                                    aria-label="Secondary style"
                                                >
                                                    {styles.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Test Prompt</label>
                                        <textarea
                                            value={settings.prompt}
                                            onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
                                            className="w-full h-20 md:h-24 bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                            placeholder="A landscape with a castle..."
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className={`w-full mt-4 py-3 md:py-4 rounded-xl font-heading font-bold text-sm md:text-base text-white shadow-lg transition-all flex items-center justify-center gap-2
                            ${isGenerating ? 'bg-cocoa-light cursor-not-allowed' : 'bg-gradient-to-r from-coral-burst to-gold-sunshine hover:scale-[1.02]'}`}
                            >
                                {isGenerating ? <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Wand2 className="w-4 h-4 md:w-5 md:h-5" />}
                                {activeTab === 'character' ? 'Generate' : activeTab === 'scene' ? 'Render' : 'Mix'}
                            </button>
                        </div>

                        {/* Preview Panel - Right Side (60%) */}
                        <div className="w-full lg:w-3/5 h-[400px] lg:h-[680px] bg-white rounded-3xl shadow-soft-lg border border-white overflow-hidden relative group">
                            {settings.generatedImage ? (
                                <>
                                    <img
                                        src={settings.generatedImage}
                                        alt="Generated result"
                                        className="w-full h-full object-contain bg-gray-50"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowShareModal(true)}
                                                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                                                title="Share"
                                            >
                                                <Share2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = settings.generatedImage!;
                                                    link.download = `genesis-${Date.now()}.png`;
                                                    link.click();
                                                }}
                                                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setExpandedVisual('current')}
                                            className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                                            title="Expand"
                                        >
                                            <Maximize2 className="w-5 h-5" />
                                        </button>
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
                                            <p className="font-heading font-bold text-xl text-charcoal-soft animate-pulse">Dreaming...</p>
                                            <p className="text-sm max-w-xs">Our AI is painting your imagination. This usually takes 10-15 seconds.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 opacity-60">
                                            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-2">
                                                <Wand2 className="w-10 h-10 text-coral-burst/50" />
                                            </div>
                                            <div>
                                                <p className="text-charcoal-soft font-heading font-bold text-lg">Ready to Create</p>
                                                <p className="text-cocoa-light text-sm mt-1">Configure your settings above and click Generate</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Story Map Mode */}
                {viewMode === 'storymap' && (
                    project ? (
                        <StoryMap 
                            project={project}
                            onNavigateToEditor={() => onNavigate?.(AppMode.EDITOR)}
                            onClose={() => setViewMode('individual')}
                            onUpdateProject={onUpdateProject}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <Map className="w-16 h-16 text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-600 mb-2">No Project Loaded</h3>
                            <p className="text-slate-500 max-w-md">
                                Please open a project from the Dashboard to view its Story Map.
                            </p>
                            <button 
                                onClick={onBack}
                                className="mt-6 px-6 py-2 bg-coral-burst text-white rounded-xl font-bold hover:bg-coral-burst/90 transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )
                )}

            </div>

            {/* Notification Center Modal */}
            {
                showNotificationCenter && userProfile && (
                    <NotificationCenter
                        isOpen={showNotificationCenter}
                        onClose={() => setShowNotificationCenter(false)}
                        anchorRef={notificationBtnRef}
                    />
                )
            }

            {/* Broadcast Studio Modal */}
            {
                showBroadcastStudio && userProfile && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden animate-fadeIn flex flex-col">
                            <BroadcastStudio
                                onClose={() => setShowBroadcastStudio(false)}
                            />
                        </div>
                    </div>
                )
            }

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
        </div >
    );
};

export default VisualStudio;
