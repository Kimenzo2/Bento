import { useRef, useEffect, useCallback } from 'react';

interface SwipeConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
    preventDefaultTouchMove?: boolean;
}

interface SwipeState {
    startX: number;
    startY: number;
    startTime: number;
}

export function useSwipeGesture<T extends HTMLElement>(config: SwipeConfig) {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        threshold = 50,
        preventDefaultTouchMove = false
    } = config;

    const elementRef = useRef<T>(null);
    const swipeState = useRef<SwipeState | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        swipeState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now()
        };
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (preventDefaultTouchMove && swipeState.current) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - swipeState.current.startX);
            const deltaY = Math.abs(touch.clientY - swipeState.current.startY);
            
            // If horizontal swipe is detected, prevent default scroll
            if (deltaX > deltaY && deltaX > 10) {
                e.preventDefault();
            }
        }
    }, [preventDefaultTouchMove]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!swipeState.current) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - swipeState.current.startX;
        const deltaY = touch.clientY - swipeState.current.startY;
        const deltaTime = Date.now() - swipeState.current.startTime;

        // Calculate velocity (pixels per millisecond)
        const velocityX = Math.abs(deltaX) / deltaTime;
        const velocityY = Math.abs(deltaY) / deltaTime;

        // Swipe must be fast enough (at least 0.3 px/ms) or long enough
        const isValidSwipe = Math.abs(deltaX) > threshold || 
                            Math.abs(deltaY) > threshold ||
                            velocityX > 0.3 || 
                            velocityY > 0.3;

        if (isValidSwipe) {
            // Determine primary direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > threshold || (deltaX > 0 && velocityX > 0.3)) {
                    onSwipeRight?.();
                } else if (deltaX < -threshold || (deltaX < 0 && velocityX > 0.3)) {
                    onSwipeLeft?.();
                }
            } else {
                // Vertical swipe
                if (deltaY > threshold || (deltaY > 0 && velocityY > 0.3)) {
                    onSwipeDown?.();
                } else if (deltaY < -threshold || (deltaY < 0 && velocityY > 0.3)) {
                    onSwipeUp?.();
                }
            }
        }

        swipeState.current = null;
    }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchMove });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultTouchMove]);

    return elementRef;
}

// Hook for book page navigation specifically
export function useBookSwipeNavigation(
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void
) {
    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages - 1) {
            onPageChange(currentPage + 1);
        }
    }, [currentPage, totalPages, onPageChange]);

    const goToPrevPage = useCallback(() => {
        if (currentPage > 0) {
            onPageChange(currentPage - 1);
        }
    }, [currentPage, onPageChange]);

    const swipeRef = useSwipeGesture<HTMLDivElement>({
        onSwipeLeft: goToNextPage,
        onSwipeRight: goToPrevPage,
        threshold: 50,
        preventDefaultTouchMove: true
    });

    return {
        swipeRef,
        goToNextPage,
        goToPrevPage,
        isFirstPage: currentPage === 0,
        isLastPage: currentPage >= totalPages - 1
    };
}
