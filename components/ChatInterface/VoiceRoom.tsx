import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, Headphones, VolumeX, PhoneOff,
    Monitor, Settings, Users, Volume2
} from 'lucide-react';
import { VoiceParticipant } from './types';

interface VoiceRoomProps {
    channelName: string;
    participants: VoiceParticipant[];
    isConnected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    currentUserId: string;
}

const VoiceRoom: React.FC<VoiceRoomProps> = ({
    channelName,
    participants,
    isConnected,
    onConnect,
    onDisconnect,
    currentUserId,
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const currentUser = participants.find(p => p.id === currentUserId);

    if (!isConnected) {
        return (
            <motion.div
                className="p-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--chat-mint-breeze)]/20 flex items-center justify-center">
                    <Volume2 size={32} className="text-[var(--chat-mint-breeze)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--chat-text-primary)] mb-2">
                    {channelName}
                </h3>
                <p className="text-sm text-[var(--chat-text-muted)] mb-4">
                    {participants.length} {participants.length === 1 ? 'person' : 'people'} in voice
                </p>
                <motion.button
                    className="px-6 py-3 bg-[var(--chat-mint-breeze)] text-[var(--chat-text-primary)] font-semibold rounded-xl shadow-lg"
                    onClick={onConnect}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Join Voice
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div className="chat-voice-room">
            {/* Header */}
            <div className="chat-voice-room-header">
                <div className="chat-voice-room-title">
                    <Volume2 size={18} className="text-[var(--chat-mint-breeze)]" />
                    {channelName}
                </div>
                <div className="chat-voice-room-live">
                    <span className="chat-voice-room-live-dot" />
                    LIVE
                </div>
            </div>

            {/* Participants Grid */}
            <div className="chat-voice-participants-grid">
                <AnimatePresence mode="popLayout">
                    {participants.map((participant) => (
                        <motion.div
                            key={participant.id}
                            className={`chat-voice-participant-card ${participant.isSpeaking ? 'speaking' : ''}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            layout
                        >
                            <div className="chat-voice-participant-card-avatar">
                                <img
                                    src={participant.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`}
                                    alt={participant.displayName}
                                />
                                {participant.isMuted && (
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                        <MicOff size={10} className="text-white" />
                                    </div>
                                )}
                                {participant.isSpeaking && !participant.isMuted && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full border-2 border-[var(--chat-mint-breeze)]"
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    />
                                )}
                            </div>
                            <span className="chat-voice-participant-card-name">
                                {participant.displayName}
                                {participant.id === currentUserId && ' (You)'}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="chat-voice-controls">
                <motion.button
                    className={`chat-voice-control-btn ${isMuted ? 'active' : ''}`}
                    onClick={() => setIsMuted(!isMuted)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        background: isMuted ? '#EF4444' : 'var(--chat-bg-tertiary)',
                        color: isMuted ? 'white' : 'var(--chat-text-secondary)'
                    }}
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </motion.button>

                <motion.button
                    className={`chat-voice-control-btn ${isDeafened ? 'active' : ''}`}
                    onClick={() => setIsDeafened(!isDeafened)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        background: isDeafened ? '#EF4444' : 'var(--chat-bg-tertiary)',
                        color: isDeafened ? 'white' : 'var(--chat-text-secondary)'
                    }}
                >
                    {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
                </motion.button>

                <motion.button
                    className={`chat-voice-control-btn ${isScreenSharing ? 'active' : ''}`}
                    onClick={() => setIsScreenSharing(!isScreenSharing)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        background: isScreenSharing ? 'var(--chat-coral-burst)' : 'var(--chat-bg-tertiary)',
                        color: isScreenSharing ? 'white' : 'var(--chat-text-secondary)'
                    }}
                >
                    <Monitor size={20} />
                </motion.button>

                <motion.button
                    className="chat-voice-control-btn danger"
                    onClick={onDisconnect}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <PhoneOff size={20} />
                </motion.button>
            </div>

            {/* Connection Info */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--chat-text-muted)]">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Voice Connected
                <span className="mx-2">•</span>
                <Users size={12} />
                {participants.length} connected
            </div>
        </div>
    );
};

export default VoiceRoom;
