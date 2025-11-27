import React, { useState, useEffect } from 'react';
import { ArtStyle, BookProject, VisualSettings } from '../types';
import {
    Wand2,
    Users,
    Camera,
    Palette,
    Sparkles,
    Download,
    RefreshCw,
    Sliders,
    Sun,
    Move,
    Lightbulb,
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Maximize2,
    Minimize2,
    X,
    LogOut
} from 'lucide-react';
import { generateRefinedImage } from '../services/geminiService';
import MessagesWidget from './MessagesWidget';

interface VisualStudioProps {
    project: BookProject | null;
    onBack?: () => void;
}

interface Collaborator {
    id: string;
    name: string;
    avatar: string;
    status: 'idle' | 'typing' | 'generating' | 'done';
    image?: string;
    prompt?: string;
}

const VisualStudio: React.FC<VisualStudioProps> = ({ project, onBack }) => {
    const [activeTab, setActiveTab] = useState<'character' | 'scene' | 'style'>('character');
    const [isGenerating, setIsGenerating] = useState(false);

    // Collaborative Mode State
    const [isCollaborativeMode, setIsCollaborativeMode] = useState(false);
    const [isMenuExpanded, setIsMenuExpanded] = useState(false);
    const [expandedVisual, setExpandedVisual] = useState<Collaborator | 'current' | null>(null);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([
        { id: 'u1', name: 'Sarah Art', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', status: 'idle' },
        { id: 'u2', name: 'Alex Dev', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', status: 'idle' },
        { id: 'u3', name: 'Maya Writer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya', status: 'idle' },
        { id: 'u4', name: 'Jordan', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', status: 'idle' }
    ]);

    const [settings, setSettings] = useState<VisualSettings>({
        activeTab: 'character',
        selectedCharacterId: project?.characters?.[0]?.id || null,
        expression: 'Neutral',
        pose: 'Standing',
        costume: 'Default Outfit',
        lighting: 'Natural Daylight',
        cameraAngle: 'Eye Level',
        styleA: project?.style || ArtStyle.PIXAR_3D,
        styleB: ArtStyle.WATERCOLOR,
        mixRatio: 50,
        prompt: 'A quiet morning in the village.',
        generatedImage: null
    });

    const styles = Object.values(ArtStyle);

    // Presets
    const lightingGroups = {
        'Natural': ['Natural Daylight', 'Golden Hour', 'Soft Candlelight', 'Ethereal Moonlight', 'Overcast Sky'],
        'Cinematic': ['Cinematic Noir', 'Teal & Orange', 'Rembrandt', 'Dramatic Shadows', 'God Rays'],
        'Artificial': ['Neon Cyberpunk', 'Studio High-Key', 'Bioluminescent', 'Hard Flash', 'Stage Lighting'],
        'Artistic': ['Volumetric Fog', 'Silhouette', 'Dreamy Haze', 'Double Exposure']
    };

    const cameraOptions = ['Eye Level', 'Bird\'s Eye View', 'Worm\'s Eye View', 'Dutch Angle', 'Macro Close-up', 'Wide Angle', 'Over-the-shoulder'];
    const expressions = ['Neutral', 'Happy', 'Sad', 'Angry', 'Surprised', 'Determined', 'Fearful', 'Mischievous'];
    const poses = ['Standing', 'Sitting', 'Running', 'Jumping', 'Thinking', 'Fighting Stance', 'Dancing', 'Floating'];

    const handleGenerate = async () => {
        console.log("🎨 Render Scene clicked! Starting generation...");
        setIsGenerating(true);

        let promptToUse = settings.prompt;
        let charDesc = "";

        // Add character context if available
        if (activeTab === 'character' && settings.selectedCharacterId && project) {
            const char = project.characters.find(c => c.id === settings.selectedCharacterId);
            if (char) {
                charDesc = `${char.name}: ${char.description}. Visual traits: ${char.visualTraits}. Wearing ${settings.costume}. Expression: ${settings.expression}. Pose: ${settings.pose}.`;
                promptToUse = `Full body character design sheet of ${char.name}`;
            }
        } else if (activeTab === 'scene') {
            promptToUse = settings.prompt;
        } else {
            // Style alchemy uses the prompt directly
        }

        try {
            const result = await generateRefinedImage(promptToUse, {
                styleA: activeTab === 'style' ? settings.styleA : (project?.style || settings.styleA),
                styleB: activeTab === 'style' ? settings.styleB : undefined,
                mixRatio: activeTab === 'style' ? settings.mixRatio : undefined,
                lighting: settings.lighting,
                camera: settings.cameraAngle,
                characterDescription: charDesc
            });
            setSettings({ ...settings, generatedImage: result });
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAsset = () => {
        if (!settings.generatedImage) return;

        // Create a temporary link element to trigger download
        const link = document.createElement('a');
        link.href = settings.generatedImage;

        // Generate filename based on active tab and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const tabName = activeTab === 'character' ? 'character' : activeTab === 'scene' ? 'scene' : 'style-mix';
        link.download = `genesis-${tabName}-${timestamp}.png`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Asset saved successfully');
    };

    const handleCollaborationStart = () => {
        setIsCollaborativeMode(true);
        setIsMenuExpanded(true);

        // Simulate other users starting to work
        setTimeout(() => {
            setCollaborators(prev => prev.map(c => ({ ...c, status: 'typing' })));
        }, 2000);

        setTimeout(() => {
            setCollaborators(prev => prev.map((c, i) => i % 2 === 0 ? { ...c, status: 'generating' } : c));
        }, 5000);

        setTimeout(() => {
            setCollaborators(prev => prev.map((c, i) => i % 2 === 0 ? {
                ...c,
                status: 'done',
                image: `https://picsum.photos/seed/${c.id}/800/800`
            } : { ...c, status: 'generating' }));
        }, 10000);

        setTimeout(() => {
            setCollaborators(prev => prev.map(c => c.status === 'generating' ? {
                ...c,
                status: 'done',
                image: `https://picsum.photos/seed/${c.id}/800/800`
            } : c));
        }, 15000);
    };

    const handleExitCollaboration = () => {
        setIsCollaborativeMode(false);
        setCollaborators(prev => prev.map(c => ({ ...c, status: 'idle', image: undefined })));
        setExpandedVisual(null);
    };

    return (
        <div className={`w-full mx-auto animate-fadeIn ${isCollaborativeMode ? 'h-screen flex flex-col p-0' : 'max-w-[1800px] p-6 pb-24'}`}>

            {/* Header */}
            <div className={`relative text-center ${isCollaborativeMode ? 'py-4 px-6 bg-white border-b border-gray-200' : 'mb-6'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                )}
                <h1 className="font-heading font-bold text-3xl md:text-4xl text-charcoal-soft mb-2 flex items-center justify-center gap-3">
                    <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-gold-sunshine" />
                    Visual Studio
                    {isCollaborativeMode && <span className="text-xs md:text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 md:px-3 py-1 rounded-full ml-2">Collaborative</span>}
                </h1>
                {!isCollaborativeMode && (
                    <p className="text-cocoa-light font-body text-sm md:text-base">
                        Fine-tune characters, compose scenes, and experiment with style alchemy.
                    </p>
                )}

                {/* Exit Collaborative Mode Button */}
                {isCollaborativeMode && (
                    <button
                        onClick={handleExitCollaboration}
                        className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-bold text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Exit Mode</span>
                    </button>
                )}
            </div>

            <div className={`flex flex-col lg:flex-row gap-4 md:gap-6 ${isCollaborativeMode ? 'flex-1 overflow-hidden' : 'min-h-[600px] h-[calc(100vh-140px)]'}`}>

                {/* Control Panel / Vertical Menu */}
                <div
                    className={`
                        bg-white rounded-3xl shadow-soft-lg border border-white overflow-y-auto transition-all duration-500 ease-in-out z-20
                        ${isCollaborativeMode
                            ? isMenuExpanded
                                ? 'w-full lg:w-80 xl:w-96 p-4 md:p-6 h-full'
                                : 'w-16 md:w-20 flex flex-col items-center p-3 h-full'
                            : 'w-full lg:w-1/3 p-4 md:p-6 h-full'}
                    `}
                >
                    {isCollaborativeMode && !isMenuExpanded ? (
                        // Collapsed Vertical Menu
                        <div className="flex flex-col gap-4 md:gap-6 items-center mt-4">
                            <button onClick={() => setIsMenuExpanded(true)} className="p-2 rounded-full hover:bg-gray-100 mb-4">
                                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                            </button>
                            <button
                                onClick={() => setActiveTab('character')}
                                className={`p-2.5 md:p-3 rounded-xl transition-all ${activeTab === 'character' ? 'bg-coral-burst text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Character"
                            >
                                <Users className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button
                                onClick={() => setActiveTab('scene')}
                                className={`p-2.5 md:p-3 rounded-xl transition-all ${activeTab === 'scene' ? 'bg-coral-burst text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Scene"
                            >
                                <Camera className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button
                                onClick={() => setActiveTab('style')}
                                className={`p-2.5 md:p-3 rounded-xl transition-all ${activeTab === 'style' ? 'bg-coral-burst text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Style"
                            >
                                <Palette className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    ) : (
                        // Full Control Panel
                        <>
                            {isCollaborativeMode && (
                                <button onClick={() => setIsMenuExpanded(false)} className="mb-4 p-2 rounded-full hover:bg-gray-100 self-start">
                                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                                </button>
                            )}

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
                                        <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                            <Users className="w-4 h-4" /> Character
                                        </label>
                                        {project?.characters.length ? (
                                            <select
                                                value={settings.selectedCharacterId || ''}
                                                onChange={(e) => setSettings({ ...settings, selectedCharacterId: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none"
                                            >
                                                {project.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        ) : (
                                            <div className="p-3 bg-yellow-butter/20 rounded-xl text-sm text-cocoa-light italic">
                                                No characters found in current project.
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-cocoa-light uppercase">Expression</label>
                                            <select
                                                value={settings.expression}
                                                onChange={(e) => setSettings({ ...settings, expression: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                            >
                                                {expressions.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-cocoa-light uppercase">Pose</label>
                                            <select
                                                value={settings.pose}
                                                onChange={(e) => setSettings({ ...settings, pose: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                            >
                                                {poses.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Costume Details</label>
                                        <input
                                            type="text"
                                            value={settings.costume}
                                            onChange={(e) => setSettings({ ...settings, costume: e.target.value })}
                                            className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none"
                                            placeholder="e.g. Red superhero cape"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Tab Content: Scene */}
                            {activeTab === 'scene' && (
                                <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" /> Lighting Style
                                        </label>
                                        <div className="grid grid-cols-1 gap-3 md:gap-4">
                                            <select
                                                value={settings.lighting}
                                                onChange={(e) => setSettings({ ...settings, lighting: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-body"
                                            >
                                                {Object.entries(lightingGroups).map(([group, options]) => (
                                                    <optgroup key={group} label={group}>
                                                        {options.map(l => <option key={l} value={l}>{l}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                                    <Camera className="w-4 h-4" /> Camera Angle
                                                </label>
                                                <select
                                                    value={settings.cameraAngle}
                                                    onChange={(e) => setSettings({ ...settings, cameraAngle: e.target.value })}
                                                    className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                                >
                                                    {cameraOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
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
                                                    className="w-full accent-coral-burst h-1.5 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>

                                            <div>
                                                <div className="text-xs text-cocoa-light mb-1">Secondary Style ({100 - settings.mixRatio}%)</div>
                                                <select
                                                    value={settings.styleB}
                                                    onChange={(e) => setSettings({ ...settings, styleB: e.target.value as ArtStyle })}
                                                    className="w-full bg-white border border-peach-soft rounded-xl p-2 text-xs md:text-sm"
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
                        </>
                    )}
                </div>

                {/* Preview Area / Collaborative Grid */}
                <div className={`
                    rounded-3xl overflow-hidden relative
                    ${isCollaborativeMode
                        ? 'flex-1 bg-white border-4 border-gray-200 shadow-2xl flex flex-col'
                        : 'w-full lg:w-2/3 bg-cream-base border-2 border-dashed border-peach-soft flex items-center justify-center group h-full min-h-[400px] md:min-h-[500px]'}
                `}>
                    {isCollaborativeMode ? (
                        <div className="w-full h-full flex flex-col overflow-hidden">
                            {/* Collaborative Box Header */}
                            <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
                                <h2 className="font-heading font-bold text-base md:text-xl text-charcoal-soft flex items-center gap-2">
                                    <Users className="w-4 h-4 md:w-5 md:h-5 text-coral-burst" />
                                    <span className="hidden sm:inline">Team Workspace</span>
                                    <span className="sm:hidden">Team</span>
                                </h2>
                                <span className="text-[10px] md:text-xs font-bold text-cocoa-light bg-white px-2 md:px-3 py-1 rounded-full shadow-sm">
                                    {collaborators.filter(c => c.status !== 'idle').length + (isGenerating ? 1 : 0)} Active
                                </span>
                            </div>

                            {/* Main Content Area with Grid */}
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                {/* Grid Container */}
                                <div className="flex-1 p-3 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 pb-24">
                                        {/* Current User Slot */}
                                        <div
                                            className="bg-white rounded-2xl shadow-md p-2 md:p-3 flex flex-col h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px] relative overflow-hidden border-2 border-coral-burst/50 hover:shadow-xl transition-all cursor-pointer group"
                                            onClick={() => settings.generatedImage && setExpandedVisual('current')}
                                        >
                                            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-coral-burst flex items-center justify-center text-white font-bold text-[10px] md:text-xs">YOU</div>
                                                <span className="font-bold text-xs md:text-sm text-charcoal-soft">You</span>
                                                {isGenerating && <span className="text-[10px] md:text-xs text-coral-burst animate-pulse ml-auto">Generating...</span>}
                                                {settings.generatedImage && <Maximize2 className="w-3 h-3 md:w-4 md:h-4 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative">
                                                {settings.generatedImage ? (
                                                    <img src={settings.generatedImage} alt="Your work" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        {isGenerating ? (
                                                            <Loader2 className="w-6 h-6 md:w-8 md:h-8 text-coral-burst animate-spin mx-auto" />
                                                        ) : (
                                                            <span className="text-gray-400 text-xs md:text-sm">Your canvas</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Collaborator Slots */}
                                        {collaborators.map(user => (
                                            <div
                                                key={user.id}
                                                className="bg-white rounded-2xl shadow-md p-2 md:p-3 flex flex-col h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px] relative overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                                                onClick={() => user.status === 'done' && user.image && setExpandedVisual(user)}
                                            >
                                                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                                    <img src={user.avatar} alt={user.name} className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-200" />
                                                    <span className="font-bold text-xs md:text-sm text-charcoal-soft truncate">{user.name}</span>
                                                    {user.status === 'typing' && <span className="text-[10px] md:text-xs text-gray-400 animate-pulse ml-auto">Typing...</span>}
                                                    {user.status === 'generating' && <span className="text-[10px] md:text-xs text-purple-500 animate-pulse ml-auto">Gen...</span>}
                                                    {user.status === 'done' && <Maximize2 className="w-3 h-3 md:w-4 md:h-4 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </div>
                                                <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative">
                                                    {user.status === 'done' && user.image ? (
                                                        <img src={user.image} alt={`${user.name}'s work`} className="w-full h-full object-cover animate-fadeIn transition-transform duration-500 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="text-center p-2 md:p-4">
                                                            {user.status === 'generating' ? (
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-purple-500 animate-spin" />
                                                                    <span className="text-[10px] md:text-xs text-purple-500">Creating...</span>
                                                                </div>
                                                            ) : user.status === 'typing' ? (
                                                                <div className="flex gap-1">
                                                                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                                                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                                                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 text-xs md:text-sm">Waiting...</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Visual Modal */}
                            {expandedVisual && (
                                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col animate-fadeIn p-4 md:p-6 rounded-3xl">
                                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                        <div className="flex items-center gap-2 md:gap-3">
                                            <button
                                                onClick={() => setExpandedVisual(null)}
                                                className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-50 transition-all mr-2 group z-50"
                                                title="Go Back"
                                            >
                                                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-charcoal-soft group-hover:-translate-x-1 transition-transform" />
                                                <span className="font-bold text-charcoal-soft text-xs md:text-sm">Back</span>
                                            </button>
                                            {expandedVisual === 'current' ? (
                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-coral-burst flex items-center justify-center text-white font-bold text-xs md:text-base">YOU</div>
                                            ) : (
                                                <img src={expandedVisual.avatar} alt="User" className="w-8 h-8 md:w-10 md:h-10 rounded-full" />
                                            )}
                                            <div>
                                                <h3 className="font-heading font-bold text-base md:text-xl text-charcoal-soft">
                                                    {expandedVisual === 'current' ? 'Your Creation' : `${expandedVisual.name}'s Creation`}
                                                </h3>
                                                <p className="text-xs md:text-sm text-cocoa-light">Full View</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setExpandedVisual(null)}
                                            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5 md:w-6 md:h-6 text-charcoal-soft" />
                                        </button>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden shadow-inner p-2 md:p-4">
                                        <img
                                            src={expandedVisual === 'current' ? settings.generatedImage! : (expandedVisual as Collaborator).image!}
                                            alt="Full view"
                                            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                                        />
                                    </div>
                                    <div className="mt-4 flex justify-end flex-shrink-0">
                                        <button
                                            onClick={() => {
                                                const imgUrl = expandedVisual === 'current' ? settings.generatedImage! : (expandedVisual as Collaborator).image!;
                                                const link = document.createElement('a');
                                                link.href = imgUrl;
                                                link.download = `genesis-collab-${Date.now()}.png`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                            className="bg-charcoal-soft text-white px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-sm md:text-base flex items-center gap-2 hover:bg-coral-burst transition-colors shadow-lg"
                                        >
                                            <Download className="w-4 h-4 md:w-5 md:h-5" /> Download
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Standard Single User Preview
                        settings.generatedImage ? (
                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                <img
                                    src={settings.generatedImage}
                                    alt="Generated Visual"
                                    className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
                                />
                                <button
                                    onClick={handleSaveAsset}
                                    className="absolute bottom-4 md:bottom-8 right-4 md:right-8 bg-white text-charcoal-soft px-3 md:px-4 py-2 rounded-full shadow-lg font-heading font-bold text-xs md:text-sm flex items-center gap-2 hover:text-coral-burst transition-colors"
                                >
                                    <Download className="w-3 h-3 md:w-4 md:h-4" /> Save
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-cocoa-light/50 p-4">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-peach-soft border-t-coral-burst rounded-full animate-spin"></div>
                                        <span className="font-heading font-bold text-base md:text-lg animate-pulse">Rendering...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-peach-soft/30 flex items-center justify-center mx-auto mb-4">
                                            {activeTab === 'character' && <Users className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                            {activeTab === 'scene' && <Camera className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                            {activeTab === 'style' && <Palette className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                        </div>
                                        <p className="font-heading font-bold text-lg md:text-xl">Ready to Create</p>
                                        <p className="text-xs md:text-sm mt-2 max-w-xs mx-auto">Adjust settings and click generate</p>
                                    </>
                                )}
                            </div>
                        )
                    )}
                </div>

            </div>
            {/* Floating Messages Widget - Always visible */}
            <MessagesWidget
                onCollaborationStart={handleCollaborationStart}
                onUserTyping={(isTyping) => { }}
            />
        </div>
    );
};

export default VisualStudio;
