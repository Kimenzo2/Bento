/**
 * BookPreviewPanel.tsx — The right zone. A living book page.
 *
 * Renders the book page as a framed card: illustration area on top,
 * story text below, Gen companion strip at the bottom.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import IllustrationArea from './IllustrationArea';
import StoryTextDisplay from './StoryTextDisplay';
import GenCompanionStrip from './GenCompanionStrip';
import type { EditorState } from '@hooks/useEditorState';

interface BookPreviewPanelProps {
  editor: EditorState;
}

const BookPreviewPanel: React.FC<BookPreviewPanelProps> = ({ editor }) => {
  const activePage = editor.activePage;
  const [pageTimeMs, setPageTimeMs] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track time on current page
  useEffect(() => {
    setPageTimeMs(0);
    timerRef.current = setInterval(() => {
      setPageTimeMs((prev) => prev + 10000);
    }, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [editor.activePageIndex]);

  if (!activePage) return null;

  const handlePrevPage = () => {
    if (editor.activePageIndex > 0) {
      editor.setActivePageIndex(editor.activePageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (editor.activePageIndex < editor.totalPages - 1) {
      editor.setActivePageIndex(editor.activePageIndex + 1);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center overflow-y-auto"
      style={{
        backgroundColor: 'var(--color-background)',
        padding: editor.isFocusMode ? '24px 16px' : '32px',
      }}
    >
      {/* Book page card */}
      <div
        className="w-full flex flex-col rounded-xl border border-peach-soft overflow-hidden transition-all duration-300"
        style={{
          maxWidth: editor.isFocusMode ? 640 : 560,
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 4px 24px color-mix(in srgb, var(--color-text) 6%, transparent)',
        }}
      >
        {/* Illustration area */}
        <IllustrationArea
          imageUrl={activePage.imageUrl}
          isGenerating={editor.isGeneratingImage}
          isOutdated={activePage.isImageOutdated}
          hasText={(activePage.text?.length || 0) > 5}
          onGenerate={editor.handleGenerateImage}
        />

        {/* Story text display */}
        <StoryTextDisplay
          text={activePage.text}
          pageNumber={activePage.pageNumber}
          totalPages={editor.totalPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          choices={activePage.choices}
          onChoiceClick={editor.jumpToPageNumber}
        />
      </div>

      {/* Gen companion strip — below the book card */}
      <div
        className="w-full rounded-xl border border-peach-soft overflow-hidden mt-3 hidden lg:block transition-all duration-300"
        style={{
          maxWidth: editor.isFocusMode ? 640 : 560,
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <GenCompanionStrip
          isGenerating={editor.isGeneratingImage}
          hasImage={!!activePage.imageUrl}
          textLength={activePage.text?.length || 0}
          pageTimeMs={pageTimeMs}
        />
      </div>
    </div>
  );
};

export default BookPreviewPanel;
