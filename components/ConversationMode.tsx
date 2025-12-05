import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageCircle, 
    Send, 
    Sparkles, 
    BookOpen, 
    Palette, 
    Users, 
    Wand2,
    ChevronRight,
    X,
    Loader
} from 'lucide-react';
import { GenerationSettings, ArtStyle, BookTone } from '../types';
import { callAPI, GrokMessage } from '../services/grokService';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ExtractedSettings {
    prompt?: string;
    style?: ArtStyle;
    tone?: BookTone;
    audience?: string;
    pageCount?: number;
    educational?: boolean;
    isBranching?: boolean;
    complete: boolean;
}

interface ConversationModeProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (settings: GenerationSettings) => void;
}

const ConversationMode: React.FC<ConversationModeProps> = ({
    isOpen,
    onClose,
    onGenerate
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "✨ Hello! I'm here to help you create an amazing children's book. Tell me about your story idea - what kind of adventure would you like to create?",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [extractedSettings, setExtractedSettings] = useState<ExtractedSettings>({ complete: false });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsThinking(true);

        try {
            // Build conversation history for context
            const conversationHistory = messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));

            const apiMessages: GrokMessage[] = [
                {
                    role: 'system',
                    content: `You are a friendly children's book creation assistant. Your job is to have a natural conversation to understand what kind of book the user wants to create.

You need to extract these parameters through conversation (don't ask all at once):
1. Main story idea/prompt
2. Art style preference (Watercolor, 3D Pixar, Manga, etc.)
3. Tone (Playful, Adventurous, Educational, Calm, etc.)
4. Target audience age range
5. Approximate page count (8-20 pages)
6. Whether it should be educational
7. Whether it should have branching choices

Be friendly, encouraging, and help them refine their ideas. Ask follow-up questions naturally.

When you have enough information, include this JSON at the END of your message (after your friendly text):
{"extracted": {"prompt": "...", "style": "Watercolor", "tone": "Playful", "audience": "4-6 years", "pageCount": 10, "educational": false, "isBranching": false, "complete": true}}

Only set "complete": true when you have at least: prompt, style, tone, and audience.`
                },
                ...conversationHistory,
                { role: 'user' as const, content: input.trim() }
            ];

            const response = await callAPI(apiMessages);
            
            // Extract settings JSON if present
            const jsonMatch = response.match(/\{"extracted":\s*(\{[^}]+\})\}/);
            let cleanResponse = response;
            
            if (jsonMatch) {
                try {
                    const extracted = JSON.parse(jsonMatch[1]);
                    setExtractedSettings(prev => ({ ...prev, ...extracted }));
                    // Remove JSON from displayed message
                    cleanResponse = response.replace(jsonMatch[0], '').trim();
                } catch (e) {
                    console.error('Failed to parse extracted settings:', e);
                }
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: cleanResponse,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Conversation error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Oops! I had a little trouble there. Could you tell me more about your story idea?",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerate = () => {
        if (!extractedSettings.complete || !extractedSettings.prompt) return;

        const settings: GenerationSettings = {
            prompt: extractedSettings.prompt,
            style: extractedSettings.style || ArtStyle.WATERCOLOR,
            tone: extractedSettings.tone || BookTone.PLAYFUL,
            audience: extractedSettings.audience || 'Children 4-6',
            pageCount: extractedSettings.pageCount || 10,
            educational: extractedSettings.educational || false,
            isBranching: extractedSettings.isBranching || false
        };

        onGenerate(settings);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-2xl h-[80vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-700/50"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-xl">
                                <MessageCircle className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white">Story Conversation</h2>
                                <p className="text-xs text-slate-400">Tell me about your book idea</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-slate-700/50 text-slate-100'
                                }`}>
                                    {message.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs font-medium text-purple-400">Genesis</span>
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                            </motion.div>
                        ))}

                        {isThinking && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex justify-start"
                            >
                                <div className="bg-slate-700/50 rounded-2xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Loader className="w-4 h-4 text-purple-400 animate-spin" />
                                        <span className="text-sm text-slate-400">Thinking...</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Extracted Settings Preview */}
                    <AnimatePresence>
                        {extractedSettings.prompt && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-slate-700/50 bg-slate-800/30 overflow-hidden"
                            >
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-medium text-slate-400">Your Book Settings</h3>
                                        {extractedSettings.complete && (
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                ✓ Ready to create
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {extractedSettings.style && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg text-xs">
                                                <Palette className="w-3 h-3 text-pink-400" />
                                                <span className="text-slate-300">{extractedSettings.style}</span>
                                            </div>
                                        )}
                                        {extractedSettings.tone && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg text-xs">
                                                <BookOpen className="w-3 h-3 text-blue-400" />
                                                <span className="text-slate-300">{extractedSettings.tone}</span>
                                            </div>
                                        )}
                                        {extractedSettings.audience && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg text-xs">
                                                <Users className="w-3 h-3 text-green-400" />
                                                <span className="text-slate-300">{extractedSettings.audience}</span>
                                            </div>
                                        )}
                                        {extractedSettings.pageCount && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg text-xs">
                                                <span className="text-slate-300">{extractedSettings.pageCount} pages</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
                        <div className="flex gap-3">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Describe your story idea..."
                                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                                disabled={isThinking}
                            />
                            {extractedSettings.complete ? (
                                <button
                                    onClick={handleGenerate}
                                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Create Book
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isThinking}
                                    className="px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConversationMode;
