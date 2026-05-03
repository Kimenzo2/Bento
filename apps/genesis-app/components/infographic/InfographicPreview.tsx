import { FileImage, FileText, Printer, RefreshCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { InfographicData } from '../../types/infographic';
import { exportToPDF, exportToPNG, printElement } from './exportService';
import InfographicRenderer from './renderer/InfographicRenderer';
import { Button } from '@components/ui/button';

// Preview component for generated infographics

interface InfographicPreviewProps {
  data: InfographicData;
  onClose: () => void;
  onRegenerate: () => void;
}

const InfographicPreview: React.FC<InfographicPreviewProps> = ({ data, onClose, onRegenerate }) => {
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'png' | 'pdf') => {
    setIsExporting(true);
    const fileName = `infographic-${data.topic.replace(/\s+/g, '-').toLowerCase()}`;

    // Reset zoom for export to capture full quality
    const currentZoom = zoom;
    setZoom(1);

    // Small delay to allow render to update
    setTimeout(async () => {
      if (type === 'png') {
        await exportToPNG('infographic-canvas', fileName);
      } else {
        await exportToPDF('infographic-canvas', fileName);
      }
      setZoom(currentZoom);
      setIsExporting(false);
    }, 100);
  };

  const handlePrint = () => {
    const currentZoom = zoom;
    setZoom(1);
    setTimeout(() => {
      printElement('infographic-canvas');
      setZoom(currentZoom);
    }, 100);
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Button onClick={onClose} variant="ghost" size="icon" className="shrink-0" title="Close">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-cocoa-light" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg sm:text-xl text-charcoal-soft truncate">
              {data.title}
            </h3>
            <div className="text-[10px] sm:text-xs text-cocoa-light uppercase tracking-wide truncate">
              {data.ageGroup} • {data.type} • {data.style}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={onRegenerate}
            variant="ghost"
            size="icon"
            className="text-cocoa-light hover:text-coral-burst shrink-0"
            title="Start Over"
          >
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="h-6 w-px bg-peach-soft mx-1 sm:mx-2 hidden sm:block"></div>

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="bg-surface border border-peach-soft text-charcoal-soft hover:border-coral-burst min-h-11"
            title="Print"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">Print</span>
          </Button>

          <div className="flex gap-2 flex-1 sm:flex-initial">
            <Button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="bg-surface border border-peach-soft text-charcoal-soft hover:bg-surface/50 flex-1 sm:flex-initial min-h-11"
              title="Export as PNG"
            >
              <FileImage className="w-4 h-4" />
              <span className="hidden sm:inline">PNG</span>
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              variant="primary"
              size="sm"
              className="hover:-translate-y-0.5 flex-1 sm:flex-initial min-h-11"
              title="Export as PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-cream-base/50 rounded-2xl border border-peach-soft overflow-hidden relative flex items-center justify-center p-2 sm:p-4 md:p-8">
        {/* Zoom Controls */}
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex flex-col gap-1 sm:gap-2 bg-surface rounded-lg border border-peach-soft/50 p-1 z-10">
          <Button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-charcoal-soft" />
          </Button>
          <Button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-charcoal-soft" />
          </Button>
          <div className="text-[10px] text-center font-bold text-cocoa-light/60 py-1">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* The Infographic Renderer */}
        <div className="overflow-auto max-h-full w-full flex justify-center">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s',
            }}
          >
            <InfographicRenderer data={data} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfographicPreview;
