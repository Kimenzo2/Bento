import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Smile, Paperclip, AtSign, Image, FileText, Mic,
    X, Bold, Italic, Code, List, Link2, Sparkles, Slash,
    ArrowRight, Hash, Command
} from 'lucide-react';
import { Message } from './types';

interface MessageInputProps {
    channelName: string;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
    onSend: (content: string, attachments?: File[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

interface SlashCommand {
    command: string;
    description: string;
    icon: React.ReactNode;
    category: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
    { command: '/help', description: 'Get help with Genesis', icon: <Sparkles size={16} />, category: 'AI' },
    { command: '/summarize', description: 'Summarize the conversation', icon: <FileText size={16} />, category: 'AI' },
    { command: '/image', description: 'Generate an image', icon: <Image size={16} />, category: 'AI' },
    { command: '/poll', description: 'Create a poll', icon: <List size={16} />, category: 'Utility' },
    { command: '/giphy', description: 'Search for GIFs', icon: <Image size={16} />, category: 'Fun' },
];

const EMOJI_QUICK_ACCESS = ['😀', '❤️', '👍', '🎉', '✨', '🔥', '💯', '🙏'];

const MessageInput: React.FC<MessageInputProps> = ({
    channelName,
    replyingTo,
    onCancelReply,
    onSend,
    disabled = false,
    placeholder,
}) => {
    const [content, setContent] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showSlashCommands, setShowSlashCommands] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [showFormatting, setShowFormatting] = useState(false);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, [content]);

    // Focus input when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
                setShowSlashCommands(false);
                setShowMentions(false);
                setShowFormatting(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setContent(value);

        // Check for slash commands
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowSlashCommands(true);
            setSelectedCommandIndex(0);
        } else {
            setShowSlashCommands(false);
        }

        // Check for mentions
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Submit on Enter (without shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        // Navigate slash commands
        if (showSlashCommands) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedCommandIndex(prev => 
                    Math.min(prev + 1, filteredCommands.length - 1)
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedCommandIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedCommandIndex]) {
                    setContent(filteredCommands[selectedCommandIndex].command + ' ');
                    setShowSlashCommands(false);
                }
            } else if (e.key === 'Escape') {
                setShowSlashCommands(false);
            }
        }

        // Formatting shortcuts
        if (e.metaKey || e.ctrlKey) {
            if (e.key === 'b') {
                e.preventDefault();
                insertFormatting('**', '**');
            } else if (e.key === 'i') {
                e.preventDefault();
                insertFormatting('*', '*');
            } else if (e.key === 'k') {
                e.preventDefault();
                insertFormatting('[', '](url)');
            }
        }
    };

    // Insert formatting around selection
    const insertFormatting = (before: string, after: string) => {
        if (!inputRef.current) return;
        
        const start = inputRef.current.selectionStart;
        const end = inputRef.current.selectionEnd;
        const selected = content.substring(start, end);
        
        const newContent = 
            content.substring(0, start) + 
            before + selected + after + 
            content.substring(end);
        
        setContent(newContent);
        
        // Set cursor position
        setTimeout(() => {
            if (inputRef.current) {
                const newPos = start + before.length + selected.length + after.length;
                inputRef.current.setSelectionRange(newPos, newPos);
                inputRef.current.focus();
            }
        }, 0);
    };

    // Filter slash commands
    const filteredCommands = SLASH_COMMANDS.filter(cmd =>
        cmd.command.toLowerCase().includes(content.toLowerCase())
    );

    // Handle send
    const handleSend = () => {
        if (!content.trim() && attachments.length === 0) return;
        onSend(content.trim(), attachments);
        setContent('');
        setAttachments([]);
        setShowSlashCommands(false);
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    // Remove attachment
    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Insert emoji
    const insertEmoji = (emoji: string) => {
        if (!inputRef.current) return;
        const start = inputRef.current.selectionStart;
        const end = inputRef.current.selectionEnd;
        const newContent = content.substring(0, start) + emoji + content.substring(end);
        setContent(newContent);
        
        setTimeout(() => {
            if (inputRef.current) {
                const newPos = start + emoji.length;
                inputRef.current.setSelectionRange(newPos, newPos);
                inputRef.current.focus();
            }
        }, 0);
    };

    return (
        <div
            ref={containerRef}
            className={`chat-input-container ${isDragging ? 'ring-2 ring-[var(--chat-coral-burst)] ring-opacity-50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Reply preview */}
            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        className="chat-input-reply-preview"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="chat-input-reply-content">
                            <div className="chat-input-reply-label">
                                Replying to {replyingTo.user.displayName}
                            </div>
                            <div className="chat-input-reply-text">
                                {replyingTo.content}
                            </div>
                        </div>
                        <button
                            className="chat-input-reply-close"
                            onClick={onCancelReply}
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Attachments preview */}
            <AnimatePresence>
                {attachments.length > 0 && (
                    <motion.div
                        className="flex flex-wrap gap-2 mb-3"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        {attachments.map((file, index) => (
                            <motion.div
                                key={index}
                                className="relative group"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                            >
                                {file.type.startsWith('image/') ? (
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        className="w-20 h-20 object-cover rounded-lg"
                                    />
                                ) : (
                                    <div className="w-20 h-20 bg-[var(--chat-bg-tertiary)] rounded-lg flex flex-col items-center justify-center p-2">
                                        <FileText size={24} className="text-[var(--chat-text-muted)]" />
                                        <span className="text-xs text-[var(--chat-text-muted)] truncate w-full text-center mt-1">
                                            {file.name}
                                        </span>
                                    </div>
                                )}
                                <button
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeAttachment(index)}
                                >
                                    <X size={12} />
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Slash commands dropdown */}
            <AnimatePresence>
                {showSlashCommands && filteredCommands.length > 0 && (
                    <motion.div
                        className="absolute bottom-full left-5 right-5 mb-2 bg-[var(--chat-bg-primary)] border border-[var(--chat-border-primary)] rounded-xl shadow-lg overflow-hidden z-50"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="p-2 text-xs font-semibold text-[var(--chat-text-muted)] border-b border-[var(--chat-border-secondary)]">
                            <Command size={12} className="inline mr-1" />
                            Slash Commands
                        </div>
                        {filteredCommands.map((cmd, index) => (
                            <button
                                key={cmd.command}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                                    index === selectedCommandIndex
                                        ? 'bg-[var(--chat-bg-hover)]'
                                        : 'hover:bg-[var(--chat-bg-hover)]'
                                }`}
                                onClick={() => {
                                    setContent(cmd.command + ' ');
                                    setShowSlashCommands(false);
                                    inputRef.current?.focus();
                                }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-[var(--chat-bg-tertiary)] flex items-center justify-center text-[var(--chat-coral-burst)]">
                                    {cmd.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--chat-text-primary)]">
                                        {cmd.command}
                                    </div>
                                    <div className="text-xs text-[var(--chat-text-muted)]">
                                        {cmd.description}
                                    </div>
                                </div>
                                <span className="text-xs text-[var(--chat-text-muted)] bg-[var(--chat-bg-tertiary)] px-2 py-1 rounded">
                                    {cmd.category}
                                </span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main input wrapper */}
            <div className="chat-input-wrapper">
                {/* Tools left */}
                <div className="chat-input-tools">
                    <button
                        className={`chat-input-tool ${showFormatting ? 'active' : ''}`}
                        onClick={() => setShowFormatting(!showFormatting)}
                        title="Formatting"
                    >
                        <Bold size={18} />
                    </button>
                    <button
                        className="chat-input-tool"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach file"
                    >
                        <Paperclip size={18} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileSelect}
                    />
                </div>

                {/* Text input */}
                <textarea
                    ref={inputRef}
                    className="chat-input-field"
                    placeholder={placeholder || `Message #${channelName}`}
                    value={content}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                />

                {/* Tools right */}
                <div className="chat-input-tools">
                    <div className="relative">
                        <button
                            className={`chat-input-tool ${showEmojiPicker ? 'active' : ''}`}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            title="Emoji"
                        >
                            <Smile size={18} />
                        </button>

                        {/* Quick emoji picker */}
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <motion.div
                                    className="absolute bottom-full right-0 mb-2 p-2 bg-[var(--chat-bg-primary)] border border-[var(--chat-border-primary)] rounded-xl shadow-lg flex gap-1 z-50"
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                >
                                    {EMOJI_QUICK_ACCESS.map((emoji) => (
                                        <motion.button
                                            key={emoji}
                                            className="w-8 h-8 rounded-lg hover:bg-[var(--chat-bg-hover)] flex items-center justify-center text-lg"
                                            onClick={() => {
                                                insertEmoji(emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                            whileHover={{ scale: 1.2 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            {emoji}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        className="chat-input-tool"
                        title="AI assist"
                    >
                        <Sparkles size={18} />
                    </button>
                </div>

                {/* Send button */}
                <motion.button
                    className="chat-input-send"
                    onClick={handleSend}
                    disabled={disabled || (!content.trim() && attachments.length === 0)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <Send size={18} />
                </motion.button>
            </div>

            {/* Formatting toolbar */}
            <AnimatePresence>
                {showFormatting && (
                    <motion.div
                        className="flex items-center gap-1 mt-2 p-2 bg-[var(--chat-bg-tertiary)] rounded-lg"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <button
                            className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]"
                            onClick={() => insertFormatting('**', '**')}
                            title="Bold (⌘B)"
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]"
                            onClick={() => insertFormatting('*', '*')}
                            title="Italic (⌘I)"
                        >
                            <Italic size={16} />
                        </button>
                        <button
                            className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]"
                            onClick={() => insertFormatting('`', '`')}
                            title="Code"
                        >
                            <Code size={16} />
                        </button>
                        <button
                            className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]"
                            onClick={() => insertFormatting('[', '](url)')}
                            title="Link (⌘K)"
                        >
                            <Link2 size={16} />
                        </button>
                        <div className="w-px h-5 bg-[var(--chat-border-secondary)] mx-1" />
                        <button
                            className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]"
                            onClick={() => insertFormatting('- ', '')}
                            title="List"
                        >
                            <List size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drag overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        className="absolute inset-0 bg-[var(--chat-coral-burst)]/10 border-2 border-dashed border-[var(--chat-coral-burst)] rounded-2xl flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="text-center">
                            <Paperclip size={32} className="mx-auto mb-2 text-[var(--chat-coral-burst)]" />
                            <p className="text-sm font-medium text-[var(--chat-coral-burst)]">
                                Drop files to upload
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MessageInput;
