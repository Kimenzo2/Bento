import {
  ArrowLeft,
  Bookmark,
  Check,
  FileImage,
  FileText,
  Printer,
  RefreshCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { saveInfographic } from '../../services/libraryService';
import type { InfographicData } from '../../types/infographic';
import { exportToPDF, exportToPNG, printElement } from './exportService';
import InfographicRenderer from './renderer/InfographicRenderer';
import { Button } from '@components/ui/button';

interface InfographicResultPageProps {
  data: InfographicData;
  onClose: () => void;
  onRegenerate: () => void;
}

const InfographicResultPage: React.FC<InfographicResultPageProps> = ({
  data,
  onClose,
  onRegenerate,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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

  const handleSave = async () => {
    if (isSaved) return;

    setIsSaving(true);
    try {
      await saveInfographic(data);
      setIsSaved(true);
      // Reset saved state after 3 seconds to allow re-saving if modified
      setTimeout(() => setIsSaved(false), 5000);
    } catch (error) {
      console.error('Failed to save infographic:', error);
      alert('Failed to save infographic. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-cream-base overflow-y-auto animate-slideUp">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-surface/80  border-b border-peach-soft/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="group"
              title="Back to Editor"
            >
              <ArrowLeft className="w-6 h-6 text-charcoal-soft group-hover:-translate-x-1 transition-transform" />
            </Button>
            <div>
              <h1 className="font-heading font-bold text-xl sm:text-2xl text-charcoal-soft flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold-sunshine" />
                Your Masterpiece
              </h1>
              <p className="text-xs sm:text-sm text-cocoa-light hidden sm:block">
                {data.topic} • {data.type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="outline"
              className={`${
                isSaved
                  ? 'bg-green-500 text-white'
                  : 'bg-surface border border-peach-soft text-charcoal-soft hover:bg-surface/50 hover:border-coral-burst'
              }`}
              title={isSaved ? 'Saved to Library' : 'Save to Library'}
            >
              {isSaving ? (
                <div className="w-4 h-4 border border-coral-burst/30 border-t-coral-burst rounded-full animate-spin" />
              ) : isSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isSaved ? 'Saved!' : 'Save'}</span>
            </Button>

            <div className="h-8 w-px bg-peach-soft mx-1 hidden sm:block"></div>

            <Button
              onClick={onRegenerate}
              variant="ghost"
              size="icon"
              className="text-cocoa-light hover:text-coral-burst"
              title="Regenerate"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>

            <Button
              onClick={handlePrint}
              variant="ghost"
              size="icon"
              className="text-cocoa-light hover:text-charcoal-soft"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </Button>

            <div className="h-8 w-px bg-peach-soft mx-1 hidden sm:block"></div>

            <Button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              variant="outline"
              className="bg-surface border border-peach-soft text-charcoal-soft hover:bg-surface/50"
            >
              <FileImage className="w-4 h-4" />
              <span className="hidden sm:inline">PNG</span>
            </Button>

            <Button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              variant="primary"
              className="hover:-translate-y-0.5"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-surface rounded-4xl border border-white/50 p-4 sm:p-8 md:p-12 min-h-[800px] flex justify-center relative">
          {/* Zoom Controls (Floating) */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-2 bg-surface rounded-xl border border-peach-soft/30 p-2 z-10">
            <Button
              onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
              variant="ghost"
              size="icon"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5 text-charcoal-soft" />
            </Button>
            <div className="text-xs text-center font-bold text-cocoa-light py-1 border-y border-peach-soft/50">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
              variant="ghost"
              size="icon"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5 text-charcoal-soft" />
            </Button>
          </div>

          {/* Renderer Container */}
          <div className="overflow-x-auto w-full flex justify-center">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <InfographicRenderer data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfographicResultPage;
