/**
 * The Green Room
 * 
 * A premium, immersive interface where authors interview their characters.
 * Features:
 * - Atmospheric, theater-inspired design
 * - Character avatar and presence
 * - Auto-extracted facts displayed as "discoveries"
 * - Suggested questions
 * - Session history
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Send, Sparkles, MessageCircle, User, Lightbulb,
    ChevronDown, ChevronUp, History, Plus, Mic, MicOff,
    Volume2, VolumeX, Star, Zap, BookOpen, Heart,
    Eye, EyeOff, RefreshCw, ArrowLeft, Clock, Tag
} from 'lucide-react';
import { greenRoomService } from '../services/greenRoomService';
import type { 
    CharacterPersona, 
    GreenRoomSession, 
    GreenRoomMessage, 
    ExtractedFact,
    BookProject,
    Character
} from '../types';

interface GreenRoomProps {
    isOpen: boolean;
    onClose: () => void;
    project: BookProject;
    character: Character;
    onPersonaUpdate?: (persona: CharacterPersona) => void;
    userId?: string;
}

export const GreenRoom: React.FC<GreenRoomProps> = ({
    isOpen,
    onClose,
    project,
    character,
    onPersonaUpdate,
    userId
}) => {
    // State
    const [persona, setPersona] = useState<CharacterPersona | null>(null);
    const [session, setSession] = useState<GreenRoomSession | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [showFacts, setShowFacts] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [previousSessions, setPreviousSessions] = useState<GreenRoomSession[]>([]);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [ambientMode, setAmbientMode] = useState(true);
    const [newFactHighlight, setNewFactHighlight] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize persona and session
    useEffect(() => {
        if (isOpen && character) {
            const initialPersona = greenRoomService.initializePersona(character, project);
            setPersona(initialPersona);
            
            const newSession = greenRoomService.createSession(project.id, initialPersona);
            setSession(newSession);
            
            setSuggestedQuestions(greenRoomService.getSuggestedQuestions(initialPersona));
            
            // Load previous sessions if we have a user
            if (userId) {
                greenRoomService.loadSessions(userId, character.id || '').then(setPreviousSessions);
            }
        }
    }, [isOpen, character, project, userId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session?.messages]);

    // Handle sending a message
    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || !session || !persona || isTyping) return;
        
        const message = inputValue.trim();
        setInputValue('');
        setIsTyping(true);
        
        // Optimistically add author message
        const authorMsg: GreenRoomMessage = {
            id: `temp-${Date.now()}`,
            role: 'author',
            content: message,
            timestamp: Date.now()
        };
        setSession(prev => prev ? {
            ...prev,
            messages: [...prev.messages, authorMsg]
        } : null);
        
        try {
            const { updatedSession, updatedPersona, newMessage } = await greenRoomService.sendMessage(
                session,
                persona,
                message,
                {
                    title: project.title,
                    synopsis: project.synopsis,
                    tone: project.tone
                }
            );
            
            setSession(updatedSession);
            setPersona(updatedPersona);
            
            // Highlight new facts
            if (newMessage.extractedFacts && newMessage.extractedFacts.length > 0) {
                setNewFactHighlight(newMessage.extractedFacts[0].id);
                setTimeout(() => setNewFactHighlight(null), 3000);
            }
            
            // Update suggested questions
            setSuggestedQuestions(greenRoomService.getSuggestedQuestions(updatedPersona));
            
            // Notify parent of persona update
            if (onPersonaUpdate) {
                onPersonaUpdate(updatedPersona);
            }
            
            // Save session
            if (userId) {
                greenRoomService.saveSession(userId, updatedSession);
            }
        } catch (error) {
            console.error('Error in Green Room:', error);
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, session, persona, isTyping, project, onPersonaUpdate, userId]);

    // Handle suggested question click
    const handleSuggestionClick = (question: string) => {
        setInputValue(question);
        inputRef.current?.focus();
    };

    // Format timestamp
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center"
            >
                {/* Backdrop with ambient effect */}
                <div 
                    className={`absolute inset-0 transition-all duration-1000 ${
                        ambientMode 
                            ? 'bg-gradient-to-br from-emerald-950 via-slate-950 to-purple-950' 
                            : 'bg-slate-950'
                    }`}
                    onClick={onClose}
                >
                    {/* Ambient particles */}
                    {ambientMode && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-emerald-400/30 rounded-full"
                                    initial={{ 
                                        x: Math.random() * window.innerWidth,
                                        y: Math.random() * window.innerHeight,
                                        scale: 0
                                    }}
                                    animate={{ 
                                        y: [null, Math.random() * -200],
                                        scale: [0, 1, 0],
                                        opacity: [0, 0.6, 0]
                                    }}
                                    transition={{
                                        duration: 4 + Math.random() * 4,
                                        repeat: Infinity,
                                        delay: Math.random() * 2
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Container */}
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="relative w-full max-w-6xl h-[90vh] mx-4 bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative px-6 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 via-transparent to-purple-900/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Character Avatar */}
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/30">
                                        {persona?.avatarUrl ? (
                                            <img src={persona.avatarUrl} alt={persona.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-7 h-7 text-white" />
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                </div>
                                
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="text-emerald-400">The Green Room</span>
                                        <span className="text-white/50">with</span>
                                        <span className="text-white">{persona?.name || character.name}</span>
                                    </h2>
                                    <p className="text-sm text-emerald-300/60 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3" />
                                        Character Interview Session
                                        {session && (
                                            <span className="text-emerald-400/50">
                                                • {session.totalFactsExtracted} facts discovered
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Ambient Toggle */}
                                <button
                                    onClick={() => setAmbientMode(!ambientMode)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        ambientMode ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white/60'
                                    }`}
                                    title="Toggle ambient mode"
                                >
                                    <Sparkles className="w-5 h-5" />
                                </button>
                                
                                {/* History Toggle */}
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        showHistory ? 'bg-purple-500/20 text-purple-400' : 'text-white/40 hover:text-white/60'
                                    }`}
                                    title="View session history"
                                >
                                    <History className="w-5 h-5" />
                                </button>
                                
                                {/* Close */}
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Chat Panel */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {session?.messages.map((msg, index) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`flex ${msg.role === 'author' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] ${msg.role === 'author' ? 'order-2' : 'order-1'}`}>
                                            {/* Message Bubble */}
                                            <div className={`rounded-2xl px-4 py-3 ${
                                                msg.role === 'author'
                                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-md'
                                                    : 'bg-gradient-to-r from-emerald-800/50 to-teal-800/50 text-white border border-emerald-500/20 rounded-bl-md'
                                            }`}>
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                            
                                            {/* Extracted Facts */}
                                            {msg.extractedFacts && msg.extractedFacts.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-2 flex flex-wrap gap-1"
                                                >
                                                    {msg.extractedFacts.map(fact => (
                                                        <motion.span
                                                            key={fact.id}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                                                newFactHighlight === fact.id
                                                                    ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                                                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            }`}
                                                        >
                                                            <Zap className="w-3 h-3" />
                                                            {fact.key.replace(/_/g, ' ')}: {fact.value}
                                                        </motion.span>
                                                    ))}
                                                </motion.div>
                                            )}
                                            
                                            {/* Timestamp */}
                                            <p className={`text-xs text-white/30 mt-1 ${msg.role === 'author' ? 'text-right' : 'text-left'}`}>
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                                
                                {/* Typing Indicator */}
                                {isTyping && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-emerald-800/30 border border-emerald-500/20 rounded-2xl rounded-bl-md px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                                <span className="text-xs text-emerald-400/60 italic">
                                                    {persona?.name} is thinking...
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Suggested Questions */}
                            <AnimatePresence>
                                {showSuggestions && suggestedQuestions.length > 0 && !isTyping && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="px-6 pb-2"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lightbulb className="w-4 h-4 text-yellow-400" />
                                            <span className="text-xs text-yellow-400/80 font-medium">Suggested Questions</span>
                                            <button
                                                onClick={() => setShowSuggestions(false)}
                                                className="ml-auto text-white/30 hover:text-white/50"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedQuestions.slice(0, 3).map((q, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSuggestionClick(q)}
                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/30 rounded-full text-xs text-white/70 hover:text-white transition-all"
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Input Area */}
                            <div className="p-4 border-t border-white/10 bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                            placeholder={`Ask ${persona?.name || 'the character'} anything...`}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                            disabled={isTyping}
                                        />
                                    </div>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isTyping}
                                        className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <Send className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar - Facts & Info */}
                        <div className="hidden lg:flex w-80 border-l border-white/10 bg-slate-900/30 flex-col">
                            {/* Character Card */}
                            <div className="p-4 border-b border-white/10">
                                <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 rounded-xl p-4 border border-emerald-500/20">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden">
                                            {persona?.avatarUrl ? (
                                                <img src={persona.avatarUrl} alt={persona.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-6 h-6 text-white" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{persona?.name}</h3>
                                            <p className="text-xs text-emerald-400/60 capitalize">{persona?.role || 'Character'}</p>
                                        </div>
                                    </div>
                                    
                                    {persona?.voiceStyle && (
                                        <p className="text-xs text-white/50 italic mb-2">
                                            "{persona.voiceStyle}"
                                        </p>
                                    )}
                                    
                                    {/* Quick Stats */}
                                    <div className="flex gap-2 mt-3">
                                        <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-emerald-400">{persona?.extractedFacts.length || 0}</p>
                                            <p className="text-xs text-white/40">Facts</p>
                                        </div>
                                        <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-purple-400">{session?.messages.length || 0}</p>
                                            <p className="text-xs text-white/40">Messages</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Discovered Facts */}
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-white/80 flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-400" />
                                        Discovered Facts
                                    </h4>
                                    <button
                                        onClick={() => setShowFacts(!showFacts)}
                                        className="text-white/30 hover:text-white/50"
                                    >
                                        {showFacts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                
                                {showFacts && persona?.extractedFacts && persona.extractedFacts.length > 0 ? (
                                    <div className="space-y-2">
                                        {persona.extractedFacts.map((fact, i) => (
                                            <motion.div
                                                key={fact.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className={`p-3 rounded-lg border transition-all ${
                                                    newFactHighlight === fact.id
                                                        ? 'bg-yellow-500/20 border-yellow-500/50'
                                                        : 'bg-white/5 border-white/10 hover:border-emerald-500/30'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <Tag className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-emerald-400/80 font-medium capitalize">
                                                            {fact.key.replace(/_/g, ' ')}
                                                        </p>
                                                        <p className="text-sm text-white/80">{fact.value}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : showFacts ? (
                                    <div className="text-center py-8">
                                        <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                        <p className="text-sm text-white/40">
                                            Ask questions to discover facts about {persona?.name}
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Interview Tips */}
                            <div className="p-4 border-t border-white/10">
                                <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-500/20">
                                    <h5 className="text-xs font-medium text-purple-300 mb-1 flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3" />
                                        Interview Tip
                                    </h5>
                                    <p className="text-xs text-white/50">
                                        Ask about emotions and memories. Characters reveal the most when talking about their past.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Session History Sidebar */}
                        <AnimatePresence>
                            {showHistory && (
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 280, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    className="border-l border-white/10 bg-slate-900/50 overflow-hidden"
                                >
                                    <div className="p-4">
                                        <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                            <History className="w-4 h-4 text-purple-400" />
                                            Previous Sessions
                                        </h4>
                                        
                                        {previousSessions.length > 0 ? (
                                            <div className="space-y-2">
                                                {previousSessions.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => {
                                                            setSession(s);
                                                            setShowHistory(false);
                                                        }}
                                                        className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Clock className="w-3 h-3 text-white/40" />
                                                            <span className="text-xs text-white/40">
                                                                {new Date(s.startedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-white/70">
                                                            {s.messages.length} messages
                                                        </p>
                                                        <p className="text-xs text-emerald-400/60">
                                                            {s.totalFactsExtracted} facts discovered
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/40 text-center py-4">
                                                No previous sessions
                                            </p>
                                        )}
                                        
                                        {/* New Session Button */}
                                        <button
                                            onClick={() => {
                                                if (persona) {
                                                    setSession(greenRoomService.createSession(project.id, persona));
                                                }
                                                setShowHistory(false);
                                            }}
                                            className="w-full mt-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-400 flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Session
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GreenRoom;
