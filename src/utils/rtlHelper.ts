/**
 * RTL Helper Utilities
 * 
 * Provides helper functions for right-to-left layout support
 */

import type { TextDirection, LanguageCode } from '../types/language.d';
import { isRTLLanguage } from '../config/languages';

/**
 * CSS logical property mappings
 */
export const LOGICAL_PROPERTIES = {
  // Margin
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  
  // Padding
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  
  // Border
  borderLeft: 'borderInlineStart',
  borderRight: 'borderInlineEnd',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRightWidth: 'borderInlineEndWidth',
  borderLeftColor: 'borderInlineStartColor',
  borderRightColor: 'borderInlineEndColor',
  borderLeftStyle: 'borderInlineStartStyle',
  borderRightStyle: 'borderInlineEndStyle',
  
  // Position
  left: 'insetInlineStart',
  right: 'insetInlineEnd',
  
  // Border radius
  borderTopLeftRadius: 'borderStartStartRadius',
  borderTopRightRadius: 'borderStartEndRadius',
  borderBottomLeftRadius: 'borderEndStartRadius',
  borderBottomRightRadius: 'borderEndEndRadius',
  
  // Text align
  'text-align: left': 'text-align: start',
  'text-align: right': 'text-align: end',
  
  // Float
  'float: left': 'float: inline-start',
  'float: right': 'float: inline-end',
  
  // Clear
  'clear: left': 'clear: inline-start',
  'clear: right': 'clear: inline-end',
} as const;

/**
 * Tailwind RTL utility class mappings
 */
export const TAILWIND_RTL_MAPPINGS: Record<string, string> = {
  // Margin
  'ml-': 'ms-',
  'mr-': 'me-',
  
  // Padding
  'pl-': 'ps-',
  'pr-': 'pe-',
  
  // Border
  'border-l-': 'border-s-',
  'border-r-': 'border-e-',
  
  // Rounded
  'rounded-l-': 'rounded-s-',
  'rounded-r-': 'rounded-e-',
  'rounded-tl-': 'rounded-ss-',
  'rounded-tr-': 'rounded-se-',
  'rounded-bl-': 'rounded-es-',
  'rounded-br-': 'rounded-ee-',
  
  // Position
  'left-': 'start-',
  'right-': 'end-',
  
  // Text align
  'text-left': 'text-start',
  'text-right': 'text-end',
  
  // Scroll
  'scroll-ml-': 'scroll-ms-',
  'scroll-mr-': 'scroll-me-',
  'scroll-pl-': 'scroll-ps-',
  'scroll-pr-': 'scroll-pe-',
  
  // Space
  'space-x-': 'space-x-', // Handled by Tailwind RTL plugin
};

/**
 * Apply RTL to HTML element
 */
export const applyRTL = (element: HTMLElement, isRTL: boolean): void => {
  element.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  if (isRTL) {
    element.classList.add('rtl');
    element.classList.remove('ltr');
  } else {
    element.classList.add('ltr');
    element.classList.remove('rtl');
  }
};

/**
 * Get direction for a language
 */
export const getDirectionForLanguage = (code: LanguageCode): TextDirection => {
  return isRTLLanguage(code) ? 'rtl' : 'ltr';
};

/**
 * Convert directional Tailwind classes to logical equivalents
 */
export const convertToLogicalClass = (className: string): string => {
  let result = className;
  
  Object.entries(TAILWIND_RTL_MAPPINGS).forEach(([physical, logical]) => {
    // Use regex to match whole class names
    const regex = new RegExp(`\\b${physical}`, 'g');
    result = result.replace(regex, logical);
  });
  
  return result;
};

/**
 * Generate RTL-aware inline styles
 */
export const getDirectionalStyle = (
  isRTL: boolean,
  ltrStyles: React.CSSProperties,
  rtlStyles?: React.CSSProperties
): React.CSSProperties => {
  if (!isRTL) return ltrStyles;
  return { ...ltrStyles, ...rtlStyles };
};

/**
 * Flip a transform for RTL
 */
export const flipTransform = (transform: string, isRTL: boolean): string => {
  if (!isRTL) return transform;
  
  // Flip translateX values
  return transform.replace(
    /translateX\(([^)]+)\)/g,
    (match, value) => {
      // If it starts with a negative sign, remove it; otherwise add it
      if (value.trim().startsWith('-')) {
        return `translateX(${value.trim().substring(1)})`;
      }
      return `translateX(-${value.trim()})`;
    }
  );
};

/**
 * Get mirror icon name (for directional icons)
 */
export const getMirroredIcon = (iconName: string, isRTL: boolean): string => {
  if (!isRTL) return iconName;
  
  const iconMappings: Record<string, string> = {
    'chevron-left': 'chevron-right',
    'chevron-right': 'chevron-left',
    'arrow-left': 'arrow-right',
    'arrow-right': 'arrow-left',
    'arrow-left-circle': 'arrow-right-circle',
    'arrow-right-circle': 'arrow-left-circle',
    'skip-back': 'skip-forward',
    'skip-forward': 'skip-back',
    'corner-down-left': 'corner-down-right',
    'corner-down-right': 'corner-down-left',
    'corner-up-left': 'corner-up-right',
    'corner-up-right': 'corner-up-left',
    'log-in': 'log-in', // Same
    'log-out': 'log-out', // Same
  };
  
  return iconMappings[iconName] || iconName;
};

/**
 * CSS for RTL support (add to global styles)
 */
export const RTL_CSS = `
/* RTL Support */
[dir="rtl"] {
  /* Flip transform-origin for animations */
  --tw-transform-origin-x: right;
}

[dir="ltr"] {
  --tw-transform-origin-x: left;
}

/* Flip certain icons in RTL */
[dir="rtl"] .rtl-flip {
  transform: scaleX(-1);
}

/* Text alignment */
[dir="rtl"] .text-start {
  text-align: right;
}

[dir="rtl"] .text-end {
  text-align: left;
}

[dir="ltr"] .text-start {
  text-align: left;
}

[dir="ltr"] .text-end {
  text-align: right;
}

/* Flex direction */
[dir="rtl"] .rtl-flex-row-reverse {
  flex-direction: row-reverse;
}

/* List style position */
[dir="rtl"] ul,
[dir="rtl"] ol {
  padding-inline-start: 2rem;
  padding-inline-end: 0;
}

/* Input placeholder alignment */
[dir="rtl"] input::placeholder,
[dir="rtl"] textarea::placeholder {
  text-align: right;
}

/* Select dropdown arrow */
[dir="rtl"] select {
  background-position: left 0.5rem center;
  padding-left: 2rem;
  padding-right: 0.75rem;
}

/* Table alignment */
[dir="rtl"] th,
[dir="rtl"] td {
  text-align: right;
}

/* Modal/Dialog positioning */
[dir="rtl"] .dialog-close {
  left: 1rem;
  right: auto;
}

[dir="ltr"] .dialog-close {
  right: 1rem;
  left: auto;
}
`;

export default {
  applyRTL,
  getDirectionForLanguage,
  convertToLogicalClass,
  getDirectionalStyle,
  flipTransform,
  getMirroredIcon,
  RTL_CSS
};
