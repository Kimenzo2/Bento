// ==============================================================================
// GENESIS BROADCAST STUDIO COMPONENT
// ==============================================================================
// Live streaming interface for broadcasters with viewer chat and controls
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radio,
    Users,
    MessageSquare,
    Settings,
    Share2,
    Eye,
    EyeOff,
    Mic,
    MicOff,
    Camera,
    CameraOff,
    Send,
    Pin,
    Check,
    Clock,
    Heart,
    Sparkles,
    Copy,
    ExternalLink,
    X,
    AlertCircle,
    PlayCircle,
    StopCircle,
    Calendar
} from 'lucide-react';
import { broadcastService } from '../../services/broadcastService';
import {
    BroadcastSession,
    BroadcastMessage,
    BroadcastViewer,
    BroadcastStatus,
    BroadcastAction
} from '../../types/advanced';
import { useAuth } from '../../contexts/AuthContext';

interface BroadcastStudioProps {
    onClose?: () => void;
    initialSession?: BroadcastSession;
}

const BroadcastStudio: React.FC<BroadcastStudioProps> = ({
    onClose,
    initialSession
}) => {
    const { user } = useAuth();
    const [session, setSession] = useState<BroadcastSession | null>(initialSession || null);
    const [isLive, setIsLive] = useState(false);
    const [viewers, setViewers] = useState<BroadcastViewer[]>([]);
    const [messages, setMessages] = useState<BroadcastMessage[]>([]);
    const [questions, setQuestions] = useState<BroadcastMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [activeTab, setActiveTab] = useState<'chat' | 'questions' | 'viewers'>('chat');
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        chatEnabled: true,
        questionsEnabled: true,
        copySettingsEnabled: true,
        isPrivate: false
    });
    const [stats, setStats] = useState({
        peakViewers: 0,
        totalMessages: 0,
        duration: 0
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Subscribe to broadcast events when live
    useEffect(() => {
        if (!session || !isLive) return;

        const channel = broadcastService.subscribeToBroadcast(session.id, {
            onViewerJoin: (viewer) => {
                setViewers(prev => [...prev, viewer]);
                if (viewers.length + 1 > stats.peakViewers) {
                    setStats(prev => ({ ...prev, peakViewers: viewers.length + 1 }));
                }
            },
            onViewerLeave: (viewer) => {
                setViewers(prev => prev.filter(v => v.id !== viewer.id));
            },
            onMessage: (message) => {
                if (message.type === 'question') {
                    setQuestions(prev => [...prev, message]);
                } else {
                    setMessages(prev => [...prev, message]);
                }
                setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
            },
            onViewerCountChange: (count) => {
                if (count > stats.peakViewers) {
                    setStats(prev => ({ ...prev, peakViewers: count }));
                }
            }
        });

        // Start duration timer
        timerRef.current = setInterval(() => {
            setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);

        return () => {
            broadcastService.unsubscribeFromBroadcast(session.id);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session, isLive]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleStartBroadcast = async () => {
        if (!title.trim()) {
            alert('Please enter a title for your broadcast');
            return;
        }

        const result = await broadcastService.startBroadcast(title, description, {
            chat_enabled: settings.chatEnabled,
            questions_enabled: settings.questionsEnabled,
            copy_settings_enabled: settings.copySettingsEnabled,
            is_private: settings.isPrivate
        });

        if (result.success && result.data) {
            setSession(result.data);
            setIsLive(true);
        } else {
            alert(result.error || 'Failed to start broadcast');
        }
    };

    const handleEndBroadcast = async () => {
        if (!session) return;

        const confirmed = window.confirm('Are you sure you want to end this broadcast?');
        if (!confirmed) return;

        const result = await broadcastService.endBroadcast(session.id);
        if (result.success) {
            setIsLive(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleSendMessage = async () => {
        if (!session || !newMessage.trim()) return;

        await broadcastService.sendMessage(session.id, newMessage, 'chat');
        setNewMessage('');
    };

    const handlePinMessage = async (messageId: string, isPinned: boolean) => {
        await broadcastService.togglePinMessage(messageId, !isPinned);
        setMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, is_pinned: !isPinned } : m)
        );
    };

    const handleAnswerQuestion = async (questionId: string) => {
        await broadcastService.markQuestionAnswered(questionId);
        setQuestions(prev =>
            prev.map(q => q.id === questionId ? { ...q, is_answered: true } : q)
        );
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const copyShareLink = () => {
        if (session) {
            navigator.clipboard.writeText(`${window.location.origin}/broadcast/${session.id}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-pink-900/30">
                <div className="flex items-center gap-4">
                    {isLive ? (
                        <div className="flex items-center gap-2">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-3 h-3 bg-red-500 rounded-full"
                            />
                            <span className="font-bold text-red-400">LIVE</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                            <Radio className="w-5 h-5 opacity-50" />
                            <span>Offline</span>
                        </div>
                    )}
                    
                    {isLive && session && (
                        <>
                            <div className="flex items-center gap-2 text-gray-300">
                                <Clock className="w-4 h-4" />
                                <span className="font-mono">{formatDuration(stats.duration)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-300">
                                <Users className="w-4 h-4" />
                                <span>{session.viewer_count}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isLive && (
                        <>
                            <button
                                onClick={copyShareLink}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Copy share link"
                            >
                                <Share2 className="w-5 h-5 text-gray-400" />
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Settings className="w-5 h-5 text-gray-400" />
                            </button>
                        </>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left panel - Broadcast setup or preview */}
                <div className="flex-1 flex flex-col min-h-0">
                    {!isLive ? (
                        /* Pre-broadcast setup */
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="min-h-full flex items-center justify-center">
                                <div className="max-w-md w-full space-y-6">
                                <div className="text-center">
                                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                        <Radio className="w-10 h-10 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Go Live</h2>
                                    <p className="text-gray-400">Share your creative process with the community</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Broadcast Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="What are you creating today?"
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Description (optional)
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Tell viewers what to expect..."
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                                        />
                                    </div>

                                    {/* Settings toggles */}
                                    <div className="space-y-3 pt-4 border-t border-white/10">
                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <MessageSquare className="w-5 h-5 text-gray-400" />
                                                <span className="text-gray-300">Enable chat</span>
                                            </div>
                                            <div
                                                onClick={() => setSettings(s => ({ ...s, chatEnabled: !s.chatEnabled }))}
                                                className={`w-11 h-6 rounded-full transition-colors ${
                                                    settings.chatEnabled ? 'bg-purple-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <motion.div
                                                    animate={{ x: settings.chatEnabled ? 20 : 2 }}
                                                    className="w-5 h-5 bg-white rounded-full mt-0.5"
                                                />
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="w-5 h-5 text-gray-400" />
                                                <span className="text-gray-300">Allow questions</span>
                                            </div>
                                            <div
                                                onClick={() => setSettings(s => ({ ...s, questionsEnabled: !s.questionsEnabled }))}
                                                className={`w-11 h-6 rounded-full transition-colors ${
                                                    settings.questionsEnabled ? 'bg-purple-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <motion.div
                                                    animate={{ x: settings.questionsEnabled ? 20 : 2 }}
                                                    className="w-5 h-5 bg-white rounded-full mt-0.5"
                                                />
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <Copy className="w-5 h-5 text-gray-400" />
                                                <span className="text-gray-300">Allow copying settings</span>
                                            </div>
                                            <div
                                                onClick={() => setSettings(s => ({ ...s, copySettingsEnabled: !s.copySettingsEnabled }))}
                                                className={`w-11 h-6 rounded-full transition-colors ${
                                                    settings.copySettingsEnabled ? 'bg-purple-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <motion.div
                                                    animate={{ x: settings.copySettingsEnabled ? 20 : 2 }}
                                                    className="w-5 h-5 bg-white rounded-full mt-0.5"
                                                />
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                {settings.isPrivate ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                                                <span className="text-gray-300">Private broadcast</span>
                                            </div>
                                            <div
                                                onClick={() => setSettings(s => ({ ...s, isPrivate: !s.isPrivate }))}
                                                className={`w-11 h-6 rounded-full transition-colors ${
                                                    settings.isPrivate ? 'bg-purple-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <motion.div
                                                    animate={{ x: settings.isPrivate ? 20 : 2 }}
                                                    className="w-5 h-5 bg-white rounded-full mt-0.5"
                                                />
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartBroadcast}
                                    disabled={!title.trim()}
                                    className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <PlayCircle className="w-6 h-6" />
                                    Start Broadcasting
                                </button>
                            </div>
                            </div>
                        </div>
                    ) : (
                        /* Live broadcast info */
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-white/5 rounded-2xl p-6 mb-6">
                                <h3 className="text-xl font-bold text-white mb-2">{session?.title}</h3>
                                {session?.description && (
                                    <p className="text-gray-400">{session.description}</p>
                                )}
                            </div>

                            {/* Stats cards */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-purple-400 mb-1">
                                        <Users className="w-4 h-4" />
                                        <span className="text-sm">Peak Viewers</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{stats.peakViewers}</p>
                                </div>
                                <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-pink-400 mb-1">
                                        <MessageSquare className="w-4 h-4" />
                                        <span className="text-sm">Messages</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
                                </div>
                                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-sm">Duration</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white font-mono">
                                        {formatDuration(stats.duration)}
                                    </p>
                                </div>
                            </div>

                            {/* End broadcast button */}
                            <button
                                onClick={handleEndBroadcast}
                                className="w-full py-4 bg-red-500/20 border border-red-500/50 text-red-400 font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-red-500/30 transition-colors"
                            >
                                <StopCircle className="w-6 h-6" />
                                End Broadcast
                            </button>
                        </div>
                    )}
                </div>

                {/* Right panel - Chat/Questions/Viewers */}
                {isLive && (
                    <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-[40%] lg:h-auto">
                        {/* Tabs */}
                        <div className="flex border-b border-white/10">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                                    activeTab === 'chat' ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Chat
                                {activeTab === 'chat' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('questions')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                                    activeTab === 'questions' ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Questions
                                {questions.filter(q => !q.is_answered).length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                                        {questions.filter(q => !q.is_answered).length}
                                    </span>
                                )}
                                {activeTab === 'questions' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('viewers')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                                    activeTab === 'viewers' ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Viewers
                                {activeTab === 'viewers' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                                    />
                                )}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <AnimatePresence mode="wait">
                                {activeTab === 'chat' && (
                                    <motion.div
                                        key="chat"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-3"
                                    >
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`p-3 rounded-lg ${
                                                    msg.is_pinned ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-white/5'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-purple-400">
                                                        {(msg.user as any)?.full_name || 'Anonymous'}
                                                    </span>
                                                    <button
                                                        onClick={() => handlePinMessage(msg.id, msg.is_pinned)}
                                                        className={`p-1 rounded hover:bg-white/10 ${
                                                            msg.is_pinned ? 'text-yellow-400' : 'text-gray-500'
                                                        }`}
                                                    >
                                                        <Pin className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-gray-300">{msg.message}</p>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </motion.div>
                                )}

                                {activeTab === 'questions' && (
                                    <motion.div
                                        key="questions"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-3"
                                    >
                                        {questions.map((q) => (
                                            <div
                                                key={q.id}
                                                className={`p-3 rounded-lg ${
                                                    q.is_answered ? 'bg-green-500/10 opacity-60' : 'bg-orange-500/10'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-orange-400">
                                                        {(q.user as any)?.full_name || 'Anonymous'}
                                                    </span>
                                                    {!q.is_answered && (
                                                        <button
                                                            onClick={() => handleAnswerQuestion(q.id)}
                                                            className="p-1 text-gray-400 hover:text-green-400 rounded hover:bg-white/10"
                                                            title="Mark as answered"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-300">{q.message}</p>
                                                {q.is_answered && (
                                                    <span className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> Answered
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        {questions.length === 0 && (
                                            <div className="text-center text-gray-500 py-8">
                                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No questions yet</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === 'viewers' && (
                                    <motion.div
                                        key="viewers"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-2"
                                    >
                                        {viewers.map((viewer) => (
                                            <div
                                                key={viewer.id}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                                    {(viewer.viewer as any)?.avatar_url ? (
                                                        <img
                                                            src={(viewer.viewer as any).avatar_url}
                                                            alt=""
                                                            className="w-full h-full rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-white text-sm font-medium">
                                                            {((viewer.viewer as any)?.full_name || 'A')[0].toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-300">
                                                    {(viewer.viewer as any)?.full_name || 'Anonymous'}
                                                </span>
                                            </div>
                                        ))}
                                        {viewers.length === 0 && (
                                            <div className="text-center text-gray-500 py-8">
                                                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No viewers yet</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Message input */}
                        {activeTab === 'chat' && settings.chatEnabled && (
                            <div className="p-4 border-t border-white/10">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Send a message..."
                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim()}
                                        className="p-2 bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BroadcastStudio;
