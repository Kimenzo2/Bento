// Amazon KDP Export Type Definitions

export type TrimSize = '6x9' | '8.5x8.5' | '8x10' | '8.5x11';
export type PaperType = 'white' | 'cream';
export type ColorMode = 'RGB';
export type PDFFormat = 'PDF/X-1a:2001' | 'PDF/A';

export interface TrimDimensions {
  width: number;  // inches
  height: number; // inches
  widthMM: number;
  heightMM: number;
}

export interface PageDimensions extends TrimDimensions {
  bleedWidth: number;
  bleedHeight: number;
}

export interface Margins {
  top: number;
  bottom: number;
  inside: number;  // gutter
  outside: number;
}

export interface KDPExportOptions {
  trimSize: TrimSize;
  includeBleed: boolean;
  includeImages: boolean;
  paperType: PaperType;
  colorMode: ColorMode;
  dpi: 300;
  pdfFormat: PDFFormat;
  embedFonts: boolean;
  optimizeImages: boolean;
  maxFileSize: number; // bytes (650MB = 681574400)
  includeISBN?: boolean;
  isbn?: string;
  copyrightYear?: number;
  includeSpine?: boolean;
}

export interface KDPValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileSize: number;
  pageCount: number;
  resolution: number;
  colorMode: string;
  hasBleed: boolean;
  marginsValid: boolean;
  fontsEmbedded: boolean;
}

export interface FontSizes {
  body: number;
  heading: number;
  subheading: number;
  pageNumber: number;
  caption: number;
}

export interface SpineSpecifications {
  width: number;        // inches
  textSafeZone: number; // 0.0625" on each side
  minimumPages: number;
}

export interface QualityMetrics {
  imageResolution: number;
  colorAccuracy: number;
  marginCompliance: number;
  fontEmbedding: number;
  overallScore: number;
}

export const TRIM_SIZE_SPECS: Record<TrimSize, TrimDimensions> = {
  '6x9': {
    width: 6,
    height: 9,
    widthMM: 152.4,
    heightMM: 228.6
  },
  '8.5x8.5': {
    width: 8.5,
    height: 8.5,
    widthMM: 215.9,
    heightMM: 215.9
  },
  '8x10': {
    width: 8,
    height: 10,
    widthMM: 203.2,
    heightMM: 254
  },
  '8.5x11': {
    width: 8.5,
    height: 11,
    widthMM: 215.9,
    heightMM: 279.4
  }
};

export const KDP_CONSTRAINTS = {
  MIN_PAGES: 24,
  MAX_PAGES: 828,
  MIN_FONT_SIZE: 7,
  TARGET_DPI: 300,
  MAX_FILE_SIZE: 681574400, // 650 MB in bytes
  BLEED_SIZE: 0.125, // inches
  MIN_LINE_WIDTH: 0.75, // points
  MIN_GRAYSCALE_FILL: 10, // percent
  SPINE_TEXT_MARGIN: 0.0625, // inches
  MIN_SPINE_PAGES: 79
};
