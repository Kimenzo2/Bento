
import React, { useState } from 'react';
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
    ArrowLeft
} from 'lucide-react';
import { generateRefinedImage } from '../services/geminiService';

interface VisualStudioProps {
    project: BookProject | null;
    onBack?: () => void;
}

const VisualStudio: React.FC<VisualStudioProps> = ({ project, onBack }) => {
    const [activeTab, setActiveTab] = useState<'character' | 'scene' | 'style'>('character');
    const [isGenerating, setIsGenerating] = useState(false);

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

    return (
        <div className="w-full max-w-7xl mx-auto p-6 pb-24 animate-fadeIn">

            {/* Header */}
            <div className="relative mb-10 text-center">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                )}
                <h1 className="font-heading font-bold text-4xl text-charcoal-soft mb-2 flex items-center justify-center gap-3">
                    <Sparkles className="w-8 h-8 text-gold-sunshine" />
                    Visual Studio
                </h1>
                <p className="text-cocoa-light font-body">Fine-tune characters, compose scenes, and experiment with style alchemy.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">

                {/* Control Panel */}
                <div className="w-full lg:w-1/3 bg-white rounded-3xl shadow-soft-lg border border-white p-6 h-fit">

                    {/* Tabs */}
                    <div className="flex bg-cream-soft p-1.5 rounded-2xl mb-8 border border-peach-soft/50">
                        {['character', 'scene', 'style'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab as any);
                                    setSettings({ ...settings, generatedImage: null }); // Clear image on tab switch
                                }}
                                className={`flex-1 py-2.5 rounded-xl font-heading font-bold text-sm capitalize transition-all
                        ${activeTab === tab ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light hover:text-charcoal-soft'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content: Character */}
                    {activeTab === 'character' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Character
                                </label>
                                {project?.characters.length ? (
                                    <select
                                        value={settings.selectedCharacterId || ''}
                                        onChange={(e) => setSettings({ ...settings, selectedCharacterId: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 font-body text-charcoal-soft focus:border-coral-burst outline-none"
                                    >
                                        {project.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                ) : (
                                    <div className="p-3 bg-yellow-butter/20 rounded-xl text-sm text-cocoa-light italic">
                                        No characters found in current project.
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase">Expression</label>
                                    <select
                                        value={settings.expression}
                                        onChange={(e) => setSettings({ ...settings, expression: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-sm"
                                    >
                                        {expressions.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase">Pose</label>
                                    <select
                                        value={settings.pose}
                                        onChange={(e) => setSettings({ ...settings, pose: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-sm"
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
                                    className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 font-body text-charcoal-soft focus:border-coral-burst outline-none"
                                    placeholder="e.g. Red superhero cape"
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Scene */}
                    {activeTab === 'scene' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" /> Lighting Style
                                </label>
                                <div className="grid grid-cols-1 gap-4">
                                    <select
                                        value={settings.lighting}
                                        onChange={(e) => setSettings({ ...settings, lighting: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-sm font-body"
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
                                            className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-sm"
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
                                    className="w-full h-32 bg-cream-base border border-peach-soft rounded-xl p-3 font-body text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                    placeholder="Describe the setting, props, and atmosphere..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Style Alchemy */}
                    {activeTab === 'style' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                    <Palette className="w-4 h-4" /> Style Alchemy
                                </label>
                                <div className="bg-cream-base border border-peach-soft rounded-2xl p-4 space-y-4">
                                    <div>
                                        <div className="text-xs text-cocoa-light mb-1">Primary Style ({(settings.mixRatio)}%)</div>
                                        <select
                                            value={settings.styleA}
                                            onChange={(e) => setSettings({ ...settings, styleA: e.target.value as ArtStyle })}
                                            className="w-full bg-white border border-peach-soft rounded-xl p-2 text-sm"
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
                                            className="w-full bg-white border border-peach-soft rounded-xl p-2 text-sm"
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
                                    className="w-full h-24 bg-cream-base border border-peach-soft rounded-xl p-3 font-body text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                    placeholder="A landscape with a castle..."
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`w-full mt-4 py-4 rounded-xl font-heading font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                    ${isGenerating ? 'bg-cocoa-light cursor-not-allowed' : 'bg-gradient-to-r from-coral-burst to-gold-sunshine hover:scale-[1.02]'}`}
                    >
                        {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        {activeTab === 'character' ? 'Generate Character Sheet' : activeTab === 'scene' ? 'Render Scene' : 'Mix Styles'}
                    </button>

                </div>

                {/* Preview Canvas */}
                <div className="w-full lg:w-2/3 bg-cream-base rounded-3xl border-2 border-dashed border-peach-soft flex items-center justify-center min-h-[500px] relative overflow-hidden group">
                    {settings.generatedImage ? (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={settings.generatedImage}
                                alt="Generated Visual"
                                className="max-h-[600px] w-auto rounded-lg shadow-2xl object-contain"
                            />
                            <button
                                onClick={handleSaveAsset}
                                className="absolute bottom-8 right-8 bg-white text-charcoal-soft px-4 py-2 rounded-full shadow-lg font-heading font-bold flex items-center gap-2 hover:text-coral-burst transition-colors"
                            >
                                <Download className="w-4 h-4" /> Save Asset
                            </button>
                        </div>
                    ) : (
                        <div className="text-center text-cocoa-light/50">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 border-4 border-peach-soft border-t-coral-burst rounded-full animate-spin"></div>
                                    <span className="font-heading font-bold text-lg animate-pulse">Rendering Magic...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-24 h-24 rounded-full bg-peach-soft/30 flex items-center justify-center mx-auto mb-4">
                                        {activeTab === 'character' && <Users className="w-10 h-10 opacity-50" />}
                                        {activeTab === 'scene' && <Camera className="w-10 h-10 opacity-50" />}
                                        {activeTab === 'style' && <Palette className="w-10 h-10 opacity-50" />}
                                    </div>
                                    <p className="font-heading font-bold text-xl">Ready to Create</p>
                                    <p className="text-sm mt-2 max-w-xs mx-auto">Adjust settings on the left and click generate to visualize your ideas.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default VisualStudio;
