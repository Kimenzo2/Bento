import { AnimatePresence, motion } from 'framer-motion';
import {
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type NarrationOptions, useAudioImmersion } from '../services/audioImmersionService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  compact = false,
}) => {
  const audio = useAudioImmersion();
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [settings, setSettings] = useState<NarrationOptions>({
    rate: 0.9,
    pitch: 1,
    volume: 1,
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
        className="flex items-center gap-2 px-3 py-2 bg-surface/90  rounded-full border border-peach-soft"
      >
        <Button
          variant="primary"
          size="icon"
          onClick={handlePlayPause}
          className="p-2 rounded-full bg-coral-burst hover:bg-coral-hover text-white"
        >
          {audio.isPlaying && !audio.isPaused ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        {audio.isPlaying && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 'auto' }}
            className="flex items-center gap-2"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={audio.previousPage}
              disabled={audio.currentPage === 0}
              className="p-1.5 rounded-full hover:bg-peach-soft/50 text-cocoa-light"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>

            <span className="text-xs text-cocoa-light min-w-10 text-center">
              {audio.currentPage + 1}/{pages.length}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={audio.nextPage}
              disabled={audio.currentPage >= pages.length - 1}
              className="p-1.5 rounded-full hover:bg-peach-soft/50 text-cocoa-light"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="p-1.5 rounded-full hover:bg-peach-soft/50 text-cocoa-light"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface/95  rounded-2xl border border-peach-soft p-4"
    >
      {/* Main Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <Button
          variant="primary"
          size="icon"
          onClick={handlePlayPause}
          className="p-3 rounded-full bg-linear-to-r from-coral-burst to-gold-sunshine hover:from-coral-hover hover:to-gold-sunshine text-white border border-white/20"
        >
          {audio.isPlaying && !audio.isPaused ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>

        {/* Progress Bar */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-cocoa-light">
              Page {audio.currentPage + 1} of {pages.length}
            </span>
            <span className="text-xs text-cocoa-light">{Math.round(audio.progress * 100)}%</span>
          </div>
          <div className="h-1.5 bg-peach-soft rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-linear-to-r from-coral-burst to-gold-sunshine"
              initial={{ width: 0 }}
              animate={{ width: `${audio.progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={audio.previousPage}
            disabled={audio.currentPage === 0}
            className="p-2 hover:bg-peach-soft/50 text-cocoa-light"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={audio.nextPage}
            disabled={audio.currentPage >= pages.length - 1}
            className="p-2 hover:bg-peach-soft/50 text-cocoa-light"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStop}
            className="p-2 hover:bg-peach-soft/50 text-cocoa-light"
          >
            <Square className="w-5 h-5" />
          </Button>
        </div>

        {/* Volume & Settings */}
        <div className="flex items-center gap-1 border-l border-peach-soft pl-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMuteToggle}
            className="p-2 hover:bg-peach-soft/50 text-cocoa-light"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 hover:bg-peach-soft/50 ${
              showSettings ? 'text-coral-burst bg-peach-soft/50' : 'text-cocoa-light'
            }`}
          >
            <Settings className="w-5 h-5" />
          </Button>
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
            <div className="pt-4 mt-4 border-t border-peach-soft/50 space-y-4">
              {/* Speed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-cocoa-light">Reading Speed</Label>
                  <span className="text-xs text-cocoa-light">{settings.rate}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.rate}
                  onChange={(e) => handleSettingChange('rate', Number.parseFloat(e.target.value))}
                  className="w-full h-2 bg-peach-soft rounded-full appearance-none cursor-pointer accent-coral-burst"
                />
              </div>

              {/* Pitch */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-cocoa-light">Voice Pitch</Label>
                  <span className="text-xs text-cocoa-light">{settings.pitch}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.pitch}
                  onChange={(e) => handleSettingChange('pitch', Number.parseFloat(e.target.value))}
                  className="w-full h-2 bg-peach-soft rounded-full appearance-none cursor-pointer accent-coral-burst"
                />
              </div>

              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-cocoa-light">Volume</Label>
                  <span className="text-xs text-cocoa-light">
                    {Math.round(settings.volume! * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => handleSettingChange('volume', Number.parseFloat(e.target.value))}
                  className="w-full h-2 bg-peach-soft rounded-full appearance-none cursor-pointer accent-coral-burst"
                />
              </div>

              {/* Voice Selection */}
              {audio.childFriendlyVoices.length > 0 && (
                <div>
                  <Label className="text-cocoa-light mb-2">Voice</Label>
                  <Select
                    onValueChange={(v) => {
                      const voice = audio.voices.find((voice) => voice.name === v);
                      if (voice) audio.setOptions({ voice });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auto-select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-select</SelectItem>
                      {audio.childFriendlyVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
