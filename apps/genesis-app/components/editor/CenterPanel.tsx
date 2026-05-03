/**
 * CenterPanel.tsx — The center stage of the three-panel editor.
 *
 * Illustration as HERO at top (edge-to-edge, commanding).
 * Below: StoryTextDisplay with live preview + page navigation.
 *
 * Fills all available space between left (260px) and right (300px).
 * Min-width 480px on desktop.
 *
 * DNA rules: zero hardcoded colours, Geist chrome.
 */

import type React from 'react';
import IllustrationArea from './IllustrationArea';
import StoryTextDisplay from './StoryTextDisplay';
import type { EditorState } from '@hooks/useEditorState';

interface CenterPanelProps {
  editor: EditorState;
}

const CenterPanel: React.FC<CenterPanelProps> = ({ editor }) => {
  const activePage = editor.activePage;
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
        padding: editor.isFocusMode ? '24px 16px' : '32px 24px',
        minWidth: 0,
      }}
    >
      {/* Illustration — hero, commanding */}
      <div className="w-full" style={{ maxWidth: editor.isFocusMode ? 720 : 640 }}>
        <IllustrationArea
          imageUrl={activePage.imageUrl}
          isGenerating={editor.isGeneratingImage}
          isOutdated={activePage.isImageOutdated}
          hasText={(activePage.text?.length || 0) > 5}
          onGenerate={editor.handleGenerateImage}
        />
      </div>

      {/* Story text display + page nav — below the hero */}
      <div className="w-full" style={{ maxWidth: editor.isFocusMode ? 720 : 640 }}>
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
    </div>
  );
};

export default CenterPanel;
