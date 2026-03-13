import jsPDF from 'jspdf';
import type { BookProject } from '../../types';

export interface PDFExportOptions {
  includeImages: boolean;
  pageSize: 'A4' | 'Letter' | 'A5' | '6x9';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize: {
    title: number;
    heading: number;
    body: number;
  };
  includeWatermark: boolean;
  watermarkText?: string;
}

const DEFAULT_OPTIONS: PDFExportOptions = {
  includeImages: true,
  pageSize: 'A4',
  orientation: 'portrait',
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  fontSize: {
    title: 24,
    heading: 18,
    body: 12,
  },
  includeWatermark: false,
};

type ResolvedImage = { dataUrl: string; format: 'PNG' | 'JPEG' };

const PAGE_SIZE_MM: Record<string, [number, number]> = {
  '6x9': [152.4, 228.6],
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const inferFormatFromMime = (mime: string): 'PNG' | 'JPEG' =>
  mime.includes('png') ? 'PNG' : 'JPEG';

const inferFormatFromDataUrl = (dataUrl: string): 'PNG' | 'JPEG' =>
  dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

const resolveImageData = async (url: string): Promise<ResolvedImage | null> => {
  if (url.startsWith('data:')) {
    return { dataUrl: url, format: inferFormatFromDataUrl(url) };
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const format = blob.type ? inferFormatFromMime(blob.type) : inferFormatFromDataUrl(dataUrl);
    return { dataUrl, format };
  } catch {
    return null;
  }
};

/**
 * Exports a book project to PDF format
 */
export const exportToPDF = async (
  project: BookProject,
  options: Partial<PDFExportOptions> = {}
): Promise<Blob> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const pageSizeKey = opts.pageSize.toLowerCase();
  const format = PAGE_SIZE_MM[pageSizeKey] ?? pageSizeKey;

  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - opts.margins.left - opts.margins.right;

  // Title Page
  doc.setFontSize(opts.fontSize.title);
  doc.text(project.title, pageWidth / 2, opts.margins.top + 40, { align: 'center' });

  if (project.synopsis) {
    doc.setFontSize(opts.fontSize.body);
    const splitSynopsis = doc.splitTextToSize(project.synopsis, contentWidth);
    doc.text(splitSynopsis, opts.margins.left, opts.margins.top + 60);
  }

  // Add pages
  for (const chapter of project.chapters) {
    for (const page of chapter.pages) {
      doc.addPage();

      // Add watermark if enabled
      if (opts.includeWatermark && opts.watermarkText) {
        doc.setFontSize(60);
        doc.setTextColor(200, 200, 200);
        doc.text(opts.watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        doc.setTextColor(0, 0, 0);
      }

      // Add image if available
      if (opts.includeImages && page.imageUrl) {
        try {
          const imgHeight = (pageHeight - opts.margins.top - opts.margins.bottom) * 0.5;
          const imageData = await resolveImageData(page.imageUrl);
          if (imageData) {
            doc.addImage(
              imageData.dataUrl,
              imageData.format,
              opts.margins.left,
              opts.margins.top,
              contentWidth,
              imgHeight
            );
          } else {
            console.warn('Failed to load image for PDF:', page.imageUrl);
          }
        } catch (error) {
          console.warn('Failed to add image to PDF:', error);
        }
      }

      // Add text content
      doc.setFontSize(opts.fontSize.body);
      const yPosition =
        opts.includeImages && page.imageUrl
          ? opts.margins.top + (pageHeight - opts.margins.top - opts.margins.bottom) * 0.5 + 10
          : opts.margins.top;

      const splitText = doc.splitTextToSize(page.text, contentWidth);
      doc.text(splitText, opts.margins.left, yPosition);

      // Add page number
      doc.setFontSize(10);
      doc.text(`${page.pageNumber}`, pageWidth / 2, pageHeight - opts.margins.bottom + 10, {
        align: 'center',
      });

      // Add watermark if enabled
      if (opts.includeWatermark) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150); // Gray color
        const watermarkText = opts.watermarkText || 'Created with Genesis - Upgrade to remove';
        doc.text(
          watermarkText,
          pageWidth - opts.margins.right,
          pageHeight - opts.margins.bottom + 10,
          { align: 'right' }
        );
        doc.setTextColor(0, 0, 0); // Reset to black
      }
    }
  }

  return doc.output('blob');
};

/**
 * Downloads the PDF to the user's device
 */
export const downloadPDF = async (
  project: BookProject,
  options: Partial<PDFExportOptions> = {}
): Promise<void> => {
  const blob = await exportToPDF(project, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generates a preview URL for the PDF
 */
export const generatePDFPreview = async (
  project: BookProject,
  options: Partial<PDFExportOptions> = {}
): Promise<string> => {
  const blob = await exportToPDF(project, options);
  return URL.createObjectURL(blob);
};
