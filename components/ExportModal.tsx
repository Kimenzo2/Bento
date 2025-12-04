import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Download, FileText, Image, Loader, Check, X, 
    Book, Settings, Palette, AlertCircle
} from 'lucide-react';
import { SavedBook } from '../types';

interface ExportOptions {
    format: 'epub' | 'pdf' | 'html';
    includeImages: boolean;
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: string;
    pageSize: 'a4' | 'a5' | 'letter' | '6x9';
    margins: 'normal' | 'narrow' | 'wide';
}

const defaultOptions: ExportOptions = {
    format: 'epub',
    includeImages: true,
    fontSize: 'medium',
    fontFamily: 'Georgia',
    pageSize: 'a5',
    margins: 'normal',
};

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    book: SavedBook | null;
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    book,
}) => {
    const [options, setOptions] = useState<ExportOptions>(defaultOptions);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportSuccess, setExportSuccess] = useState(false);

    const handleExport = async () => {
        if (!book) return;

        setIsExporting(true);
        setExportProgress(0);
        setExportError(null);

        try {
            // Simulate export progress
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                setExportProgress(i);
            }

            // Generate the export file based on format
            let blob: Blob;
            let filename: string;

            switch (options.format) {
                case 'epub':
                    blob = await generateEPUB(book, options);
                    filename = `${sanitizeFilename(book.title)}.epub`;
                    break;
                case 'pdf':
                    blob = await generatePDF(book, options);
                    filename = `${sanitizeFilename(book.title)}.pdf`;
                    break;
                case 'html':
                    blob = await generateHTML(book, options);
                    filename = `${sanitizeFilename(book.title)}.html`;
                    break;
                default:
                    throw new Error('Unsupported format');
            }

            // Download the file
            downloadBlob(blob, filename);
            setExportSuccess(true);

            setTimeout(() => {
                setExportSuccess(false);
                onClose();
            }, 2000);

        } catch (error) {
            setExportError(error instanceof Error ? error.message : 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen || !book) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-coral-burst to-sunset-coral rounded-xl">
                                    <Download className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Export Book
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {book.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Format Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Export Format
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'epub', label: 'EPUB', icon: Book, desc: 'E-readers' },
                                    { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Print & share' },
                                    { id: 'html', label: 'HTML', icon: Settings, desc: 'Web viewing' },
                                ].map(({ id, label, icon: Icon, desc }) => (
                                    <button
                                        key={id}
                                        onClick={() => setOptions(prev => ({ ...prev, format: id as ExportOptions['format'] }))}
                                        className={`
                                            p-4 rounded-xl border-2 transition-all text-center
                                            ${options.format === id
                                                ? 'border-coral-burst bg-coral-burst/5'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-coral-burst/50'
                                            }
                                        `}
                                    >
                                        <Icon className={`w-6 h-6 mx-auto mb-2 ${options.format === id ? 'text-coral-burst' : 'text-gray-400'}`} />
                                        <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                                        <div className="text-xs text-gray-500">{desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Include Images */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Image className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Include Illustrations</p>
                                    <p className="text-xs text-gray-500">Embed all generated images</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOptions(prev => ({ ...prev, includeImages: !prev.includeImages }))}
                                title="Toggle include illustrations"
                                className={`
                                    relative w-12 h-6 rounded-full transition-colors
                                    ${options.includeImages ? 'bg-coral-burst' : 'bg-gray-300 dark:bg-gray-600'}
                                `}
                            >
                                <motion.div
                                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                                    animate={{ left: options.includeImages ? '28px' : '4px' }}
                                />
                            </button>
                        </div>

                        {/* Font Size */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Font Size
                            </label>
                            <div className="flex gap-2">
                                {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => setOptions(prev => ({ ...prev, fontSize: size }))}
                                        className={`
                                            flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors capitalize
                                            ${options.fontSize === size
                                                ? 'bg-coral-burst text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                                            }
                                        `}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Font Family */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Font Family
                            </label>
                            <select
                                value={options.fontFamily}
                                onChange={(e) => setOptions(prev => ({ ...prev, fontFamily: e.target.value }))}
                                title="Select font family"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="Georgia">Georgia (Serif)</option>
                                <option value="Arial">Arial (Sans-serif)</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Comic Sans MS">Comic Sans (Playful)</option>
                                <option value="Verdana">Verdana</option>
                            </select>
                        </div>

                        {/* Export Error */}
                        {exportError && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                                <span>{exportError}</span>
                            </div>
                        )}

                        {/* Export Progress */}
                        {isExporting && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>Exporting...</span>
                                    <span>{exportProgress}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-coral-burst to-sunset-coral"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${exportProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Success Message */}
                        {exportSuccess && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg"
                            >
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Export successful!</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="px-6 py-2 rounded-xl bg-gradient-to-r from-coral-burst to-sunset-coral text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isExporting ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Export {options.format.toUpperCase()}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// Helper functions for generating exports
async function generateEPUB(book: SavedBook, options: ExportOptions): Promise<Blob> {
    // Generate EPUB content (simplified - in production use a library like epub-gen)
    const content = generateEPUBContent(book, options);
    return new Blob([content], { type: 'application/epub+zip' });
}

async function generatePDF(book: SavedBook, options: ExportOptions): Promise<Blob> {
    // Generate HTML that can be converted to PDF
    const html = generatePrintableHTML(book, options);
    return new Blob([html], { type: 'application/pdf' });
}

async function generateHTML(book: SavedBook, options: ExportOptions): Promise<Blob> {
    const html = generateFullHTML(book, options);
    return new Blob([html], { type: 'text/html' });
}

function generateEPUBContent(book: SavedBook, options: ExportOptions): string {
    // Simplified EPUB generation - returns HTML that represents the content
    return generateFullHTML(book, options);
}

function generatePrintableHTML(book: SavedBook, options: ExportOptions): string {
    const fontSizes = { small: '12pt', medium: '14pt', large: '16pt' };
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(book.title)}</title>
    <style>
        @page { size: ${options.pageSize}; margin: ${options.margins === 'narrow' ? '0.5in' : options.margins === 'wide' ? '1.5in' : '1in'}; }
        body { font-family: ${options.fontFamily}, serif; font-size: ${fontSizes[options.fontSize]}; line-height: 1.6; }
        .page { page-break-after: always; padding: 2em; }
        .cover { text-align: center; padding-top: 30%; }
        .cover h1 { font-size: 2.5em; margin-bottom: 0.5em; }
        .page-content { max-width: 100%; }
        .page-image { max-width: 100%; height: auto; margin: 1em 0; }
        .page-number { text-align: center; font-size: 0.8em; color: #666; margin-top: 2em; }
    </style>
</head>
<body>
    <div class="page cover">
        <h1>${escapeHtml(book.title)}</h1>
        <p>A Genesis Storybook</p>
    </div>
    ${(book.project.chapters.flatMap(c => c.pages) || []).map((page: any, i: number) => `
    <div class="page">
        <div class="page-content">
            ${page.text ? `<p>${escapeHtml(page.text)}</p>` : ''}
            ${options.includeImages && page.imageUrl ? `<img class="page-image" src="${page.imageUrl}" alt="Page ${i + 1} illustration" />` : ''}
        </div>
        <div class="page-number">Page ${i + 1}</div>
    </div>
    `).join('')}
</body>
</html>
    `.trim();
}

function generateFullHTML(book: SavedBook, options: ExportOptions): string {
    const fontSizes = { small: '14px', medium: '16px', large: '18px' };
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(book.title)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: ${options.fontFamily}, serif; 
            font-size: ${fontSizes[options.fontSize]}; 
            line-height: 1.8;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        .book-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25);
            overflow: hidden;
        }
        .cover {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white;
            text-align: center;
            padding: 4rem 2rem;
        }
        .cover h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        .cover p { opacity: 0.9; }
        .page {
            padding: 2rem;
            border-bottom: 1px solid #eee;
        }
        .page:last-child { border-bottom: none; }
        .page-number {
            font-size: 0.75rem;
            color: #999;
            margin-bottom: 1rem;
        }
        .page-text {
            margin-bottom: 1.5rem;
            color: #333;
        }
        .page-image {
            width: 100%;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .footer {
            text-align: center;
            padding: 2rem;
            background: #f8f9fa;
            color: #666;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="book-container">
        <div class="cover">
            <h1>${escapeHtml(book.title)}</h1>
            <p>Created with Genesis Storybooks</p>
        </div>
        ${(book.project.chapters.flatMap(c => c.pages) || []).map((page: any, i: number) => `
        <div class="page">
            <div class="page-number">Page ${i + 1}</div>
            ${page.text ? `<p class="page-text">${escapeHtml(page.text)}</p>` : ''}
            ${options.includeImages && page.imageUrl ? `<img class="page-image" src="${page.imageUrl}" alt="Page ${i + 1}" />` : ''}
        </div>
        `).join('')}
        <div class="footer">
            <p>The End</p>
            <p style="margin-top: 0.5rem;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default ExportModal;
