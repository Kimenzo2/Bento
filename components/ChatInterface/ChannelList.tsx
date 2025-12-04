import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hash, Volume2, Sparkles, MessageSquare, Lock,
    ChevronRight, Plus, Pin, BellOff, Settings, X
} from 'lucide-react';
import { Channel, ChannelCategory, chatAnimations } from './types';

interface ChannelListProps {
    categories: ChannelCategory[];
    activeChannel: Channel | null;
    onChannelSelect: (channel: Channel) => void;
    onCategoryToggle: (categoryId: string) => void;
    searchQuery?: string;
    onCreateChannel?: (categoryId: string, channelName: string, channelType: 'text' | 'voice') => void;
}

interface VoiceParticipant {
    id: string;
    name: string;
    avatarUrl: string;
    isSpeaking: boolean;
}

// Mock voice participants
const mockVoiceParticipants: Record<string, VoiceParticipant[]> = {
    'ch-5': [
        { id: 'v1', name: 'Sarah Chen', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', isSpeaking: true },
        { id: 'v2', name: 'Alex Rivera', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', isSpeaking: false },
    ],
};

const ChannelList: React.FC<ChannelListProps> = ({
    categories,
    activeChannel,
    onChannelSelect,
    onCategoryToggle,
    searchQuery = '',
    onCreateChannel,
}) => {
    // State for create channel modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');

    // Filter channels based on search
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return categories;

        return categories.map(category => ({
            ...category,
            channels: category.channels.filter(channel =>
                channel.name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        })).filter(category => category.channels.length > 0);
    }, [categories, searchQuery]);

    const getChannelIcon = (channel: Channel) => {
        if (channel.icon) {
            return <span className="text-base">{channel.icon}</span>;
        }
        
        switch (channel.type) {
            case 'voice':
                return <Volume2 size={18} className="text-[var(--chat-mint-breeze)]" />;
            case 'ai-assistant':
                return <Sparkles size={18} className="text-[var(--chat-coral-burst)]" />;
            case 'thread':
                return <MessageSquare size={18} />;
            default:
                return <Hash size={18} />;
        }
    };

    const renderChannel = (channel: Channel) => {
        const isActive = activeChannel?.id === channel.id;
        const hasUnread = channel.unreadCount > 0;
        const hasMention = channel.mentionCount > 0;
        const voiceParticipants = mockVoiceParticipants[channel.id] || [];

        return (
            <motion.div
                key={channel.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
            >
                <button
                    className={`chat-channel-item w-full text-left group ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                    onClick={() => onChannelSelect(channel)}
                >
                    <div className="chat-channel-icon">
                        {getChannelIcon(channel)}
                    </div>
                    <span className="chat-channel-name">{channel.name}</span>
                    
                    {/* Status indicators */}
                    <div className="flex items-center gap-1.5 ml-auto">
                        {channel.isPinned && (
                            <Pin size={12} className="text-[var(--chat-gold-sunshine)]" />
                        )}
                        {channel.isMuted && (
                            <BellOff size={12} className="text-[var(--chat-text-muted)]" />
                        )}
                        {channel.isLocked && (
                            <Lock size={12} className="text-[var(--chat-text-muted)]" />
                        )}
                        {hasMention && (
                            <span className="chat-channel-badge mention">
                                {channel.mentionCount}
                            </span>
                        )}
                        {hasUnread && !hasMention && (
                            <span className="chat-channel-badge">
                                {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                            </span>
                        )}
                        
                        {/* Settings on hover */}
                        <button
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--chat-bg-hover)] transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Open channel settings
                            }}
                        >
                            <Settings size={14} className="text-[var(--chat-text-muted)]" />
                        </button>
                    </div>
                </button>

                {/* Voice channel participants */}
                {channel.type === 'voice' && voiceParticipants.length > 0 && (
                    <div className="chat-voice-participants">
                        {voiceParticipants.map(participant => (
                            <div key={participant.id} className="chat-voice-participant">
                                <div className={`chat-voice-participant-avatar ${participant.isSpeaking ? 'speaking' : ''}`}>
                                    <img src={participant.avatarUrl} alt={participant.name} />
                                </div>
                                <span className="truncate">{participant.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className="chat-channels">
            <AnimatePresence mode="popLayout">
                {filteredCategories.map((category) => (
                    <motion.div
                        key={category.id}
                        className="chat-category"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Category Header */}
                        <div
                            className="chat-category-header"
                            onClick={() => onCategoryToggle(category.id)}
                        >
                            <div className={`chat-category-toggle ${category.isCollapsed ? 'collapsed' : ''}`}>
                                <ChevronRight size={12} />
                            </div>
                            <span 
                                className="chat-category-name"
                                style={{ color: category.color }}
                            >
                                {category.name}
                            </span>
                            <button
                                className="chat-category-add hover:bg-[var(--chat-bg-hover)] hover:text-[var(--chat-coral-burst)] transition-all rounded-md p-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategoryId(category.id);
                                    setIsCreateModalOpen(true);
                                }}
                                title={`Add channel to ${category.name}`}
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Channels */}
                        <AnimatePresence mode="popLayout">
                            {!category.isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {category.channels.map(renderChannel)}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Empty state for search */}
            {searchQuery && filteredCategories.length === 0 && (
                <div className="text-center py-8 text-[var(--chat-text-muted)]">
                    <Hash size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No channels found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                </div>
            )}

            {/* Create Channel Button */}
            {!searchQuery && (
                <motion.button
                    className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 text-[var(--chat-text-muted)] hover:text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] rounded-lg transition-colors"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                        setSelectedCategoryId(categories[0]?.id || null);
                        setIsCreateModalOpen(true);
                    }}
                >
                    <div className="w-6 h-6 rounded-lg bg-[var(--chat-bg-tertiary)] flex items-center justify-center">
                        <Plus size={14} />
                    </div>
                    <span className="text-sm font-medium">Create Channel</span>
                </motion.button>
            )}

            {/* Create Channel Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/50 z-[100]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                setNewChannelName('');
                            }}
                        />
                        <motion.div
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md bg-[var(--chat-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        >
                            <div className="p-4 border-b border-[var(--chat-border-primary)] flex items-center justify-between">
                                <h3 className="font-bold text-lg text-[var(--chat-text-primary)]">Create Channel</h3>
                                <button
                                    className="p-1.5 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-muted)] transition-colors"
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setNewChannelName('');
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Channel Type */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--chat-text-secondary)] mb-2">
                                        Channel Type
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                                                newChannelType === 'text' 
                                                    ? 'border-[var(--chat-coral-burst)] bg-[var(--chat-coral-burst)]/10 text-[var(--chat-text-primary)]' 
                                                    : 'border-[var(--chat-border-primary)] text-[var(--chat-text-muted)] hover:border-[var(--chat-text-muted)]'
                                            }`}
                                            onClick={() => setNewChannelType('text')}
                                        >
                                            <Hash size={18} />
                                            <span className="text-sm font-medium">Text</span>
                                        </button>
                                        <button
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                                                newChannelType === 'voice' 
                                                    ? 'border-[var(--chat-mint-breeze)] bg-[var(--chat-mint-breeze)]/10 text-[var(--chat-text-primary)]' 
                                                    : 'border-[var(--chat-border-primary)] text-[var(--chat-text-muted)] hover:border-[var(--chat-text-muted)]'
                                            }`}
                                            onClick={() => setNewChannelType('voice')}
                                        >
                                            <Volume2 size={18} />
                                            <span className="text-sm font-medium">Voice</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Channel Name */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--chat-text-secondary)] mb-2">
                                        Channel Name
                                    </label>
                                    <div className="flex items-center gap-2 bg-[var(--chat-bg-tertiary)] rounded-xl px-3 py-2.5 border border-[var(--chat-border-primary)] focus-within:border-[var(--chat-coral-burst)] transition-colors">
                                        {newChannelType === 'text' ? <Hash size={18} className="text-[var(--chat-text-muted)]" /> : <Volume2 size={18} className="text-[var(--chat-mint-breeze)]" />}
                                        <input
                                            type="text"
                                            value={newChannelName}
                                            onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                            placeholder="new-channel"
                                            className="flex-1 bg-transparent outline-none text-[var(--chat-text-primary)] placeholder:text-[var(--chat-text-muted)]"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-[var(--chat-text-muted)]">
                                        Channel names must be lowercase and use hyphens instead of spaces
                                    </p>
                                </div>

                                {/* Category Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--chat-text-secondary)] mb-2">
                                        Category
                                    </label>
                                    <select
                                        value={selectedCategoryId || ''}
                                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                                        className="w-full bg-[var(--chat-bg-tertiary)] border border-[var(--chat-border-primary)] rounded-xl px-3 py-2.5 text-[var(--chat-text-primary)] outline-none focus:border-[var(--chat-coral-burst)] transition-colors"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="p-4 bg-[var(--chat-bg-tertiary)] flex gap-3 justify-end">
                                <button
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--chat-text-secondary)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setNewChannelName('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--chat-coral-burst)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!newChannelName.trim()}
                                    onClick={() => {
                                        if (newChannelName.trim() && selectedCategoryId) {
                                            onCreateChannel?.(selectedCategoryId, newChannelName.trim(), newChannelType);
                                            setIsCreateModalOpen(false);
                                            setNewChannelName('');
                                        }
                                    }}
                                >
                                    Create Channel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChannelList;
