import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Maximize2, X } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface VideoStory {
    id: string;
    title: string;
    thumbnail: string; // URL or color
    videoUrl?: string; // In real app, this would be a URL
    duration: string;
}

const stories: VideoStory[] = [
    { id: '1', title: 'Smart Editor Demo', thumbnail: 'bg-emerald-100', duration: '0:45' },
    { id: '2', title: 'Style Consistency', thumbnail: 'bg-indigo-100', duration: '1:12' },
    { id: '3', title: 'One-Click Export', thumbnail: 'bg-coral-burst/10', duration: '0:30' },
    { id: '4', title: 'Character Design', thumbnail: 'bg-gold-sunshine/10', duration: '0:55' }
];

export const FeatureVideoStories: React.FC<{ tier: TierConfig }> = ({ tier }) => {
    const [activeStory, setActiveStory] = useState<string | null>(null);

    return (
        <div className="py-8 overflow-x-auto">
            <div className="flex gap-4 md:grid md:grid-cols-4 min-w-[600px] md:min-w-0 px-4 md:px-0">
                {stories.map((story) => {
                    const isActive = activeStory === story.id;
                    return (
                        <motion.div
                            key={story.id}
                            layoutId={`story-${story.id}`}
                            onClick={() => setActiveStory(story.id)}
                            className={`relative rounded-2xl overflow-hidden cursor-pointer group aspect-[9/16] transition-all duration-300 ${story.thumbnail}`}
                        >
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />

                            {/* Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Play className="w-4 h-4 text-white fill-white" />
                                </div>
                            </div>

                            {/* Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                <div className="text-white font-bold text-sm mb-1">{story.title}</div>
                                <div className="text-white/60 text-xs flex items-center gap-1">
                                    <Play className="w-3 h-3" /> {story.duration}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Expanded Modal (Mockup) */}
            {activeStory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setActiveStory(null)}>
                    <motion.div
                        layoutId={`story-${activeStory}`}
                        className="relative w-full max-w-md bg-charcoal-soft rounded-3xl overflow-hidden aspect-[9/16] shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => setActiveStory(null)} className="absolute top-4 right-4 z-20 p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
                            <X className="w-5 h-5" />
                        </button>

                        {/* Mock Player */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                            {startStory(activeStory)?.videoUrl ? (
                                <video src={startStory(activeStory)?.videoUrl} autoPlay controls className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-8">
                                    <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center mx-auto mb-4 animate-pulse relative">
                                        <div className="absolute inset-0 bg-white/10 rounded-full animate-ping" />
                                        <Play className="w-8 h-8 text-white/50 relative z-10" />
                                    </div>
                                    <p className="text-white font-bold text-lg mb-2">{startStory(activeStory)?.title}</p>
                                    <p className="text-white/50 font-mono text-xs">Video placeholder active</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

function startStory(id: string) {
    return stories.find(s => s.id === id);
}
