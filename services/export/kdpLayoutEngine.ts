// KDP Layout Engine - Professional Typography & Spacing

import {
  TrimSize,
  TrimDimensions,
  PageDimensions,
  Margins,
  FontSizes,
  SpineSpecifications,
  TRIM_SIZE_SPECS,
  KDP_CONSTRAINTS,
  PaperType
} from './kdpTypes';

/**
 * Calculate page dimensions including bleed
 */
export function calculatePageDimensions(
  trimSize: TrimSize,
  includeBleed: boolean
): PageDimensions {
  const trim = TRIM_SIZE_SPECS[trimSize];
  const bleed = includeBleed ? KDP_CONSTRAINTS.BLEED_SIZE : 0;

  return {
    ...trim,
    bleedWidth: trim.width + bleed, // Only add bleed to outside edge
    bleedHeight: trim.height + (bleed * 2) // Add bleed to top and bottom
  };
}

/**
 * Calculate margins based on page count and bleed settings
 * Follows KDP specifications exactly
 */
export function calculateMargins(
  pageCount: number,
  hasBleed: boolean
): Margins {
  // Base outside margins
  const outsideMargin = hasBleed ? 0.375 : 0.25;

  // Inside margin (gutter) increases with page count
  let insideMargin: number;
  if (pageCount <= 150) {
    insideMargin = 0.375;
  } else if (pageCount <= 300) {
    insideMargin = 0.5;
  } else if (pageCount <= 500) {
    insideMargin = 0.625;
  } else if (pageCount <= 700) {
    insideMargin = 0.75;
  } else {
    insideMargin = 0.875;
  }

  return {
    top: outsideMargin,
    bottom: outsideMargin,
    inside: insideMargin,
    outside: outsideMargin
  };
}

/**
 * Calculate font sizes based on target audience
 */
export function getFontSizes(targetAudience: string): FontSizes {
  // Professional typography for children's books
  if (targetAudience.includes('Toddlers') || targetAudience.includes('1-3')) {
    return {
      body: 18,
      heading: 32,
      subheading: 24,
      pageNumber: 10,
      caption: 12
    };
  }
  
  if (targetAudience.includes('Children 4-6')) {
    return {
      body: 16,
      heading: 28,
      subheading: 22,
      pageNumber: 10,
      caption: 11
    };
  }
  
  if (targetAudience.includes('Children 7-9')) {
    return {
      body: 14,
      heading: 24,
      subheading: 18,
      pageNumber: 9,
      caption: 10
    };
  }
  
  if (targetAudience.includes('Pre-teens') || targetAudience.includes('10-12')) {
    return {
      body: 12,
      heading: 20,
      subheading: 16,
      pageNumber: 9,
      caption: 9
    };
  }
  
  if (targetAudience.includes('Young Adult')) {
    return {
      body: 11,
      heading: 18,
      subheading: 14,
      pageNumber: 8,
      caption: 8
    };
  }
  
  // Default (Stakeholders, Adult)
  return {
    body: 10,
    heading: 16,
    subheading: 12,
    pageNumber: 8,
    caption: 8
  };
}

/**
 * Calculate leading (line spacing) from font size
 * Professional typography: 120-150% of font size
 */
export function calculateLeading(fontSize: number): number {
  return fontSize * 1.4; // 140% for optimal readability
}

/**
 * Calculate spine width based on page count and paper type
 */
export function calculateSpineWidth(
  pageCount: number,
  paperType: PaperType = 'white'
): number {
  // KDP spine width multipliers
  const multiplier = paperType === 'white' ? 0.002252 : 0.0025;
  return pageCount * multiplier;
}

/**
 * Get spine specifications including safe zones
 */
export function getSpineSpecifications(
  pageCount: number,
  paperType: PaperType = 'white'
): SpineSpecifications {
  const width = calculateSpineWidth(pageCount, paperType);
  
  return {
    width,
    textSafeZone: KDP_CONSTRAINTS.SPINE_TEXT_MARGIN,
    minimumPages: KDP_CONSTRAINTS.MIN_SPINE_PAGES
  };
}

/**
 * Calculate safe content area (text-safe zone)
 * Content must stay within this area to avoid trimming
 */
export function getSafeContentArea(
  dimensions: PageDimensions,
  margins: Margins,
  hasBleed: boolean
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const bleedBuffer = hasBleed ? KDP_CONSTRAINTS.BLEED_SIZE : 0;
  
  return {
    x: margins.inside + bleedBuffer,
    y: margins.top + bleedBuffer,
    width: dimensions.width - margins.inside - margins.outside,
    height: dimensions.height - margins.top - margins.bottom
  };
}

/**
 * Calculate image placement with bleed extension
 */
export function calculateImageBleedArea(
  dimensions: PageDimensions,
  hasBleed: boolean
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!hasBleed) {
    return {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  // Images should extend into bleed area
  return {
    x: -KDP_CONSTRAINTS.BLEED_SIZE,
    y: -KDP_CONSTRAINTS.BLEED_SIZE,
    width: dimensions.bleedWidth,
    height: dimensions.bleedHeight
  };
}

/**
 * Validate page count meets KDP requirements
 */
export function validatePageCount(pageCount: number): {
  isValid: boolean;
  error?: string;
  adjustedCount?: number;
} {
  if (pageCount < KDP_CONSTRAINTS.MIN_PAGES) {
    return {
      isValid: false,
      error: `Minimum ${KDP_CONSTRAINTS.MIN_PAGES} pages required`,
      adjustedCount: KDP_CONSTRAINTS.MIN_PAGES
    };
  }

  if (pageCount > KDP_CONSTRAINTS.MAX_PAGES) {
    return {
      isValid: false,
      error: `Maximum ${KDP_CONSTRAINTS.MAX_PAGES} pages allowed`,
      adjustedCount: KDP_CONSTRAINTS.MAX_PAGES
    };
  }

  // KDP requires even page count
  if (pageCount % 2 !== 0) {
    return {
      isValid: true,
      error: 'Page count adjusted to even number',
      adjustedCount: pageCount + 1
    };
  }

  return { isValid: true, adjustedCount: pageCount };
}

/**
 * Get optimal image size for target DPI
 */
export function getOptimalImageSize(
  printWidth: number,
  printHeight: number,
  targetDPI: number = KDP_CONSTRAINTS.TARGET_DPI
): {
  width: number;
  height: number;
} {
  return {
    width: Math.ceil(printWidth * targetDPI),
    height: Math.ceil(printHeight * targetDPI)
  };
}

/**
 * Convert points to inches (typography)
 */
export function pointsToInches(points: number): number {
  return points / 72;
}

/**
 * Convert inches to points (typography)
 */
export function inchesToPoints(inches: number): number {
  return inches * 72;
}

/**
 * Convert pixels to inches at given DPI
 */
export function pixelsToInches(pixels: number, dpi: number = KDP_CONSTRAINTS.TARGET_DPI): number {
  return pixels / dpi;
}

/**
 * Convert inches to pixels at given DPI
 */
export function inchesToPixels(inches: number, dpi: number = KDP_CONSTRAINTS.TARGET_DPI): number {
  return Math.ceil(inches * dpi);
}
