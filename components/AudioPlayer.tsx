import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Play, 
    Pause, 
    Square, 
    SkipBack, 
    SkipForward, 
    Volume2, 
    VolumeX,
    Settings,
    Mic,
    X
} from 'lucide-react';
import { useAudioImmersion, NarrationOptions } from '../services/audioImmersionService';

interface AudioPlayerProps {
    pages: string[];
    currentPage: number;
    onPageChange?: (page: number) => void;
    compact?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
    pages,
    currentPage,
    onPageChange,
    compact = false
}) => {
    const audio = useAudioImmersion();
    const [showSettings, setShowSettings] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [settings, setSettings] = useState<NarrationOptions>({
        rate: 0.9,
        pitch: 1,
        volume: 1
    });

    // Load book pages when they change
    useEffect(() => {
        if (pages.length > 0) {
            audio.loadBook(pages);
        }
    }, [pages]);

    // Sync page with narration
    useEffect(() => {
        if (audio.isPlaying && audio.currentPage !== currentPage) {
            onPageChange?.(audio.currentPage);
        }
    }, [audio.currentPage, audio.isPlaying]);

    const handlePlayPause = () => {
        if (audio.isPlaying) {
            if (audio.isPaused) {
                audio.resume();
            } else {
                audio.pause();
            }
        } else {
            audio.play(currentPage);
        }
    };

    const handleStop = () => {
        audio.stop();
    };

    const handleMuteToggle = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        audio.setOptions({ volume: newMuted ? 0 : settings.volume });
    };

    const handleSettingChange = (key: keyof NarrationOptions, value: number) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        audio.setOptions(newSettings);
    };

    if (!audio.isSupported) {
        return null; // TTS not supported in this browser
    }

    if (compact) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-700/50"
            >
                <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                >
                    {audio.isPlaying && !audio.isPaused ? (
                        <Pause className="w-4 h-4" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                </button>
                
                {audio.isPlaying && (
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: 'auto' }}
                        className="flex items-center gap-2"
                    >
                        <button
                            onClick={audio.previousPage}
                            disabled={audio.currentPage === 0}
                            className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-400 disabled:opacity-50 transition-colors"
                        >
                            <SkipBack className="w-3.5 h-3.5" />
                        </button>
                        
                        <span className="text-xs text-slate-400 min-w-[40px] text-center">
                            {audio.currentPage + 1}/{pages.length}
                        </span>
                        
                        <button
                            onClick={audio.nextPage}
                            disabled={audio.currentPage >= pages.length - 1}
                            className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-400 disabled:opacity-50 transition-colors"
                        >
                            <SkipForward className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                            onClick={handleStop}
                            className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-400 transition-colors"
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-lg rounded-2xl border border-slate-700/50 p-4 shadow-xl"
        >
            {/* Main Controls */}
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                    onClick={handlePlayPause}
                    className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg shadow-purple-500/25"
                >
                    {audio.isPlaying && !audio.isPaused ? (
                        <Pause className="w-6 h-6" />
                    ) : (
                        <Play className="w-6 h-6 ml-0.5" />
                    )}
                </button>

                {/* Progress Bar */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">
                            Page {audio.currentPage + 1} of {pages.length}
                        </span>
                        <span className="text-xs text-slate-400">
                            {Math.round(audio.progress * 100)}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${audio.progress * 100}%` }}
                            transition={{ duration: 0.1 }}
                        />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={audio.previousPage}
                        disabled={audio.currentPage === 0}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 disabled:opacity-50 transition-colors"
                    >
                        <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                        onClick={audio.nextPage}
                        disabled={audio.currentPage >= pages.length - 1}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 disabled:opacity-50 transition-colors"
                    >
                        <SkipForward className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleStop}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
                    >
                        <Square className="w-5 h-5" />
                    </button>
                </div>

                {/* Volume & Settings */}
                <div className="flex items-center gap-1 border-l border-slate-700 pl-3">
                    <button
                        onClick={handleMuteToggle}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg hover:bg-slate-700/50 transition-colors ${
                            showSettings ? 'text-purple-400 bg-slate-700/50' : 'text-slate-400'
                        }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 mt-4 border-t border-slate-700/50 space-y-4">
                            {/* Speed */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-slate-400">Reading Speed</label>
                                    <span className="text-xs text-slate-500">{settings.rate}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.5"
                                    step="0.1"
                                    value={settings.rate}
                                    onChange={(e) => handleSettingChange('rate', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            {/* Pitch */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-slate-400">Voice Pitch</label>
                                    <span className="text-xs text-slate-500">{settings.pitch}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.5"
                                    step="0.1"
                                    value={settings.pitch}
                                    onChange={(e) => handleSettingChange('pitch', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            {/* Volume */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-slate-400">Volume</label>
                                    <span className="text-xs text-slate-500">{Math.round(settings.volume! * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings.volume}
                                    onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            {/* Voice Selection */}
                            {audio.childFriendlyVoices.length > 0 && (
                                <div>
                                    <label className="text-sm text-slate-400 mb-2 block">Voice</label>
                                    <select
                                        onChange={(e) => {
                                            const voice = audio.voices.find(v => v.name === e.target.value);
                                            if (voice) audio.setOptions({ voice });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">Auto-select</option>
                                        {audio.childFriendlyVoices.map((voice) => (
                                            <option key={voice.name} value={voice.name}>
                                                {voice.name} ({voice.lang})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default AudioPlayer;
