import React, { useState } from 'react';
import { Download, Share2, Printer, RefreshCw, X, ZoomIn, ZoomOut, FileImage, FileText } from 'lucide-react';
import { InfographicData } from '../../types/infographic';
import InfographicRenderer from './renderer/InfographicRenderer';
import { exportToPNG, exportToPDF, printElement } from './exportService';

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
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 active:scale-95"
                        title="Close"
                    >
                        <X className="w-5 h-5 sm:w-6 sm:h-6 text-cocoa-light" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-lg sm:text-xl text-charcoal-soft truncate">{data.title}</h3>
                        <div className="text-[10px] sm:text-xs text-cocoa-light uppercase tracking-wide truncate">
                            {data.ageGroup} • {data.type} • {data.style}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={onRegenerate}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-cocoa-light hover:text-coral-burst flex-shrink-0 active:scale-95"
                        title="Start Over"
                    >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="h-6 w-px bg-peach-soft mx-1 sm:mx-2 hidden sm:block"></div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-peach-soft rounded-lg text-xs sm:text-sm font-bold text-charcoal-soft hover:border-coral-burst transition-colors shadow-sm active:scale-95 min-h-[44px]"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden md:inline">Print</span>
                    </button>

                    <div className="flex gap-2 flex-1 sm:flex-initial">
                        <button
                            onClick={() => handleExport('png')}
                            disabled={isExporting}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-peach-soft text-charcoal-soft rounded-lg text-xs sm:text-sm font-bold shadow-sm hover:bg-gray-50 transition-all flex-1 sm:flex-initial active:scale-95 min-h-[44px]"
                            title="Export as PNG"
                        >
                            <FileImage className="w-4 h-4" />
                            <span className="hidden sm:inline">PNG</span>
                        </button>
                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex-1 sm:flex-initial active:scale-95 min-h-[44px]"
                            title="Export as PDF"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-cream-base/50 rounded-2xl border border-peach-soft overflow-hidden relative flex items-center justify-center p-2 sm:p-4 md:p-8">
                {/* Zoom Controls */}
                <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex flex-col gap-1 sm:gap-2 bg-white rounded-lg shadow-md p-1 z-10">
                    <button
                        onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
                        className="p-2 hover:bg-gray-100 rounded transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                        <ZoomIn className="w-4 h-4 text-charcoal-soft" />
                    </button>
                    <button
                        onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
                        className="p-2 hover:bg-gray-100 rounded transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                        <ZoomOut className="w-4 h-4 text-charcoal-soft" />
                    </button>
                    <div className="text-[10px] text-center font-bold text-gray-400 py-1">
                        {Math.round(zoom * 100)}%
                    </div>
                </div>

                {/* The Infographic Renderer */}
                <div className="overflow-auto max-h-full w-full flex justify-center">
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                        <InfographicRenderer data={data} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfographicPreview;
