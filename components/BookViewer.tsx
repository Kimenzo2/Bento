import { ChevronLeft, ChevronRight, Home, Share2, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import type { BookProject } from '../types';
import ExportModal from './ExportModal';
import { Button } from './ui/button';

interface BookViewerProps {
  project: BookProject;
  onClose: () => void;
}

const BookViewer: React.FC<BookViewerProps> = ({ project, onClose }) => {
  const allPages = project.chapters.flatMap((c) => c.pages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const currentPage = allPages[currentPageIndex];
  const viewerIconButtonClass =
    'h-10 w-10 rounded-[12px] border-[0.5px] border-peach-soft bg-surface/50 text-charcoal-soft dark:border-white/10 dark:bg-white/5 dark:text-white hover:text-coral-burst dark:hover:text-white hover:bg-surface dark:hover:bg-white/10 hover:border-coral-burst/30 dark:hover:border-white/16 transition-all duration-200';
  const viewerPillButtonClass =
    'h-10 rounded-[12px] px-3.5 inline-flex items-center gap-2 font-heading font-medium border-[0.5px] border-peach-soft bg-surface/50 text-charcoal-soft dark:border-white/10 dark:bg-white/5 dark:text-white hover:text-coral-burst dark:hover:text-white hover:bg-surface dark:hover:bg-white/10 hover:border-coral-burst/30 dark:hover:border-white/16 transition-all duration-200';

  const goToNextPage = () => {
    if (currentPageIndex < allPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
  });

  const handleChoice = (targetPageNumber: number) => {
    const targetIndex = allPages.findIndex((p) => p.pageNumber === targetPageNumber);
    if (targetIndex !== -1) {
      setCurrentPageIndex(targetIndex);
    }
  };

  if (!currentPage) {
    return (
      <div className="fixed inset-0 bg-charcoal-soft flex items-center justify-center z-50">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-linear-to-br from-charcoal-soft via-charcoal-soft to-coral-burst/20 z-50 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 bg-charcoal-soft/90  border-b border-white/10 flex items-center justify-between px-3 sm:px-6 z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={`${viewerIconButtonClass} shrink-0`}
            title="Exit"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-heading font-bold text-sm sm:text-lg truncate">
              {project.title}
            </h1>
            <p className="text-white/60 text-xs hidden sm:block">
              Page {currentPage.pageNumber} of {allPages.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExportModal(true)}
            className={viewerIconButtonClass}
            title="Export Book"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={`hidden sm:inline-flex shrink-0 ${viewerPillButtonClass}`}
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Book Page Container */}
      <div
        className="absolute inset-0 flex items-center justify-center pt-16 pb-20 px-2 sm:px-4"
        {...swipeHandlers}
      >
        <div className="w-full max-w-4xl h-full flex items-center justify-center">
          {/* Book Page - Mobile: Full height vertical stack, Desktop: Aspect ratio card */}
          <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:aspect-3/4 bg-[#FFFCF8] border border-peach-soft rounded-lg overflow-hidden transform transition-all duration-500 animate-fadeIn flex flex-col">
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('/textures/cream-paper.png')] opacity-40 mix-blend-multiply pointer-events-none"></div>

            {/* Image Section - Mobile: Takes 60% height, Desktop: 55% */}
            {currentPage.imageUrl && (
              <div className="relative h-[60%] sm:h-[55%] w-full overflow-hidden shrink-0">
                <img
                  src={currentPage.imageUrl}
                  alt={`Page ${currentPage.pageNumber}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-linear-to-t from-[#FFFCF8] to-transparent"></div>
              </div>
            )}

            {/* Text Content - Mobile: Takes remaining 40%, scrollable, Desktop: 45% */}
            <div
              className={`p-4 sm:p-8 md:p-12 ${currentPage.imageUrl ? 'flex-1' : 'h-full'} overflow-y-auto flex flex-col relative z-10`}
            >
              <p className="font-heading text-lg sm:text-2xl md:text-3xl text-charcoal-soft leading-relaxed mb-auto">
                {currentPage.text}
              </p>

              {/* Interactive Choices */}
              {currentPage.choices && currentPage.choices.length > 0 && (
                <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                  {currentPage.choices.map((choice, idx) => (
                    <Button
                      variant="outline"
                      key={idx}
                      onClick={() => handleChoice(choice.targetPageNumber)}
                      className="w-full h-10 sm:h-11 px-4 sm:px-5 rounded-[12px] border-[0.5px] border-peach-soft bg-surface/50 text-charcoal-soft dark:border-white/10 dark:bg-white/5 dark:text-white hover:text-coral-burst dark:hover:text-white hover:bg-surface dark:hover:bg-white/10 hover:border-coral-burst/30 dark:hover:border-white/16 sm:text-base flex justify-between group transition-all duration-200"
                    >
                      {choice.text}
                      <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Button>
                  ))}
                </div>
              )}

              {/* Page Number */}
              <div className="mt-4 sm:mt-6 text-center">
                <span className="font-heading font-bold text-cocoa-light/30 text-xs sm:text-sm tracking-widest">
                  - {currentPage.pageNumber} -
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-20 bg-charcoal-soft/90  border-t border-white/10 flex items-center justify-center gap-3 sm:gap-6 px-3 sm:px-6">
        <Button
          variant="ghost"
          onClick={goToPrevPage}
          disabled={currentPageIndex === 0}
          className="h-10 rounded-[12px] px-3.5 inline-flex items-center gap-1 border-[0.5px] border-peach-soft bg-surface/50 text-charcoal-soft dark:border-white/10 dark:bg-white/5 dark:text-white hover:text-coral-burst dark:hover:text-white hover:bg-surface dark:hover:bg-white/10 hover:border-coral-burst/30 dark:hover:border-white/16 disabled:opacity-30 disabled:hover:text-charcoal-soft dark:disabled:hover:text-white disabled:hover:bg-surface/50 dark:disabled:hover:bg-white/5 disabled:hover:border-peach-soft dark:disabled:hover:border-white/10 transition-all duration-200 sm:text-base"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden xs:inline">Previous</span>
          <span className="xs:hidden">Prev</span>
        </Button>

        <div className="text-white text-xs sm:text-sm font-medium bg-surface/10 px-3 sm:px-4 py-2 rounded-full">
          {currentPageIndex + 1} / {allPages.length}
        </div>

        <Button
          variant="ghost"
          onClick={goToNextPage}
          disabled={currentPageIndex === allPages.length - 1}
          className="h-10 rounded-[12px] px-3.5 inline-flex items-center gap-1 border-[0.5px] border-peach-soft bg-surface/50 text-charcoal-soft dark:border-white/10 dark:bg-white/5 dark:text-white hover:text-coral-burst dark:hover:text-white hover:bg-surface dark:hover:bg-white/10 hover:border-coral-burst/30 dark:hover:border-white/16 disabled:opacity-30 disabled:hover:text-charcoal-soft dark:disabled:hover:text-white disabled:hover:bg-surface/50 dark:disabled:hover:bg-white/5 disabled:hover:border-peach-soft dark:disabled:hover:border-white/10 transition-all duration-200 sm:text-base"
        >
          <span className="hidden xs:inline">Next</span>
          <span className="xs:hidden">Next</span>
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

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
    </div>
  );
};

export default BookViewer;
