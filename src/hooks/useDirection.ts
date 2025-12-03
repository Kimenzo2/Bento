/**
 * useDirection Hook
 * 
 * Provides RTL/LTR direction utilities for components
 */

import { useMemo } from 'react';
import { useLanguageContext } from '../contexts/LanguageContext';
import type { TextDirection } from '../types/language.d';

interface UseDirectionReturn {
  /** Current text direction */
  direction: TextDirection;
  
  /** Whether the current direction is RTL */
  isRTL: boolean;
  
  /** Whether the current direction is LTR */
  isLTR: boolean;
  
  /** Get CSS logical property value based on direction */
  logical: {
    /** Returns 'right' for LTR, 'left' for RTL */
    start: 'left' | 'right';
    /** Returns 'left' for LTR, 'right' for RTL */
    end: 'right' | 'left';
    /** Returns 'ltr' or 'rtl' */
    dir: TextDirection;
  };
  
  /** Mirror a value for RTL (useful for icons) */
  mirror: <T>(ltrValue: T, rtlValue: T) => T;
  
  /** Get directional class names */
  getDirectionalClass: (ltrClass: string, rtlClass: string) => string;
  
  /** Flip horizontal alignment */
  flipAlign: (align: 'left' | 'right' | 'center') => 'left' | 'right' | 'center';
  
  /** Flip flex direction */
  flipFlexDirection: (direction: 'row' | 'row-reverse') => 'row' | 'row-reverse';
}

/**
 * Custom hook for RTL/LTR direction utilities
 */
export const useDirection = (): UseDirectionReturn => {
  const { direction, currentLanguage } = useLanguageContext();

  return useMemo(() => {
    const isRTL = direction === 'rtl';
    const isLTR = direction === 'ltr';

    return {
      direction,
      isRTL,
      isLTR,
      
      logical: {
        start: isRTL ? 'right' : 'left',
        end: isRTL ? 'left' : 'right',
        dir: direction
      },
      
      mirror: <T>(ltrValue: T, rtlValue: T): T => {
        return isRTL ? rtlValue : ltrValue;
      },
      
      getDirectionalClass: (ltrClass: string, rtlClass: string): string => {
        return isRTL ? rtlClass : ltrClass;
      },
      
      flipAlign: (align: 'left' | 'right' | 'center'): 'left' | 'right' | 'center' => {
        if (align === 'center') return 'center';
        if (!isRTL) return align;
        return align === 'left' ? 'right' : 'left';
      },
      
      flipFlexDirection: (dir: 'row' | 'row-reverse'): 'row' | 'row-reverse' => {
        if (!isRTL) return dir;
        return dir === 'row' ? 'row-reverse' : 'row';
      }
    };
  }, [direction, currentLanguage]);
};

export default useDirection;
