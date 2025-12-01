import React, { useState } from 'react';
import { ArrowLeft, Download, Share2, Printer, RefreshCw, ZoomIn, ZoomOut, FileImage, FileText, Sparkles } from 'lucide-react';
import { InfographicData } from '../../types/infographic';
import InfographicRenderer from './renderer/InfographicRenderer';
import { exportToPNG, exportToPDF, printElement } from './exportService';

interface InfographicResultPageProps {
    data: InfographicData;
    onClose: () => void;
    onRegenerate: () => void;
}

const InfographicResultPage: React.FC<InfographicResultPageProps> = ({ data, onClose, onRegenerate }) => {
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
        <div className="fixed inset-0 z-50 bg-cream-base overflow-y-auto animate-slideUp">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-peach-soft/30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                            title="Back to Editor"
                        >
                            <ArrowLeft className="w-6 h-6 text-charcoal-soft group-hover:-translate-x-1 transition-transform" />
                        </button>
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
                        <button
                            onClick={onRegenerate}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-cocoa-light hover:text-coral-burst"
                            title="Regenerate"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <div className="h-8 w-px bg-peach-soft mx-1 hidden sm:block"></div>

                        <button
                            onClick={() => handleExport('png')}
                            disabled={isExporting}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-peach-soft text-charcoal-soft rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95"
                        >
                            <FileImage className="w-4 h-4" />
                            PNG
                        </button>

                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">Download PDF</span>
                            <span className="sm:hidden">Save</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="bg-white rounded-[32px] shadow-xl border border-white/50 p-4 sm:p-8 md:p-12 min-h-[800px] flex justify-center relative">

                    {/* Zoom Controls (Floating) */}
                    <div className="absolute bottom-8 right-8 flex flex-col gap-2 bg-white rounded-xl shadow-lg border border-peach-soft/30 p-2 z-10">
                        <button
                            onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors active:scale-95"
                        >
                            <ZoomIn className="w-5 h-5 text-charcoal-soft" />
                        </button>
                        <div className="text-xs text-center font-bold text-cocoa-light py-1 border-y border-gray-100">
                            {Math.round(zoom * 100)}%
                        </div>
                        <button
                            onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors active:scale-95"
                        >
                            <ZoomOut className="w-5 h-5 text-charcoal-soft" />
                        </button>
                    </div>

                    {/* Renderer Container */}
                    <div className="overflow-x-auto w-full flex justify-center">
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                            <InfographicRenderer data={data} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfographicResultPage;
