import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Palette, Plus, X, Star, Trash2, Edit2, Check, 
    Copy, Sparkles, Image, Wand2, Save, Heart
} from 'lucide-react';

export interface StylePreset {
    id: string;
    name: string;
    description?: string;
    style: string;
    colorPalette?: string;
    mood?: string;
    artStyle?: string;
    thumbnail?: string;
    isFavorite: boolean;
    isBuiltIn: boolean;
    createdAt: number;
    usageCount: number;
}

const STORAGE_KEY = 'genesis_style_presets';

// Built-in presets
const BUILT_IN_PRESETS: StylePreset[] = [
    {
        id: 'watercolor-whimsy',
        name: 'Watercolor Whimsy',
        description: 'Soft, dreamy watercolor illustrations perfect for fairy tales',
        style: 'Soft watercolor illustration with gentle brushstrokes, pastel colors, whimsical and dreamy atmosphere',
        colorPalette: 'Pastel pinks, soft blues, gentle yellows',
        mood: 'Dreamy, magical, gentle',
        artStyle: 'Watercolor',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'pixar-3d',
        name: 'Pixar-Style 3D',
        description: 'Modern 3D rendered characters with expressive faces',
        style: 'Pixar-style 3D rendered illustration, expressive characters with big eyes, vibrant colors, cinematic lighting',
        colorPalette: 'Vibrant, saturated colors',
        mood: 'Fun, expressive, modern',
        artStyle: '3D Render',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'classic-storybook',
        name: 'Classic Storybook',
        description: 'Traditional children\'s book illustration style',
        style: 'Classic children\'s book illustration, detailed hand-drawn style, warm earthy colors, cozy and nostalgic',
        colorPalette: 'Warm earth tones, golden yellows, forest greens',
        mood: 'Nostalgic, warm, cozy',
        artStyle: 'Traditional Illustration',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'anime-manga',
        name: 'Anime & Manga',
        description: 'Japanese anime-inspired art style',
        style: 'Anime-style illustration, expressive eyes, dynamic poses, clean line art with cel shading',
        colorPalette: 'Bright, bold colors with dramatic highlights',
        mood: 'Energetic, dramatic, expressive',
        artStyle: 'Anime',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'papercraft',
        name: 'Papercraft Magic',
        description: 'Cut paper and collage style illustrations',
        style: 'Paper cut-out illustration style, layered textured paper, handcrafted look, depth through shadows',
        colorPalette: 'Textured paper colors, kraft and colored paper',
        mood: 'Playful, tactile, crafty',
        artStyle: 'Paper Craft',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'oil-painting',
        name: 'Oil Painting Classic',
        description: 'Rich, textured oil painting style',
        style: 'Oil painting style, rich textures and brushstrokes, dramatic lighting, Renaissance-inspired composition',
        colorPalette: 'Deep, rich colors with golden highlights',
        mood: 'Dramatic, elegant, timeless',
        artStyle: 'Oil Painting',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'flat-vector',
        name: 'Modern Flat',
        description: 'Clean, modern vector illustrations',
        style: 'Flat vector illustration, minimal design, geometric shapes, modern and clean aesthetic',
        colorPalette: 'Limited, harmonious color palette',
        mood: 'Modern, clean, minimalist',
        artStyle: 'Vector',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
    {
        id: 'fantasy-epic',
        name: 'Epic Fantasy',
        description: 'Dramatic fantasy art with magical elements',
        style: 'Epic fantasy illustration, dramatic lighting, magical glow effects, detailed environments, heroic poses',
        colorPalette: 'Deep purples, ethereal blues, golden magic',
        mood: 'Epic, magical, adventurous',
        artStyle: 'Fantasy Art',
        isFavorite: false,
        isBuiltIn: true,
        createdAt: 0,
        usageCount: 0,
    },
];

// Hook for managing style presets
export function useStylePresets() {
    const [presets, setPresets] = useState<StylePreset[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const userPresets = stored ? JSON.parse(stored) : [];
            return [...BUILT_IN_PRESETS, ...userPresets];
        } catch {
            return BUILT_IN_PRESETS;
        }
    });

    // Save user presets to localStorage
    useEffect(() => {
        const userPresets = presets.filter(p => !p.isBuiltIn);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    }, [presets]);

    const addPreset = useCallback((preset: Omit<StylePreset, 'id' | 'createdAt' | 'usageCount' | 'isBuiltIn'>) => {
        const newPreset: StylePreset = {
            ...preset,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
            usageCount: 0,
            isBuiltIn: false,
        };
        setPresets(prev => [...prev, newPreset]);
        return newPreset;
    }, []);

    const updatePreset = useCallback((id: string, updates: Partial<StylePreset>) => {
        setPresets(prev => prev.map(p => 
            p.id === id && !p.isBuiltIn ? { ...p, ...updates } : p
        ));
    }, []);

    const deletePreset = useCallback((id: string) => {
        setPresets(prev => prev.filter(p => p.id !== id || p.isBuiltIn));
    }, []);

    const toggleFavorite = useCallback((id: string) => {
        setPresets(prev => prev.map(p => 
            p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
        ));
    }, []);

    const incrementUsage = useCallback((id: string) => {
        setPresets(prev => prev.map(p => 
            p.id === id ? { ...p, usageCount: p.usageCount + 1 } : p
        ));
    }, []);

    const favorites = presets.filter(p => p.isFavorite);
    const recent = [...presets]
        .filter(p => p.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);

    return {
        presets,
        favorites,
        recent,
        addPreset,
        updatePreset,
        deletePreset,
        toggleFavorite,
        incrementUsage,
    };
}

// Style Preset Card Component
interface PresetCardProps {
    preset: StylePreset;
    onSelect: (preset: StylePreset) => void;
    onToggleFavorite: (id: string) => void;
    onDelete?: (id: string) => void;
    onEdit?: (preset: StylePreset) => void;
    isSelected?: boolean;
}

export const PresetCard: React.FC<PresetCardProps> = ({
    preset,
    onSelect,
    onToggleFavorite,
    onDelete,
    onEdit,
    isSelected = false,
}) => {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                relative p-4 rounded-2xl cursor-pointer transition-all
                ${isSelected 
                    ? 'bg-coral-burst text-white ring-2 ring-coral-burst ring-offset-2' 
                    : 'bg-white dark:bg-gray-800 hover:shadow-lg border border-gray-200 dark:border-gray-700'
                }
            `}
            onClick={() => onSelect(preset)}
        >
            {/* Favorite button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(preset.id);
                }}
                title={preset.isFavorite ? "Remove from favorites" : "Add to favorites"}
                className={`
                    absolute top-2 right-2 p-1.5 rounded-lg transition-colors
                    ${isSelected ? 'hover:bg-white/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                `}
            >
                <Heart 
                    className={`w-4 h-4 ${preset.isFavorite ? 'fill-red-500 text-red-500' : isSelected ? 'text-white/70' : 'text-gray-400'}`} 
                />
            </button>

            {/* Art style badge */}
            {preset.artStyle && (
                <span className={`
                    inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2
                    ${isSelected ? 'bg-white/20' : 'bg-coral-burst/10 text-coral-burst'}
                `}>
                    {preset.artStyle}
                </span>
            )}

            <h4 className={`font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {preset.name}
            </h4>
            
            {preset.description && (
                <p className={`text-sm mb-2 line-clamp-2 ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {preset.description}
                </p>
            )}

            {/* Color palette preview */}
            {preset.colorPalette && (
                <p className={`text-xs ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                    🎨 {preset.colorPalette}
                </p>
            )}

            {/* Actions for custom presets */}
            {!preset.isBuiltIn && (onEdit || onDelete) && (
                <div className="flex gap-1 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(preset);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                        >
                            <Edit2 className="w-3 h-3" />
                            Edit
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(preset.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        >
                            <Trash2 className="w-3 h-3" />
                            Delete
                        </button>
                    )}
                </div>
            )}

            {/* Built-in badge */}
            {preset.isBuiltIn && (
                <div className={`mt-2 text-xs ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                    ✨ Built-in preset
                </div>
            )}
        </motion.div>
    );
};

// Style Preset Picker Modal
interface StylePresetPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (preset: StylePreset) => void;
    selectedId?: string;
}

export const StylePresetPicker: React.FC<StylePresetPickerProps> = ({
    isOpen,
    onClose,
    onSelect,
    selectedId,
}) => {
    const { presets, favorites, recent, toggleFavorite, addPreset, deletePreset } = useStylePresets();
    const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'custom'>('all');
    const [isCreating, setIsCreating] = useState(false);
    const [newPreset, setNewPreset] = useState({ name: '', style: '', description: '' });

    const handleSelect = (preset: StylePreset) => {
        onSelect(preset);
        onClose();
    };

    const handleCreate = () => {
        if (newPreset.name && newPreset.style) {
            addPreset({
                name: newPreset.name,
                style: newPreset.style,
                description: newPreset.description,
                isFavorite: false,
            });
            setNewPreset({ name: '', style: '', description: '' });
            setIsCreating(false);
        }
    };

    const displayPresets = activeTab === 'favorites' 
        ? favorites 
        : activeTab === 'custom' 
            ? presets.filter(p => !p.isBuiltIn)
            : presets;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-coral-burst/10 rounded-xl">
                                    <Palette className="w-6 h-6 text-coral-burst" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                                        Style Presets
                                    </h2>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                        Choose an illustration style for your book
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                            {[
                                { id: 'all', label: 'All Styles', count: presets.length },
                                { id: 'favorites', label: 'Favorites', count: favorites.length },
                                { id: 'custom', label: 'My Styles', count: presets.filter(p => !p.isBuiltIn).length },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                                        ${activeTab === tab.id
                                            ? 'bg-coral-burst text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }
                                    `}
                                >
                                    {tab.label} ({tab.count})
                                </button>
                            ))}
                            <button
                                onClick={() => setIsCreating(true)}
                                className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                Create Style
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-6 overflow-y-auto flex-1">
                        {isCreating ? (
                            <div className="max-w-lg mx-auto space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Style</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Style Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newPreset.name}
                                        onChange={(e) => setNewPreset(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="My Custom Style"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Style Description (for AI)
                                    </label>
                                    <textarea
                                        value={newPreset.style}
                                        onChange={(e) => setNewPreset(prev => ({ ...prev, style: e.target.value }))}
                                        placeholder="Describe the illustration style in detail..."
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Short Description (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newPreset.description}
                                        onChange={(e) => setNewPreset(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="A brief description of this style"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newPreset.name || !newPreset.style}
                                        className="flex-1 py-2 rounded-xl bg-coral-burst text-white disabled:opacity-50"
                                    >
                                        Create Style
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {displayPresets.map(preset => (
                                    <PresetCard
                                        key={preset.id}
                                        preset={preset}
                                        onSelect={handleSelect}
                                        onToggleFavorite={toggleFavorite}
                                        onDelete={!preset.isBuiltIn ? deletePreset : undefined}
                                        isSelected={preset.id === selectedId}
                                    />
                                ))}
                                {displayPresets.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-gray-500">
                                        <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No styles found in this category</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default { useStylePresets, PresetCard, StylePresetPicker };
