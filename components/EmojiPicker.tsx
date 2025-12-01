import React, { useState } from 'react';
import { Search, Smile } from 'lucide-react';

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    onClose: () => void;
}

const EMOJI_CATEGORIES = {
    'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋'],
    'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤝', '🙏'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    'Objects': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '⚡', '💥', '💢', '💬'],
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Smileys');

    const filteredEmojis = searchQuery
        ? Object.values(EMOJI_CATEGORIES).flat().filter(emoji => emoji.includes(searchQuery))
        : EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES];

    return (
        <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-lg border border-gray-200 dark:border-[#333333] w-80 z-50">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-[#333333]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search emoji..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-[#2D2D2D] border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-burst"
                        autoFocus
                    />
                </div>
            </div>

            {/* Categories */}
            {!searchQuery && (
                <div className="flex gap-2 p-3 border-b border-gray-200 dark:border-[#333333] overflow-x-auto">
                    {Object.keys(EMOJI_CATEGORIES).map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === category
                                    ? 'bg-coral-burst text-white'
                                    : 'bg-gray-100 dark:bg-[#2D2D2D] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3D3D3D]'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            )}

            {/* Emoji Grid */}
            <div className="p-3 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-8 gap-2">
                    {filteredEmojis.map((emoji, index) => (
                        <button
                            key={`${emoji}-${index}`}
                            onClick={() => {
                                onEmojiSelect(emoji);
                                onClose();
                            }}
                            className="text-2xl hover:bg-gray-100 dark:hover:bg-[#2D2D2D] rounded-lg p-2 transition-colors"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EmojiPicker;
