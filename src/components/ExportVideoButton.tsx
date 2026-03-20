import React, { useState } from 'react';
import { Loader2, Video } from 'lucide-react';

import type { SavedBook, UserTier } from '../../types';
import { generateVideo } from '../engine/VideoExporter';
import { Button } from '../../components/ui/button';

interface ExportVideoButtonProps {
  book: SavedBook;
  tier: UserTier;
}

export function ExportVideoButton({ book, tier }: ExportVideoButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setProgress(0);
      setStage('Starting export...');

      await generateVideo(book, tier, (percent, label) => {
        setProgress(percent);
        setStage(label);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video export failed';
      alert(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <Button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full"
        variant="default"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting video...
          </>
        ) : (
          <>
            <Video className="mr-2 h-4 w-4" />
            Export as Video
          </>
        )}
      </Button>

      {isExporting && (
        <div className="space-y-2">
          <progress
            className="h-2 w-full overflow-hidden rounded-full"
            max={100}
            value={progress}
          />
          <p className="text-xs text-gray-600">{stage || `Encoding... ${progress}%`}</p>
        </div>
      )}
    </div>
  );
}

export default ExportVideoButton;
