import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Image,
  Loader,
  Settings,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { SavedBook } from '../types';
import { exportToPDF } from '../services/generator/pdfService';
import { useAuth } from '../contexts/AuthContext';
import { getEntitlements, userTierToTierName, type TierName } from '../config/entitlements';
import { getUserProfile } from '../services/profileService';
import { UserTier } from '../types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

interface ExportOptions {
  format: 'pdf' | 'html';
  includeImages: boolean;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  pageSize: 'a4' | 'a5' | 'letter' | '6x9';
  margins: 'normal' | 'narrow' | 'wide';
}

const defaultOptions: ExportOptions = {
  format: 'pdf',
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

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, book }) => {
  const { user } = useAuth();
  const [options, setOptions] = useState<ExportOptions>(defaultOptions);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [tierName, setTierName] = useState<TierName>('SPARK');

  // Load user tier
  useEffect(() => {
    if (!user) return;
    getUserProfile().then((profile) => {
      if (profile) {
        setTierName(userTierToTierName(profile.user_tier || UserTier.SPARK));
      }
    }).catch(() => {});
  }, [user]);

  const entitlements = getEntitlements(tierName);

  const handleExport = async () => {
    if (!book) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      // Simulate export progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setExportProgress(i);
      }

      // Generate the export file based on format
      let blob: Blob;
      let filename: string;

      switch (options.format) {
        case 'pdf':
          blob = await generatePDF(book, options, entitlements.watermark);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 border-b-2 border-peach-soft/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-coral-burst to-sunset-coral rounded-xl">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle>Export Book</DialogTitle>
              <DialogDescription>{book.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <Label className="mb-3">
              Export Format
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Print & share' },
                { id: 'html', label: 'HTML', icon: Settings, desc: 'Web viewing' },
              ].map(({ id, label, icon: Icon, desc }) => (
                <Button
                  key={id}
                  onClick={() =>
                    setOptions((prev) => ({ ...prev, format: id as ExportOptions['format'] }))
                  }
                  variant="outline"
                  className={`
                    p-4 h-auto border text-center flex-col
                    ${
                      options.format === id
                        ? 'border-coral-burst bg-coral-burst/5'
                        : 'border-peach-soft hover:border-coral-burst/50'
                    }
                  `}
                >
                  <Icon
                    className={`w-6 h-6 mx-auto mb-2 ${options.format === id ? 'text-coral-burst' : 'text-cocoa-light'}`}
                  />
                  <div className="font-medium text-charcoal-soft">{label}</div>
                  <div className="text-xs text-cocoa-light">{desc}</div>
                </Button>
              ))}
            </div>
          </div>

          {/* Include Images */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-cocoa-light" />
              <div>
                <p className="font-medium text-charcoal-soft">Include Illustrations</p>
                <p className="text-xs text-cocoa-light">Embed all generated images</p>
              </div>
            </div>
            <Switch
              checked={options.includeImages}
              onCheckedChange={(checked) =>
                setOptions((prev) => ({ ...prev, includeImages: checked }))
              }
            />
          </div>

          {/* Font Size */}
          <div>
            <Label className="mb-2">
              Font Size
            </Label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <Button
                  key={size}
                  onClick={() => setOptions((prev) => ({ ...prev, fontSize: size }))}
                  variant="outline"
                  size="sm"
                  className={`
                    flex-1 py-2 px-4 font-medium capitalize border
                    ${
                      options.fontSize === size
                        ? 'bg-coral-burst text-white border-coral-burst'
                        : 'border-peach-soft text-cocoa-light hover:border-coral-burst/50'
                    }
                  `}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <Label className="mb-2">
              Font Family
            </Label>
            <Select value={options.fontFamily} onValueChange={(v) => setOptions((prev) => ({ ...prev, fontFamily: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Georgia">Georgia (Serif)</SelectItem>
                <SelectItem value="Arial">Arial (Sans-serif)</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Comic Sans MS">Comic Sans (Playful)</SelectItem>
                <SelectItem value="Verdana">Verdana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Error */}
          {exportError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-cocoa-light">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="h-2 bg-peach-soft/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-linear-to-r from-coral-burst to-gold-sunshine rounded-full"
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
              className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-600 rounded-xl border border-green-100"
            >
              <Check className="w-5 h-5" />
              <span className="font-medium">Export successful!</span>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 border-t-2 border-peach-soft/30">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Helper functions for generating exports
async function generatePDF(book: SavedBook, options: ExportOptions, includeWatermark: boolean): Promise<Blob> {
  const fontSizeMap = { small: 10, medium: 12, large: 14 };
  const marginMap = { narrow: 10, normal: 20, wide: 30 };
  const sizeMap: Record<ExportOptions['pageSize'], 'A4' | 'A5' | 'Letter' | '6x9'> = {
    a4: 'A4',
    a5: 'A5',
    letter: 'Letter',
    '6x9': '6x9',
  };

  return exportToPDF(book.project, {
    includeImages: options.includeImages,
    includeWatermark,
    watermarkText: includeWatermark ? 'Created with Genesis - Upgrade to remove' : undefined,
    pageSize: sizeMap[options.pageSize],
    margins: {
      top: marginMap[options.margins],
      right: marginMap[options.margins],
      bottom: marginMap[options.margins],
      left: marginMap[options.margins],
    },
    fontSize: {
      title: fontSizeMap[options.fontSize] + 12,
      heading: fontSizeMap[options.fontSize] + 6,
      body: fontSizeMap[options.fontSize],
    },
  });
}

async function generateHTML(book: SavedBook, options: ExportOptions): Promise<Blob> {
  const html = generateFullHTML(book, options);
  return new Blob([html], { type: 'text/html' });
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
    ${(book.project.chapters.flatMap((c) => c.pages) || [])
      .map(
        (page: any, i: number) => `
    <div class="page">
        <div class="page-content">
            ${page.text ? `<p>${escapeHtml(page.text)}</p>` : ''}
            ${options.includeImages && page.imageUrl ? `<img class="page-image" src="${page.imageUrl}" alt="Page ${i + 1} illustration" />` : ''}
        </div>
        <div class="page-number">Page ${i + 1}</div>
    </div>
    `
      )
      .join('')}
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
            box-shadow: none;
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
            box-shadow: none;
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
        ${(book.project.chapters.flatMap((c) => c.pages) || [])
          .map(
            (page: any, i: number) => `
        <div class="page">
            <div class="page-number">Page ${i + 1}</div>
            ${page.text ? `<p class="page-text">${escapeHtml(page.text)}</p>` : ''}
            ${options.includeImages && page.imageUrl ? `<img class="page-image" src="${page.imageUrl}" alt="Page ${i + 1}" />` : ''}
        </div>
        `
          )
          .join('')}
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
