import { IcoBook } from './IconscoutIcons';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  List,
  Maximize2,
  Minimize2,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBookSwipeNavigation } from '../hooks/useSwipeGesture';
import { keyboardNav, screenReaderAnnounce } from '../services/accessibilityService';
import type { BookProject } from '../types';
import AudioPlayer from './AudioPlayer';
import { ShareModal } from './BookSharing';
import ExportModal from './ExportModal';
import { InteractiveCharacterTutor } from './InteractiveCharacterTutor';
import KDPExportModal from './KDPExportModal';
import { Button } from '@components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StorybookViewerProps {
  project: BookProject;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onShare: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOOLBAR_HIDE_DELAY = 3000;

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

// ─── Component ───────────────────────────────────────────────────────────────

const StorybookViewer: React.FC<StorybookViewerProps> = ({
  project,
  onClose,
  onEdit,
  onDownload,
  onShare,
}) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showTOC, setShowTOC] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showKDPExportModal, setShowKDPExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const [useVoiceTutor, setUseVoiceTutor] = useState(false);

  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────
  const allPages = useMemo(
    () => project.chapters.flatMap((chapter) => chapter.pages),
    [project.chapters],
  );
  const totalPages = allPages.length;
  const currentPage = allPages[currentPageIndex];
  const pageTexts = useMemo(() => allPages.map((p) => p.text), [allPages]);

  const chapterInfo = useMemo(() => {
    let pageCount = 0;
    for (let i = 0; i < project.chapters.length; i++) {
      const chapter = project.chapters[i];
      if (currentPageIndex < pageCount + chapter.pages.length) {
        return {
          chapterIndex: i,
          chapterTitle: chapter.title,
          pageInChapter: currentPageIndex - pageCount,
          totalPagesInChapter: chapter.pages.length,
        };
      }
      pageCount += chapter.pages.length;
    }
    return {
      chapterIndex: 0,
      chapterTitle: project.chapters[0]?.title || 'Chapter 1',
      pageInChapter: 0,
      totalPagesInChapter: 1,
    };
  }, [currentPageIndex, project.chapters]);

  const progress = totalPages > 1 ? (currentPageIndex / (totalPages - 1)) * 100 : 100;

  // ── Navigation ───────────────────────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPageIndex(page);
        screenReaderAnnounce.pageChange(page + 1, totalPages);
      }
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (currentPageIndex < totalPages - 1) goToPage(currentPageIndex + 1);
  }, [currentPageIndex, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPageIndex > 0) goToPage(currentPageIndex - 1);
  }, [currentPageIndex, goToPage]);

  // ── Toolbar auto-hide ────────────────────────────────────────────────────
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    toolbarTimerRef.current = setTimeout(() => setShowToolbar(false), TOOLBAR_HIDE_DELAY);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, [resetToolbarTimer]);

  const handleInteraction = useCallback(() => {
    resetToolbarTimer();
  }, [resetToolbarTimer]);

  // ── Swipe support ────────────────────────────────────────────────────────
  const { swipeRef } = useBookSwipeNavigation(currentPageIndex, totalPages, goToPage);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyboardNav.handleBookNavigation(e, currentPageIndex, totalPages, goToPage);
      if (e.key === 'Escape') {
        if (showTOC) setShowTOC(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, totalPages, goToPage, onClose, showTOC]);

  // ── Scroll to top on page change ─────────────────────────────────────────
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPageIndex]);

  // ── Speech synthesis ─────────────────────────────────────────────────────
  const toggleSpeech = useCallback(() => {
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
  }, [isSpeaking, currentPage.text]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    return () => { window.speechSynthesis.cancel(); };
  }, [currentPageIndex]);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  // ── Text paragraphs ─────────────────────────────────────────────────────
  const paragraphs = useMemo(() => {
    const sentences = currentPage.text.split(/(?<=[.!?])\s+/);
    const result: string[] = [];
    let current = '';
    sentences.forEach((sentence, idx) => {
      current += `${sentence} `;
      if ((idx + 1) % 3 === 0 || idx === sentences.length - 1) {
        result.push(current.trim());
        current = '';
      }
    });
    return result.filter((p) => p.length > 0);
  }, [currentPage.text]);

  // ── Learning mode character ──────────────────────────────────────────────
  const teacherChar = useMemo(
    () =>
      project.characters.find(
        (c) => c.teachingStyle || c.role === 'mentor' || c.role === 'teacher' || c.role === 'guide',
      ) || project.characters.find((c) => c.role === 'mentor'),
    [project.characters],
  );

  // ── Build chapter index for TOC ──────────────────────────────────────────
  const tocEntries = useMemo(() => {
    let pageOffset = 0;
    return project.chapters.map((chapter, idx) => {
      const entry = { title: chapter.title, startPage: pageOffset, chapterIndex: idx };
      pageOffset += chapter.pages.length;
      return entry;
    });
  }, [project.chapters]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="fixed inset-0 z-[100] bg-cream-base dark:bg-[#1A1412] flex flex-col"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onClick={handleInteraction}
    >
      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-50 h-[3px] bg-peach-soft/30">
        <motion.div
          className="h-full bg-gradient-to-r from-coral-burst to-gold-sunshine"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* ── Top toolbar ───────────────────────────────────────────────────── */}
      <motion.header
        className="absolute top-0 left-0 right-0 z-40 px-4 md:px-6 pt-4 pb-3"
        initial={false}
        animate={{ opacity: showToolbar ? 1 : 0, y: showToolbar ? 0 : -20 }}
        transition={{ duration: 0.25 }}
        style={{ pointerEvents: showToolbar ? 'auto' : 'none' }}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Left: close + title */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
              title="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-sm md:text-base text-charcoal-soft dark:text-[#EAE0D5] truncate">
                {project.title}
              </h1>
              <p className="text-xs text-cocoa-light truncate">
                {chapterInfo.chapterTitle}
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTOC(!showTOC)}
              title="Table of Contents"
            >
              <List className="w-[18px] h-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); toggleSpeech(); }}
              className={isSpeaking ? 'text-coral-burst' : ''}
              title={isSpeaking ? 'Stop Reading' : 'Read Aloud'}
            >
              {isSpeaking ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAudioPlayer(!showAudioPlayer)}
              className={showAudioPlayer ? 'text-coral-burst' : ''}
              title="Audio Player"
            >
              <BookOpen className="w-[18px] h-[18px]" />
            </Button>
            <div className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Fullscreen">
                {isFullscreen ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Audio Player (collapsible) ────────────────────────────────────── */}
      <AnimatePresence>
        {showAudioPlayer && (
          <motion.div
            className="absolute top-14 left-0 right-0 z-30 px-4 md:px-6"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="max-w-2xl mx-auto bg-cream-base/95 dark:bg-[#2A201D]/95 backdrop-blur-md rounded-2xl border border-peach-soft dark:border-[#3D302B] p-3">
              <AudioPlayer
                pages={pageTexts}
                currentPage={currentPageIndex}
                onPageChange={goToPage}
                compact={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table of Contents panel ───────────────────────────────────────── */}
      <AnimatePresence>
        {showTOC && (
          <>
            <motion.div
              className="fixed inset-0 z-[101] bg-charcoal-soft/20 dark:bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTOC(false)}
            />
            <motion.aside
              className="fixed top-0 left-0 bottom-0 z-[102] w-[300px] max-w-[80vw] bg-cream-base dark:bg-[#1A1412] border-r border-peach-soft dark:border-[#3D302B] flex flex-col"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-5 pt-6 pb-4 border-b border-peach-soft dark:border-[#3D302B]">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-lg text-charcoal-soft dark:text-[#EAE0D5]">
                    Contents
                  </h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowTOC(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-cocoa-light mt-1">
                  {totalPages} pages &middot; {project.chapters.length} chapters
                </p>
              </div>
              <nav className="flex-1 overflow-y-auto py-3">
                {tocEntries.map((entry) => {
                  const isActive = chapterInfo.chapterIndex === entry.chapterIndex;
                  return (
                    <button
                      key={entry.chapterIndex}
                      onClick={() => {
                        goToPage(entry.startPage);
                        setShowTOC(false);
                      }}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                        isActive
                          ? 'bg-coral-burst/8 text-coral-burst border-r-2 border-coral-burst'
                          : 'text-charcoal-soft dark:text-[#EAE0D5] hover:bg-peach-soft/20 dark:hover:bg-[#3D302B]/50'
                      }`}
                    >
                      <span className="text-xs text-cocoa-light font-heading font-bold w-6 shrink-0">
                        {entry.chapterIndex + 1}
                      </span>
                      <span className="text-sm font-body truncate">{entry.title}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div
        ref={(el) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (swipeRef && 'current' in swipeRef) {
            (swipeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        className="flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
        role="region"
        aria-label={`Story content, page ${currentPageIndex + 1} of ${totalPages}`}
      >
        <AnimatePresence mode="wait">
          <motion.article
            key={currentPageIndex}
            {...pageTransition}
            className="min-h-full"
          >
            {/* Page content — unified layout */}
            <div className="max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-20 pb-32 md:pb-24">
              {/* ── Image ───────────────────────────────────────────────── */}
              {currentPage.imageUrl && currentPage.layoutType !== 'text-only' && currentPage.layoutType !== 'learning-only' && (
                <div className="mb-8 md:mb-10">
                  <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-peach-soft/20 dark:bg-[#2A201D] aspect-[16/10] md:aspect-[2/1]">
                    <img
                      src={currentPage.imageUrl}
                      alt={`Illustration for page ${currentPage.pageNumber}`}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  </div>
                </div>
              )}

              {/* ── No image placeholder ─────────────────────────────────── */}
              {!currentPage.imageUrl && currentPage.layoutType !== 'text-only' && currentPage.layoutType !== 'learning-only' && (
                <div className="mb-8 md:mb-10">
                  <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-peach-soft/20 dark:bg-[#2A201D] aspect-[16/10] md:aspect-[2/1] flex items-center justify-center">
                    <div className="text-center text-cocoa-light/40">
                      <IcoBook className="w-10 h-10 mx-auto mb-2" />
                      <span className="text-xs font-body">Illustration</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Chapter badge ────────────────────────────────────────── */}
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-heading font-bold bg-gradient-to-r from-gold-sunshine/10 to-coral-burst/10 text-coral-burst border border-coral-burst/15">
                  {chapterInfo.chapterTitle}
                </span>
              </div>

              {/* ── Story text ───────────────────────────────────────────── */}
              {currentPage.layoutType !== 'image-only' && currentPage.layoutType !== 'learning-only' && (
                <div className="max-w-3xl">
                  {paragraphs.map((paragraph, idx) => (
                    <p
                      key={idx}
                      className="text-lg md:text-xl lg:text-[22px] leading-relaxed md:leading-[1.8] text-charcoal-soft dark:text-[#EAE0D5] font-body mb-6 last:mb-0"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {/* ── Learning content ────────────────────────────────────── */}
              {currentPage.layoutType === 'learning-only' && currentPage.learningContent && (
                <div className="max-w-2xl mx-auto text-center">
                  {/* Mentor avatar */}
                  <div className="w-20 h-20 rounded-full border-2 border-peach-soft dark:border-[#3D302B] overflow-hidden mx-auto mb-6 bg-peach-soft/20 dark:bg-[#2A201D]">
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
                        <BookOpen className="w-8 h-8 text-cocoa-light" />
                      </div>
                    )}
                  </div>

                  <h3 className="font-heading font-bold text-2xl text-charcoal-soft dark:text-[#EAE0D5] mb-2">
                    {teacherChar?.name || 'Learning Time'}
                  </h3>

                  {currentPage.learningContent.topic && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-heading font-bold bg-gradient-to-r from-gold-sunshine/10 to-coral-burst/10 text-coral-burst mb-6">
                      {currentPage.learningContent.topic}
                    </span>
                  )}

                  <p className="text-lg text-charcoal-soft dark:text-[#EAE0D5] leading-relaxed mb-8 font-body">
                    {currentPage.learningContent.mentorDialogue}
                  </p>

                  {/* Quiz */}
                  {currentPage.learningContent.quiz && (
                    <div className="bg-cream-base dark:bg-[#2A201D] rounded-2xl p-6 border border-peach-soft dark:border-[#3D302B] text-left">
                      <p className="font-heading font-bold text-base text-charcoal-soft dark:text-[#EAE0D5] mb-4">
                        {currentPage.learningContent.quiz.question}
                      </p>
                      <div className="space-y-2">
                        {currentPage.learningContent.quiz.options.map((option, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            onClick={() => {
                              if (option === currentPage.learningContent?.quiz?.correctAnswer) {
                                const celebration = teacherChar?.teachingStyle?.encouragementStyle || "That's correct!";
                                alert(`🎉 ${celebration}\n\n${currentPage.learningContent?.quiz?.explanation}`);
                              } else {
                                const encouragement = teacherChar?.teachingStyle?.correctionStyle || 'Try again!';
                                alert(`💪 ${encouragement}`);
                              }
                            }}
                            className="w-full text-left justify-start"
                          >
                            <span className="text-cocoa-light mr-2">{String.fromCharCode(65 + idx)}.</span>
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Branching choices ────────────────────────────────────── */}
              {currentPage.choices && currentPage.choices.length > 0 && (
                <div className="mt-8 max-w-2xl space-y-3">
                  <p className="text-xs font-heading font-bold text-cocoa-light uppercase tracking-wider mb-3">
                    What happens next?
                  </p>
                  {currentPage.choices.map((choice, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      onClick={() => {
                        const targetIdx = allPages.findIndex(
                          (p) => p.pageNumber === choice.targetPageNumber,
                        );
                        if (targetIdx >= 0) goToPage(targetIdx);
                      }}
                      className="w-full text-left justify-start py-4"
                    >
                      <ChevronRight className="w-4 h-4 shrink-0 text-coral-burst mr-2" />
                      {choice.text}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      {/* ── Bottom toolbar ────────────────────────────────────────────────── */}
      <motion.footer
        className="absolute bottom-0 left-0 right-0 z-40 safe-area-bottom"
        initial={false}
        animate={{ opacity: showToolbar ? 1 : 0, y: showToolbar ? 0 : 20 }}
        transition={{ duration: 0.25 }}
        style={{ pointerEvents: showToolbar ? 'auto' : 'none' }}
      >
        <div className="px-4 md:px-6 pb-4 pt-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            {/* Left: page nav */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={prevPage}
                disabled={currentPageIndex === 0}
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-heading font-bold text-cocoa-light min-w-[60px] text-center tabular-nums">
                {currentPageIndex + 1} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                onClick={nextPage}
                disabled={currentPageIndex === totalPages - 1}
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {project.learningConfig && (
                <Button
                  variant={learningMode ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setLearningMode(!learningMode)}
                  className="hidden md:flex"
                  title="Learning Mode"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden lg:inline ml-1.5">Learn</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowExportModal(true)}
                title="Export"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKDPExportModal(true)}
                title="Amazon KDP"
              >
                <IcoBook className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowShareModal(true);
                  onShare();
                }}
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.footer>

      {/* ── Learning Mode Mentor Overlay ───────────────────────────────── */}
      <AnimatePresence>
        {learningMode && currentPage.learningContent && !useVoiceTutor && (
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-24 right-4 md:right-8 max-w-sm z-30"
          >
            <div className="bg-cream-base/95 dark:bg-[#2A201D]/95 backdrop-blur-md rounded-2xl p-5 border border-peach-soft dark:border-[#3D302B]">
              <div className="flex items-start gap-3 mb-3">
                {teacherChar?.imageUrl ? (
                  <img
                    src={teacherChar.imageUrl}
                    alt={teacherChar.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-peach-soft"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacherChar.name}`;
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-peach-soft/30 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-cocoa-light" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-heading font-bold text-sm text-charcoal-soft dark:text-[#EAE0D5]">
                    {teacherChar?.name || 'Learning Guide'}
                  </h4>
                  {currentPage.learningContent.topic && (
                    <span className="text-xs text-cocoa-light">{currentPage.learningContent.topic}</span>
                  )}
                </div>
                {/* Toggle to voice tutor */}
                {teacherChar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUseVoiceTutor(true)}
                    className="shrink-0 ml-auto"
                    title="Switch to voice tutor"
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <p className="text-sm text-charcoal-soft dark:text-[#EAE0D5] leading-relaxed italic mb-3">
                &ldquo;{currentPage.learningContent.mentorDialogue}&rdquo;
              </p>

              {currentPage.learningContent.quiz && (
                <div className="space-y-1.5">
                  <p className="text-xs font-heading font-bold text-charcoal-soft dark:text-[#EAE0D5] mb-2">
                    {currentPage.learningContent.quiz.question}
                  </p>
                  {currentPage.learningContent.quiz.options.map((option, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (option === currentPage.learningContent?.quiz?.correctAnswer) {
                          alert(`🎉 ${teacherChar?.teachingStyle?.encouragementStyle || "Correct!"}\n\n${currentPage.learningContent?.quiz?.explanation}`);
                        } else {
                          alert(`💪 ${teacherChar?.teachingStyle?.correctionStyle || 'Try again!'}`);
                        }
                      }}
                      className="w-full text-left justify-start text-xs"
                    >
                      {String.fromCharCode(65 + idx)}. {option}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Interactive Voice Tutor ─────────────────────────────────── */}
        {learningMode && currentPage.learningContent && useVoiceTutor && teacherChar && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="absolute bottom-24 right-4 md:right-8 z-30"
          >
            <InteractiveCharacterTutor
              character={teacherChar}
              learningContent={currentPage.learningContent}
              onQuizComplete={(isCorrect) => {
                if (isCorrect) console.warn('Quiz answered correctly!');
              }}
              autoStart={true}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setUseVoiceTutor(false)}
              className="absolute -top-2 -right-2"
              title="Switch to visual mode"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showExportModal && (
        <ExportModal
          isOpen={true}
          book={{
            id: project.id,
            title: project.title,
            synopsis: project.synopsis || '',
            coverImage: project.chapters[0]?.pages[0]?.imageUrl,
            project,
            savedAt: new Date(),
            lastModified: new Date(),
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showKDPExportModal && (
        <KDPExportModal project={project} isOpen={true} onClose={() => setShowKDPExportModal(false)} />
      )}

      {showShareModal && (
        <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} book={project} />
      )}
    </div>
  );
};

export default StorybookViewer;
