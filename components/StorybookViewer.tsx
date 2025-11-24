import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookProject } from '../types';
import { ChevronLeft, ChevronRight, X, Edit3, Download, Share2, Volume2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { Particle, generateParticles, updateParticle } from '../utils/particles';

interface StorybookViewerProps {
    project: BookProject;
    onClose: () => void;
    onEdit: () => void;
    onDownload: () => void;
    onShare: () => void;
}

const StorybookViewer: React.FC<StorybookViewerProps> = ({
    project,
    onClose,
    onEdit,
    onDownload,
    onShare
}) => {
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [direction, setDirection] = useState(1);

    // Flatten all pages from all chapters into a single array for linear navigation
    const allPages = project.chapters.flatMap(chapter => chapter.pages);
    const totalPages = allPages.length;
    const currentPage = allPages[currentPageIndex];

    // Generate floating particles around the book
    useEffect(() => {
        const interval = setInterval(() => {
            const newParticles = generateParticles(
                3,
                window.innerWidth / 2,
                window.innerHeight / 2,
                300,
                'sparkle'
            );
            setParticles(prev => [...prev, ...newParticles].slice(-30));
        }, 800);

        return () => clearInterval(interval);
    }, []);

    // Update particles animation
    useEffect(() => {
        const animationFrame = setInterval(() => {
            setParticles(prev =>
                prev
                    .map(p => updateParticle(p, 0.5))
                    .filter(p => p.opacity > 0)
            );
        }, 50);

        return () => clearInterval(animationFrame);
    }, []);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextPage();
            if (e.key === 'ArrowLeft') prevPage();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPageIndex]);

    const nextPage = () => {
        if (currentPageIndex < totalPages - 1) {
            setDirection(1);
            setCurrentPageIndex(prev => prev + 1);
        }
    };

    const prevPage = () => {
        if (currentPageIndex > 0) {
            setDirection(-1);
            setCurrentPageIndex(prev => prev - 1);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const toggleSpeech = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(currentPage.text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Stop speech when page changes or component unmounts
    useEffect(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return () => {
            window.speechSynthesis.cancel();
        };
    }, [currentPageIndex]);

    // Get background gradient based on story tone
    const getBackgroundGradient = () => {
        const tone = project.tone.toLowerCase();
        if (tone.includes('playful') || tone.includes('funny')) {
            return 'from-[#FFE8D6] to-[#FFF8DC]'; // Peach to Butter
        } else if (tone.includes('serious') || tone.includes('dramatic')) {
            return 'from-[#E8D5F2] to-[#D5F2E3]'; // Lavender to Mint
        } else if (tone.includes('educational')) {
            return 'from-[#D5F2E3] to-[#FFF8DC]'; // Mint to Butter
        } else {
            return 'from-[#FFFBF0] to-[#FFE8D6]'; // Cream to Peach
        }
    };

    return (
        <div className={`fixed inset-0 z-50 bg-gradient-to-br ${getBackgroundGradient()} flex flex-col items-center justify-center p-4 sm:p-8 animate-fadeIn transition-all duration-700`}>

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particles.map(particle => (
                    <motion.div
                        key={particle.id}
                        className="absolute"
                        style={{
                            left: `${particle.x}px`,
                            top: `${particle.y}px`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: particle.opacity }}
                    >
                        <Sparkles
                            className="w-full h-full"
                            style={{
                                color: particle.color,
                                filter: `drop-shadow(0 0 ${particle.size * 2}px ${particle.color})`,
                            }}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-white/60 to-transparent backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onClose}
                        className="p-3 rounded-full bg-white/80 text-charcoal-soft hover:bg-white shadow-soft-md transition-colors backdrop-blur-sm"
                    >
                        <X className="w-6 h-6" />
                    </motion.button>
                    <h2 className="text-charcoal-soft font-heading font-bold text-2xl hidden sm:block">{project.title}</h2>
                </div>

                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onEdit}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-heading font-bold shadow-soft-lg hover:shadow-soft-xl transition-all"
                    >
                        <Edit3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onDownload}
                        className="p-3 rounded-full bg-white/80 text-charcoal-soft hover:bg-white shadow-soft-md transition-colors backdrop-blur-sm"
                        title="Download PDF"
                    >
                        <Download className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onShare}
                        className="p-3 rounded-full bg-white/80 text-charcoal-soft hover:bg-white shadow-soft-md transition-colors backdrop-blur-sm"
                        title="Share"
                    >
                        <Share2 className="w-5 h-5" />
                    </motion.button>
                </div>
            </div>

            {/* Main Book Container with Floating Effect */}
            <motion.div
                className="relative w-full max-w-6xl aspect-[16/9] bg-white rounded-[32px] overflow-hidden flex border-4 border-white/50"
                style={{
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5)',
                }}
                animate={{
                    y: [0, -10, 0],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                onClick={(e) => {
                    // Click right side to advance, left side to go back
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (x > rect.width / 2) nextPage();
                    else prevPage();
                }}
            >
                {/* Left: Image with Page Curl Effect */}
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={`image-${currentPageIndex}`}
                        custom={direction}
                        initial={{ opacity: 0, rotateY: direction > 0 ? 30 : -30 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        exit={{ opacity: 0, rotateY: direction > 0 ? -30 : 30 }}
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                        className="w-1/2 h-full relative overflow-hidden bg-cream-base"
                        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
                    >
                        {currentPage.imageUrl ? (
                            <img
                                src={currentPage.imageUrl}
                                alt={`Page ${currentPage.pageNumber}`}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-cocoa-light bg-gradient-to-br from-cream-base to-peach-soft">
                                <span className="text-sm font-body">✨ Illustration</span>
                            </div>
                        )}

                        {/* Page Number Overlay */}
                        <div className="absolute bottom-6 left-6 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-charcoal-soft font-heading font-bold text-sm shadow-soft-sm">
                            {currentPageIndex + 1} / {totalPages}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Right: Text with Smooth Transition */}
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={`text-${currentPageIndex}`}
                        custom={direction}
                        initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="w-1/2 h-full p-8 md:p-16 flex flex-col justify-center bg-white relative"
                    >
                        <div className="prose prose-lg max-w-none">
                            <p className="font-serif text-xl md:text-2xl leading-relaxed text-charcoal-soft">
                                {currentPage.text}
                            </p>
                        </div>

                        {/* Audio Control */}
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); toggleSpeech(); }}
                            className={`absolute top-8 right-8 p-3 rounded-full transition-all shadow-soft-md ${isSpeaking
                                ? 'bg-gradient-to-r from-coral-burst to-gold-sunshine text-white'
                                : 'bg-white/80 text-cocoa-light hover:text-coral-burst backdrop-blur-sm'
                                }`}
                        >
                            <Volume2 className="w-6 h-6" />
                        </motion.button>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows */}
                {currentPageIndex > 0 && (
                    <motion.button
                        whileHover={{ scale: 1.1, x: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); prevPage(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/80 text-coral-burst hover:bg-white transition-all backdrop-blur-sm shadow-soft-lg"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </motion.button>
                )}
                {currentPageIndex < totalPages - 1 && (
                    <motion.button
                        whileHover={{ scale: 1.1, x: 5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); nextPage(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/80 text-coral-burst hover:bg-white transition-all backdrop-blur-sm shadow-soft-lg"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </motion.button>
                )}
            </motion.div>

            {/* Bottom Controls */}
            <div className="absolute bottom-6 flex items-center gap-4 z-10">
                <div className="flex gap-2 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-soft-lg">
                    {allPages.map((_, idx) => (
                        <motion.div
                            key={idx}
                            className={`h-2 rounded-full transition-all duration-300 ${idx === currentPageIndex
                                ? 'w-8 bg-gradient-to-r from-coral-burst to-gold-sunshine'
                                : 'w-2 bg-cocoa-light/30 hover:bg-cocoa-light/50'
                                }`}
                            whileHover={{ scale: idx !== currentPageIndex ? 1.2 : 1 }}
                            onClick={() => setCurrentPageIndex(idx)}
                            style={{ cursor: 'pointer' }}
                        />
                    ))}
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleFullscreen}
                    className="p-3 rounded-full bg-white/80 text-cocoa-light hover:text-charcoal-soft backdrop-blur-sm shadow-soft-md transition-colors"
                >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </motion.button>
            </div>

        </div>
    );
};

export default StorybookViewer;
