import { useState, useCallback, useRef, TouchEvent } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeConfig {
    threshold?: number; // minimum distance to trigger swipe
    velocity?: number; // minimum velocity to trigger swipe
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onSwipe?: (direction: SwipeDirection) => void;
    preventDefaultOnSwipe?: boolean;
}

interface SwipeState {
    swiping: boolean;
    direction: SwipeDirection | null;
    offset: { x: number; y: number };
    velocity: { x: number; y: number };
}

interface TouchPoint {
    x: number;
    y: number;
    time: number;
}

export function useSwipeGesture(config: SwipeConfig = {}) {
    const {
        threshold = 50,
        velocity: velocityThreshold = 0.3,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onSwipe,
        preventDefaultOnSwipe = false,
    } = config;

    const [state, setState] = useState<SwipeState>({
        swiping: false,
        direction: null,
        offset: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
    });

    const startRef = useRef<TouchPoint | null>(null);
    const currentRef = useRef<TouchPoint | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        startRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
        currentRef.current = startRef.current;
        setState(prev => ({ ...prev, swiping: true }));
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!startRef.current) return;

        const touch = e.touches[0];
        const now = Date.now();
        
        currentRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: now,
        };

        const deltaX = currentRef.current.x - startRef.current.x;
        const deltaY = currentRef.current.y - startRef.current.y;
        const deltaTime = (now - startRef.current.time) / 1000;

        const velocityX = deltaX / deltaTime;
        const velocityY = deltaY / deltaTime;

        // Determine swipe direction
        let direction: SwipeDirection | null = null;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }

        setState({
            swiping: true,
            direction,
            offset: { x: deltaX, y: deltaY },
            velocity: { x: velocityX, y: velocityY },
        });

        if (preventDefaultOnSwipe && Math.abs(deltaX) > 10) {
            e.preventDefault();
        }
    }, [preventDefaultOnSwipe]);

    const handleTouchEnd = useCallback(() => {
        if (!startRef.current || !currentRef.current) {
            setState({ swiping: false, direction: null, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
            return;
        }

        const deltaX = currentRef.current.x - startRef.current.x;
        const deltaY = currentRef.current.y - startRef.current.y;
        const deltaTime = (currentRef.current.time - startRef.current.time) / 1000;

        const velocityX = Math.abs(deltaX / deltaTime);
        const velocityY = Math.abs(deltaY / deltaTime);

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        let direction: SwipeDirection | null = null;

        // Check if swipe meets threshold (distance or velocity)
        if (absX > absY) {
            if (absX > threshold || velocityX > velocityThreshold * 1000) {
                direction = deltaX > 0 ? 'right' : 'left';
            }
        } else {
            if (absY > threshold || velocityY > velocityThreshold * 1000) {
                direction = deltaY > 0 ? 'down' : 'up';
            }
        }

        // Trigger callbacks
        if (direction) {
            onSwipe?.(direction);
            
            switch (direction) {
                case 'left':
                    onSwipeLeft?.();
                    break;
                case 'right':
                    onSwipeRight?.();
                    break;
                case 'up':
                    onSwipeUp?.();
                    break;
                case 'down':
                    onSwipeDown?.();
                    break;
            }
        }

        // Reset state
        startRef.current = null;
        currentRef.current = null;
        setState({ swiping: false, direction: null, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
    }, [threshold, velocityThreshold, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

    const handlers = {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchEnd,
    };

    return { ...state, handlers };
}

// Swipeable Page Navigator Component
import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface SwipeablePageProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    children: React.ReactNode;
    className?: string;
}

export const SwipeablePage: React.FC<SwipeablePageProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    children,
    className = '',
}) => {
    const handleDragEnd = (_event: any, info: PanInfo) => {
        const threshold = 100;
        const velocity = info.velocity.x;
        const offset = info.offset.x;

        if (offset < -threshold || velocity < -500) {
            // Swiped left - next page
            if (currentPage < totalPages - 1) {
                onPageChange(currentPage + 1);
            }
        } else if (offset > threshold || velocity > 500) {
            // Swiped right - previous page
            if (currentPage > 0) {
                onPageChange(currentPage - 1);
            }
        }
    };

    return (
        <motion.div
            className={`touch-pan-y ${className}`}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            whileDrag={{ cursor: 'grabbing' }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.2 }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

// Swipe indicator dots
interface SwipeDotsProps {
    total: number;
    current: number;
    onDotClick?: (index: number) => void;
    className?: string;
}

export const SwipeDots: React.FC<SwipeDotsProps> = ({
    total,
    current,
    onDotClick,
    className = '',
}) => {
    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            {Array.from({ length: total }).map((_, i) => (
                <button
                    key={i}
                    onClick={() => onDotClick?.(i)}
                    className={`
                        w-2 h-2 rounded-full transition-all duration-300
                        ${i === current 
                            ? 'w-6 bg-coral-burst' 
                            : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                        }
                    `}
                    aria-label={`Go to page ${i + 1}`}
                />
            ))}
        </div>
    );
};

// Pull to refresh hook
interface PullToRefreshConfig {
    onRefresh: () => Promise<void>;
    threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshConfig) {
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    
    const startY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (containerRef.current?.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
            setPulling(true);
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!pulling || refreshing) return;

        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, currentY - startY.current);
        
        // Apply resistance
        const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(resistedDistance);

        if (resistedDistance > 10) {
            e.preventDefault();
        }
    }, [pulling, refreshing, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance >= threshold && !refreshing) {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
        }
        
        setPulling(false);
        setPullDistance(0);
    }, [pullDistance, threshold, refreshing, onRefresh]);

    const progress = Math.min(pullDistance / threshold, 1);
    const shouldRefresh = pullDistance >= threshold;

    return {
        containerRef,
        pullDistance,
        refreshing,
        progress,
        shouldRefresh,
        handlers: {
            onTouchStart: handleTouchStart as any,
            onTouchMove: handleTouchMove as any,
            onTouchEnd: handleTouchEnd,
        },
    };
}

// Pull to refresh indicator component
interface PullIndicatorProps {
    distance: number;
    threshold: number;
    refreshing: boolean;
}

export const PullIndicator: React.FC<PullIndicatorProps> = ({
    distance,
    threshold,
    refreshing,
}) => {
    const progress = Math.min(distance / threshold, 1);

    if (distance === 0 && !refreshing) return null;

    return (
        <motion.div
            className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
            style={{ height: distance }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.div
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${refreshing ? 'bg-coral-burst' : 'bg-gray-200 dark:bg-gray-700'}
                `}
                animate={refreshing ? { rotate: 360 } : { rotate: progress * 360 }}
                transition={refreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
            >
                <svg
                    className={`w-5 h-5 ${refreshing ? 'text-white' : 'text-gray-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
            </motion.div>
        </motion.div>
    );
};

export default useSwipeGesture;
