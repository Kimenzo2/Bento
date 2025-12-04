import { useState, useEffect, useCallback, useRef } from 'react';

interface AutoSaveOptions<T> {
    key: string;
    data: T;
    interval?: number; // in milliseconds
    enabled?: boolean;
    onSave?: (data: T) => void;
    onRestore?: (data: T) => void;
    debounceMs?: number;
}

interface AutoSaveState {
    lastSaved: Date | null;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    error: string | null;
}

interface UseAutoSaveReturn<T> {
    state: AutoSaveState;
    save: () => void;
    restore: () => T | null;
    clear: () => void;
    hasDraft: boolean;
}

export function useAutoSave<T>({
    key,
    data,
    interval = 30000, // 30 seconds default
    enabled = true,
    onSave,
    onRestore,
    debounceMs = 1000,
}: AutoSaveOptions<T>): UseAutoSaveReturn<T> {
    const [state, setState] = useState<AutoSaveState>({
        lastSaved: null,
        isSaving: false,
        hasUnsavedChanges: false,
        error: null,
    });

    const dataRef = useRef(data);
    const lastSavedDataRef = useRef<string | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Update ref when data changes
    useEffect(() => {
        dataRef.current = data;
        
        // Check if data has changed from last save
        const currentDataStr = JSON.stringify(data);
        if (lastSavedDataRef.current && lastSavedDataRef.current !== currentDataStr) {
            setState(prev => ({ ...prev, hasUnsavedChanges: true }));
        }
    }, [data]);

    // Storage key with prefix
    const storageKey = `genesis_autosave_${key}`;

    // Save function
    const save = useCallback(() => {
        if (!enabled) return;

        setState(prev => ({ ...prev, isSaving: true, error: null }));

        try {
            const dataToSave = {
                data: dataRef.current,
                timestamp: new Date().toISOString(),
                version: 1,
            };
            
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
            lastSavedDataRef.current = JSON.stringify(dataRef.current);
            
            setState({
                lastSaved: new Date(),
                isSaving: false,
                hasUnsavedChanges: false,
                error: null,
            });

            onSave?.(dataRef.current);
        } catch (error) {
            setState(prev => ({
                ...prev,
                isSaving: false,
                error: error instanceof Error ? error.message : 'Failed to save',
            }));
        }
    }, [enabled, storageKey, onSave]);

    // Debounced save (for manual triggering on changes)
    const debouncedSave = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(save, debounceMs);
    }, [save, debounceMs]);

    // Restore function
    const restore = useCallback((): T | null => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (!saved) return null;

            const parsed = JSON.parse(saved);
            const restoredData = parsed.data as T;
            
            lastSavedDataRef.current = JSON.stringify(restoredData);
            setState(prev => ({
                ...prev,
                lastSaved: new Date(parsed.timestamp),
                hasUnsavedChanges: false,
            }));

            onRestore?.(restoredData);
            return restoredData;
        } catch (error) {
            console.error('Failed to restore autosave:', error);
            return null;
        }
    }, [storageKey, onRestore]);

    // Clear saved data
    const clear = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
            lastSavedDataRef.current = null;
            setState({
                lastSaved: null,
                isSaving: false,
                hasUnsavedChanges: false,
                error: null,
            });
        } catch (error) {
            console.error('Failed to clear autosave:', error);
        }
    }, [storageKey]);

    // Check if draft exists
    const hasDraft = (() => {
        try {
            return localStorage.getItem(storageKey) !== null;
        } catch {
            return false;
        }
    })();

    // Set up auto-save interval
    useEffect(() => {
        if (!enabled || interval <= 0) return;

        intervalRef.current = setInterval(() => {
            if (state.hasUnsavedChanges) {
                save();
            }
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, save, state.hasUnsavedChanges]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // Save before page unload if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (state.hasUnsavedChanges && enabled) {
                save();
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [state.hasUnsavedChanges, enabled, save]);

    return {
        state,
        save: debouncedSave,
        restore,
        clear,
        hasDraft,
    };
}

// Auto-save indicator component
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, Check, AlertCircle, Loader } from 'lucide-react';

interface AutoSaveIndicatorProps {
    state: AutoSaveState;
    className?: string;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ state, className = '' }) => {
    const getStatusIcon = () => {
        if (state.error) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        if (state.isSaving) {
            return (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Loader className="w-4 h-4 text-blue-500" />
                </motion.div>
            );
        }
        if (state.hasUnsavedChanges) {
            return <Cloud className="w-4 h-4 text-yellow-500" />;
        }
        if (state.lastSaved) {
            return <Check className="w-4 h-4 text-green-500" />;
        }
        return <CloudOff className="w-4 h-4 text-gray-400" />;
    };

    const getStatusText = () => {
        if (state.error) {
            return `Error: ${state.error}`;
        }
        if (state.isSaving) {
            return 'Saving...';
        }
        if (state.hasUnsavedChanges) {
            return 'Unsaved changes';
        }
        if (state.lastSaved) {
            return `Saved ${formatTimeAgo(state.lastSaved)}`;
        }
        return 'Not saved';
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={getStatusText()}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ${className}`}
            >
                {getStatusIcon()}
                <span>{getStatusText()}</span>
            </motion.div>
        </AnimatePresence>
    );
};

// Draft recovery banner
interface DraftRecoveryBannerProps {
    onRestore: () => void;
    onDiscard: () => void;
    lastSaved?: Date;
}

export const DraftRecoveryBanner: React.FC<DraftRecoveryBannerProps> = ({
    onRestore,
    onDiscard,
    lastSaved,
}) => {
    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                        <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                            Unsaved draft found
                        </p>
                        {lastSaved && (
                            <p className="text-sm text-blue-600 dark:text-blue-300">
                                Last saved {formatTimeAgo(lastSaved)}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onDiscard}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={onRestore}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Restore
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// Helper function
function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default useAutoSave;
