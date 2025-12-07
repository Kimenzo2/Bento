import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookProject } from '../types';
import { ChevronLeft, ChevronRight, X, Edit3, Download, Share2, Volume2, Maximize2, Minimize2, Sparkles, BookOpen, ArrowLeft, VolumeX } from 'lucide-react';
import { Particle, generateParticles, updateParticle } from '../utils/particles';
import ExportModal from './ExportModal';
import KDPExportModal from './KDPExportModal';
import { ShareModal } from './BookSharing';
import { useBookSwipeNavigation } from '../hooks/useSwipeGesture';
import AudioPlayer from './AudioPlayer';
import { InteractiveCharacterTutor } from './InteractiveCharacterTutor';
import { screenReaderAnnounce, keyboardNav } from '../services/accessibilityService';

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
    const [isMobile, setIsMobile] = useState(false);
    const [learningMode, setLearningMode] = useState(false);
    const [useVoiceTutor, setUseVoiceTutor] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showKDPExportModal, setShowKDPExportModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const handleShare = () => {
        setShowShareModal(true);
        if (onShare) onShare();
    };

    const handleDownload = () => {
        setShowExportModal(true);
        if (onDownload) onDownload();
    };

    // Detect mobile/tablet
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024); // lg breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Flatten all pages from all chapters into a single array for linear navigation
    const allPages = project.chapters.flatMap(chapter => chapter.pages);
    const totalPages = allPages.length;
    const currentPage = allPages[currentPageIndex];

    // Get current chapter info
    const getCurrentChapterInfo = () => {
        let pageCount = 0;
        for (let i = 0; i < project.chapters.length; i++) {
            const chapter = project.chapters[i];
            if (currentPageIndex < pageCount + chapter.pages.length) {
                const pageInChapter = currentPageIndex - pageCount;
                return {
                    chapterIndex: i,
                    chapterTitle: chapter.title,
                    pageInChapter: pageInChapter,
                    totalPagesInChapter: chapter.pages.length
                };
            }
            pageCount += chapter.pages.length;
        }
        return { chapterIndex: 0, chapterTitle: project.chapters[0]?.title || 'Chapter 1', pageInChapter: 0, totalPagesInChapter: 1 };
    };

    const chapterInfo = getCurrentChapterInfo();

    // Generate floating particles around the book (desktop only)
    useEffect(() => {
        if (isMobile) return;
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
    }, [isMobile]);

    // Update particles animation (desktop only)
    useEffect(() => {
        if (isMobile) return;
        const animationFrame = setInterval(() => {
            setParticles(prev =>
                prev
                    .map(p => updateParticle(p, 0.5))
                    .filter(p => p.opacity > 0)
            );
        }, 50);

        return () => clearInterval(animationFrame);
    }, [isMobile]);

    // Swipe gesture support for mobile navigation
    const { swipeRef } = useBookSwipeNavigation(
        currentPageIndex,
        totalPages,
        (page) => {
            setDirection(page > currentPageIndex ? 1 : -1);
            setCurrentPageIndex(page);
            screenReaderAnnounce.pageChange(page + 1, totalPages);
        }
    );

    // Audio player state
    const [showAudioPlayer, setShowAudioPlayer] = useState(false);
    const pageTexts = allPages.map(p => p.text);

    // Handle keyboard navigation with accessibility
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keyboardNav.handleBookNavigation(e, currentPageIndex, totalPages, (page) => {
                setDirection(page > currentPageIndex ? 1 : -1);
                setCurrentPageIndex(page);
                screenReaderAnnounce.pageChange(page + 1, totalPages);
            });
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPageIndex, totalPages, onClose]);

    // Scroll to top when page changes (mobile)
    useEffect(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentPageIndex, isMobile]);

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

    // Split text into paragraphs for better mobile reading
    const getTextParagraphs = (text: string) => {
        // Split by double newlines or periods followed by spaces
        const sentences = text.split(/(?<=[.!?])\s+/);
        const paragraphs: string[] = [];
        let currentParagraph = '';

        sentences.forEach((sentence, idx) => {
            currentParagraph += sentence + ' ';
            // Create paragraph every 2-3 sentences for readability
            if ((idx + 1) % 3 === 0 || idx === sentences.length - 1) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
            }
        });

        return paragraphs.filter(p => p.length > 0);
    };

    // ============================================
    // MOBILE/TABLET VIEW - Dark scrollable design
    // ============================================
    if (isMobile) {
        return (
            <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex flex-col">
                {/* Mobile Header */}
                <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/10 bg-[#1a1a2e]/95 backdrop-blur-sm safe-area-top">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors p-2 -ml-2 touch-manipulation"
                        title="Close Viewer"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex-1 text-center px-4">
                        <h1 className="text-amber-400 font-bold text-sm truncate flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            Your Story
                        </h1>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleSpeech(); }}
                            className={`p-2 rounded-full transition-all touch-manipulation ${isSpeaking
                                ? 'bg-amber-500 text-white'
                                : 'text-white/60 hover:text-white'
                                }`}
                            title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleShare}
                            className="p-2 text-white/60 hover:text-white transition-colors touch-manipulation"
                            title="Share Story"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>

                        {/* Audio Player Toggle */}
                        <button
                            onClick={() => setShowAudioPlayer(!showAudioPlayer)}
                            className={`p-2.5 rounded-xl transition-colors ${showAudioPlayer
                                    ? 'bg-purple-500/30 text-purple-400'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                            title={showAudioPlayer ? 'Hide Audio Player' : 'Read Aloud'}
                        >
                            {showAudioPlayer ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Audio Player - Collapsible */}
                <AnimatePresence>
                    {showAudioPlayer && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden px-4 pb-3"
                        >
                            <AudioPlayer
                                pages={pageTexts}
                                currentPage={currentPageIndex}
                                onPageChange={(page) => {
                                    setDirection(page > currentPageIndex ? 1 : -1);
                                    setCurrentPageIndex(page);
                                }}
                                compact={true}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Scrollable Content with Swipe Support */}
                <div
                    ref={(el) => {
                        // Combine both refs - use type assertion for the mutable ref
                        (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                        if (swipeRef && 'current' in swipeRef) {
                            (swipeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                        }
                    }}
                    className="flex-1 overflow-y-auto overscroll-contain touch-pan-y"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                    role="region"
                    aria-label={`Story content, page ${currentPageIndex + 1} of ${totalPages}`}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentPageIndex}
                            initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
                            transition={{ duration: 0.3 }}
                            className="pb-32"
                        >
                            {/* Story Title */}
                            <div className="px-5 py-4">
                                <h2 className="text-white text-xl xs:text-2xl font-bold leading-tight">
                                    {project.title}
                                </h2>
                            </div>

                            {/* Chapter/Section Title */}
                            <div className="px-5 pb-4">
                                <h3 className="text-amber-400 text-base xs:text-lg font-semibold flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    {chapterInfo.chapterTitle}
                                </h3>
                            </div>

                            {/* Image Section */}
                            <div className="px-4 pb-5">
                                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 aspect-[4/3] xs:aspect-[16/10]">
                                    {currentPage.imageUrl ? (
                                        <img
                                            src={currentPage.imageUrl}
                                            alt={`Illustration for page ${currentPage.pageNumber}`}
                                            className="w-full h-full object-cover"
                                            loading="eager"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-center text-gray-400">
                                                <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <span className="text-sm">Illustration</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Image overlay gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent opacity-40" />
                                </div>
                            </div>

                            {/* Story Text Content */}
                            <div className="px-5 space-y-4">
                                {getTextParagraphs(currentPage.text).map((paragraph, idx) => (
                                    <p
                                        key={idx}
                                        className="text-gray-200 text-base xs:text-lg leading-relaxed font-serif"
                                        style={{ textAlign: 'justify', hyphens: 'auto' }}
                                    >
                                        {paragraph}
                                    </p>
                                ))}
                            </div>

                            {/* Additional visual break between sections */}
                            {currentPageIndex < totalPages - 1 && (
                                <div className="flex justify-center py-8">
                                    <div className="flex items-center gap-2 text-amber-400/50">
                                        <span className="w-8 h-px bg-amber-400/30" />
                                        <Sparkles className="w-4 h-4" />
                                        <span className="w-8 h-px bg-amber-400/30" />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="flex-shrink-0 px-4 py-3 bg-[#1a1a2e]/95 backdrop-blur-lg border-t border-white/10 safe-area-bottom">
                    <div className="flex items-center justify-between gap-4">
                        {/* Previous Button */}
                        <button
                            onClick={prevPage}
                            disabled={currentPageIndex === 0}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all touch-manipulation min-h-[44px] ${currentPageIndex === 0
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
                                }`}
                            title="Previous Page"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm font-medium hidden xs:inline">Previous</span>
                        </button>

                        {/* Page Indicator */}
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                {allPages.slice(0, 5).map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPageIndex(idx)}
                                        className={`h-2 rounded-full transition-all touch-manipulation ${idx === currentPageIndex
                                            ? 'w-6 bg-amber-400'
                                            : 'w-2 bg-white/30 hover:bg-white/50'
                                            }`}
                                        title={`Go to page ${idx + 1}`}
                                    />
                                ))}
                                {totalPages > 5 && (
                                    <span className="text-white/50 text-xs ml-1">
                                        +{totalPages - 5}
                                    </span>
                                )}
                            </div>
                            <span className="text-white/60 text-sm ml-2">
                                {currentPageIndex + 1}/{totalPages}
                            </span>
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={nextPage}
                            disabled={currentPageIndex === totalPages - 1}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all touch-manipulation min-h-[44px] ${currentPageIndex === totalPages - 1
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-400 active:scale-95'
                                }`}
                        >
                            <span className="text-sm font-medium hidden xs:inline">Next</span>
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // DESKTOP VIEW - Original design with enhancements
    // ============================================
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


            </div>

            {/* Main Book Container with Floating Effect */}
            <motion.div
                className="relative w-full max-w-6xl aspect-[3/4] sm:aspect-[4/5] lg:aspect-[16/9] bg-white rounded-[24px] lg:rounded-[32px] overflow-hidden flex flex-col lg:flex-row border-4 border-white/50"
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
                        className={`w-full lg:w-1/2 h-[55%] sm:h-[60%] lg:h-full relative overflow-hidden bg-cream-base ${currentPage.layoutType === 'learning-only' ? 'hidden' : ''}`}
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
                        className={`w-full lg:w-1/2 h-full p-6 md:p-12 lg:p-16 flex flex-col justify-center bg-white relative ${currentPage.layoutType === 'learning-only' ? 'w-full items-center text-center bg-blue-50' : ''
                            }`}
                    >
                        {currentPage.layoutType !== 'learning-only' && (
                            <div className="prose prose-lg max-w-none">
                                <p className="font-serif text-lg sm:text-xl md:text-2xl leading-relaxed text-charcoal-soft">
                                    {currentPage.text}
                                </p>
                            </div>
                        )}

                        {/* Special Layout for Learning Only */}
                        {currentPage.layoutType === 'learning-only' && (
                            <div className="flex flex-col items-center max-w-2xl">
                                <div className="w-32 h-32 bg-blue-100 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden mb-6">
                                    {project.characters.find(c => c.role === 'mentor')?.visualPrompt ? (
                                        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${project.characters.find(c => c.role === 'mentor')?.name}`} alt="Mentor" className="w-full h-full" />
                                    ) : (
                                        <Sparkles className="w-16 h-16 text-blue-500" />
                                    )}
                                </div>
                                <h3 className="font-heading font-bold text-3xl text-blue-600 mb-4">
                                    {project.characters.find(c => c.role === 'mentor')?.name || "Learning Time!"}
                                </h3>
                                <p className="text-xl text-charcoal-soft mb-8">
                                    {currentPage.learningContent?.mentorDialogue}
                                </p>
                                {currentPage.learningContent?.quiz && (
                                    <div className="w-full bg-white rounded-2xl p-6 shadow-soft-lg text-left">
                                        <p className="font-bold text-blue-800 text-lg mb-4">
                                            {currentPage.learningContent.quiz.question}
                                        </p>
                                        <div className="space-y-3">
                                            {currentPage.learningContent.quiz.options.map((option, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        if (option === currentPage.learningContent?.quiz?.correctAnswer) {
                                                            alert(currentPage.learningContent?.quiz?.explanation);
                                                        } else {
                                                            alert("Try again!");
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 bg-blue-50 rounded-xl text-base text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100"
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

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
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
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
                        onClick={() => setShowKDPExportModal(true)}
                        className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-soft-md hover:shadow-soft-lg transition-all"
                        title="Export for Amazon KDP"
                    >
                        <BookOpen className="w-5 h-5" />
                        <span className="hidden md:inline">Amazon KDP</span>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleShare}
                        className="p-3 rounded-full bg-white/80 text-charcoal-soft hover:bg-white shadow-soft-md transition-colors backdrop-blur-sm"
                        title="Share"
                    >
                        <Share2 className="w-5 h-5" />
                    </motion.button>
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

            {/* Learning Mode Toggle */}
            {project.learningConfig && (
                <div className="absolute top-24 right-6 max-sm:top-auto max-sm:right-4 max-sm:bottom-24 z-20 flex flex-col gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setLearningMode(!learningMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-soft-lg transition-all ${learningMode
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/90 text-blue-500 hover:bg-white'
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        <span className="font-heading font-bold text-sm">Learning Mode</span>
                    </motion.button>
                    
                    {/* Voice Tutor Toggle - Only show when learning mode is active */}
                    {learningMode && currentPage.learningContent && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setUseVoiceTutor(!useVoiceTutor)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-soft-lg transition-all ${useVoiceTutor
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                                : 'bg-white/90 text-green-600 hover:bg-white'
                                }`}
                            title="Toggle voice tutoring with animated character"
                        >
                            {useVoiceTutor ? <Volume2 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            <span className="font-heading font-bold text-sm">🎙️ Voice Tutor</span>
                        </motion.button>
                    )}
                </div>
            )}

            {/* Mentor Overlay - Enhanced with Character Teaching */}
            <AnimatePresence>
                {learningMode && currentPage.learningContent && !useVoiceTutor && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="absolute bottom-24 right-8 max-w-md z-30 pointer-events-none"
                    >
                        <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-6 border-4 border-blue-200 relative pointer-events-auto">
                            {/* Teacher Character Avatar - Use actual character if available */}
                            {(() => {
                                // Find the teacher character - first check for one with teacher role, then any mentor
                                const teacherChar = project.characters.find(c =>
                                    c.teachingStyle || c.role === 'mentor' || c.role === 'teacher' || c.role === 'guide'
                                ) || project.characters.find(c => c.role === 'mentor');

                                return (
                                    <div className="absolute -top-14 -left-6 w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100">
                                        {teacherChar?.imageUrl ? (
                                            <img
                                                src={teacherChar.imageUrl}
                                                alt={teacherChar.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacherChar.name}`;
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Sparkles className="w-12 h-12 text-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="ml-14 mt-2">
                                {/* Teacher Name & Role */}
                                <div className="mb-3">
                                    <h4 className="font-heading font-bold text-blue-700 text-lg">
                                        {project.characters.find(c => c.teachingStyle || c.role === 'mentor')?.name || "Learning Guide"}
                                    </h4>
                                    <span className="text-xs text-blue-500 font-medium">
                                        {project.characters.find(c => c.teachingStyle)?.teachingStyle?.teachingApproach === 'nurturing' && '🌙 Your Gentle Guide'}
                                        {project.characters.find(c => c.teachingStyle)?.teachingStyle?.teachingApproach === 'playful' && '🔥 Your Exciting Coach'}
                                        {project.characters.find(c => c.teachingStyle)?.teachingStyle?.teachingApproach === 'socratic' && '⚔️ Your Challenger'}
                                        {project.characters.find(c => c.teachingStyle)?.teachingStyle?.teachingApproach === 'storytelling' && '⚓ Your Storyteller'}
                                        {!project.characters.find(c => c.teachingStyle) && '✨ Learning Helper'}
                                    </span>
                                </div>

                                {/* Topic Badge */}
                                {currentPage.learningContent.topic && (
                                    <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold mb-3">
                                        📚 {currentPage.learningContent.topic}
                                    </div>
                                )}

                                {/* Mentor Dialogue with character styling */}
                                <div className="bg-white/80 rounded-2xl p-4 mb-4 border border-blue-100">
                                    <p className="text-charcoal-soft text-sm leading-relaxed italic">
                                        "{currentPage.learningContent.mentorDialogue}"
                                    </p>
                                </div>

                                {/* Quiz Section */}
                                {currentPage.learningContent.quiz && (
                                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                                        <p className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2">
                                            <span className="text-lg">🤔</span>
                                            {currentPage.learningContent.quiz.question}
                                        </p>
                                        <div className="space-y-2">
                                            {currentPage.learningContent.quiz.options.map((option, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        if (option === currentPage.learningContent?.quiz?.correctAnswer) {
                                                            // Show success with character's encouragement style
                                                            const teacherChar = project.characters.find(c => c.teachingStyle);
                                                            const celebration = teacherChar?.teachingStyle?.encouragementStyle || "That's correct!";
                                                            alert(`🎉 ${celebration}\n\n${currentPage.learningContent?.quiz?.explanation}`);
                                                        } else {
                                                            // Show encouragement with character's correction style
                                                            const teacherChar = project.characters.find(c => c.teachingStyle);
                                                            const encouragement = teacherChar?.teachingStyle?.correctionStyle || "Try again!";
                                                            alert(`💪 ${encouragement}`);
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 bg-white rounded-xl text-sm text-blue-700 hover:bg-blue-100 hover:scale-[1.02] transition-all border border-blue-100 shadow-sm"
                                                >
                                                    <span className="font-medium">{String.fromCharCode(65 + idx)}.</span> {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Character's signature if available */}
                                {project.characters.find(c => c.voiceProfile?.catchphrases)?.voiceProfile?.catchphrases?.[0] && (
                                    <div className="mt-3 text-right">
                                        <span className="text-xs text-cocoa-light italic">
                                            "{project.characters.find(c => c.voiceProfile?.catchphrases)?.voiceProfile?.catchphrases?.[0]}"
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Interactive Voice Tutor - Talking Tom Style */}
                {learningMode && currentPage.learningContent && useVoiceTutor && (() => {
                    const teacherChar = project.characters.find(c =>
                        c.teachingStyle || c.role === 'mentor' || c.role === 'teacher' || c.role === 'guide'
                    ) || project.characters.find(c => c.role === 'mentor');

                    return teacherChar ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 100 }}
                            className="absolute bottom-24 right-8 z-30"
                        >
                            <InteractiveCharacterTutor
                                character={teacherChar}
                                learningContent={currentPage.learningContent}
                                onQuizComplete={(isCorrect) => {
                                    if (isCorrect) {
                                        console.log('Quiz answered correctly!');
                                    }
                                }}
                                autoStart={true}
                            />
                            {/* Toggle back to visual mode */}
                            <button
                                onClick={() => setUseVoiceTutor(false)}
                                className="absolute -top-3 -right-3 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
                                title="Switch to visual mode"
                            >
                                <VolumeX className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ) : null;
                })()}
            </AnimatePresence>

            {showExportModal && (
                <ExportModal
                    isOpen={true}
                    book={{
                        id: project.id,
                        title: project.title,
                        synopsis: project.synopsis || '',
                        coverImage: project.chapters[0]?.pages[0]?.imageUrl,
                        project: project,
                        savedAt: new Date(),
                        lastModified: new Date(),
                    }}
                    onClose={() => setShowExportModal(false)}
                />
            )}

            {showKDPExportModal && (
                <KDPExportModal
                    project={project}
                    isOpen={true}
                    onClose={() => setShowKDPExportModal(false)}
                />
            )}

            {showShareModal && (
                <ShareModal
                    isOpen={true}
                    onClose={() => setShowShareModal(false)}
                    book={project}
                />
            )}
        </div>
    );
};

export default StorybookViewer;
