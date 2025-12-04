import { useState, useCallback, useRef, useEffect } from 'react';

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UseUndoRedoOptions<T> {
    maxHistory?: number;
    onUndo?: (state: T) => void;
    onRedo?: (state: T) => void;
}

export function useUndoRedo<T>(
    initialState: T,
    options: UseUndoRedoOptions<T> = {}
) {
    const { maxHistory = 50, onUndo, onRedo } = options;

    const [history, setHistory] = useState<HistoryState<T>>({
        past: [],
        present: initialState,
        future: [],
    });

    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;

    // Update state and push to history
    const set = useCallback((newState: T | ((prev: T) => T)) => {
        setHistory(prev => {
            const nextState = typeof newState === 'function' 
                ? (newState as (prev: T) => T)(prev.present)
                : newState;

            // Don't add to history if state hasn't changed
            if (JSON.stringify(nextState) === JSON.stringify(prev.present)) {
                return prev;
            }

            const newPast = [...prev.past, prev.present].slice(-maxHistory);

            return {
                past: newPast,
                present: nextState,
                future: [], // Clear redo stack on new change
            };
        });
    }, [maxHistory]);

    // Undo to previous state
    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.past.length === 0) return prev;

            const previous = prev.past[prev.past.length - 1];
            const newPast = prev.past.slice(0, -1);

            onUndo?.(previous);

            return {
                past: newPast,
                present: previous,
                future: [prev.present, ...prev.future],
            };
        });
    }, [onUndo]);

    // Redo to next state
    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.future.length === 0) return prev;

            const next = prev.future[0];
            const newFuture = prev.future.slice(1);

            onRedo?.(next);

            return {
                past: [...prev.past, prev.present],
                present: next,
                future: newFuture,
            };
        });
    }, [onRedo]);

    // Reset history
    const reset = useCallback((newState: T) => {
        setHistory({
            past: [],
            present: newState,
            future: [],
        });
    }, []);

    // Clear history but keep current state
    const clearHistory = useCallback(() => {
        setHistory(prev => ({
            past: [],
            present: prev.present,
            future: [],
        }));
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    redo();
                } else {
                    e.preventDefault();
                    undo();
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return {
        state: history.present,
        set,
        undo,
        redo,
        reset,
        clearHistory,
        canUndo,
        canRedo,
        historyLength: history.past.length,
        futureLength: history.future.length,
    };
}

// Hook for auto-saving
interface UseAutoSaveOptions<T> {
    data: T;
    onSave: (data: T) => Promise<void> | void;
    interval?: number; // milliseconds
    enabled?: boolean;
    debounceDelay?: number;
}

export function useAutoSave<T>({
    data,
    onSave,
    interval = 30000, // 30 seconds default
    enabled = true,
    debounceDelay = 2000,
}: UseAutoSaveOptions<T>) {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const lastDataRef = useRef<string>(JSON.stringify(data));
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Save function
    const save = useCallback(async (force = false) => {
        const currentData = JSON.stringify(data);
        
        // Skip if data hasn't changed (unless forced)
        if (!force && currentData === lastDataRef.current) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSave(data);
            lastDataRef.current = currentData;
            setLastSaved(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
            console.error('[AutoSave] Error:', err);
        } finally {
            setIsSaving(false);
        }
    }, [data, onSave]);

    // Debounced save on data change
    useEffect(() => {
        if (!enabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            save();
        }, debounceDelay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, enabled, debounceDelay, save]);

    // Periodic save
    useEffect(() => {
        if (!enabled || interval <= 0) return;

        intervalRef.current = setInterval(() => {
            save();
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, save]);

    // Save on unmount
    useEffect(() => {
        return () => {
            if (enabled) {
                save(true);
            }
        };
    }, []);

    // Keyboard shortcut for manual save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                save(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [save]);

    return {
        isSaving,
        lastSaved,
        error,
        save: () => save(true),
    };
}

// Auto-save indicator component
import React from 'react';
import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react';

interface AutoSaveIndicatorProps {
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
    isSaving,
    lastSaved,
    error,
}) => {
    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (error) {
        return (
            <div className="flex items-center gap-2 text-red-500 text-sm">
                <CloudOff className="w-4 h-4" />
                <span>Failed to save</span>
            </div>
        );
    }

    if (isSaving) {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
            </div>
        );
    }

    if (lastSaved) {
        return (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <Check className="w-4 h-4" />
                <span>Saved {formatTime(lastSaved)}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Cloud className="w-4 h-4" />
            <span>Auto-save enabled</span>
        </div>
    );
};

export default { useUndoRedo, useAutoSave, AutoSaveIndicator };
