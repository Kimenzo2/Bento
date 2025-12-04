import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
    isOnline: boolean;
    isSlowConnection: boolean;
    connectionType: string | null;
    downlink: number | null;
    rtt: number | null;
    saveData: boolean;
}

export function useNetworkStatus(): NetworkStatus & {
    checkConnection: () => Promise<boolean>;
} {
    const [status, setStatus] = useState<NetworkStatus>(() => ({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSlowConnection: false,
        connectionType: null,
        downlink: null,
        rtt: null,
        saveData: false,
    }));

    // Get connection info from Network Information API
    const getConnectionInfo = useCallback(() => {
        const connection = (navigator as any).connection || 
                          (navigator as any).mozConnection || 
                          (navigator as any).webkitConnection;
        
        if (connection) {
            return {
                connectionType: connection.effectiveType || connection.type || null,
                downlink: connection.downlink || null,
                rtt: connection.rtt || null,
                saveData: connection.saveData || false,
                isSlowConnection: connection.effectiveType === 'slow-2g' || 
                                 connection.effectiveType === '2g' ||
                                 (connection.rtt && connection.rtt > 500),
            };
        }
        return {
            connectionType: null,
            downlink: null,
            rtt: null,
            saveData: false,
            isSlowConnection: false,
        };
    }, []);

    // Ping server to verify actual connectivity
    const checkConnection = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            // Fallback: try to fetch a small resource
            try {
                await fetch('/favicon.ico', { 
                    method: 'HEAD', 
                    cache: 'no-store' 
                });
                return true;
            } catch {
                return false;
            }
        }
    }, []);

    useEffect(() => {
        const updateStatus = () => {
            const connectionInfo = getConnectionInfo();
            setStatus(prev => ({
                ...prev,
                isOnline: navigator.onLine,
                ...connectionInfo,
            }));
        };

        // Listen for online/offline events
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Listen for connection changes
        const connection = (navigator as any).connection || 
                          (navigator as any).mozConnection || 
                          (navigator as any).webkitConnection;
        
        if (connection) {
            connection.addEventListener('change', updateStatus);
        }

        // Initial check
        updateStatus();

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
            if (connection) {
                connection.removeEventListener('change', updateStatus);
            }
        };
    }, [getConnectionInfo]);

    return { ...status, checkConnection };
}

// React component for offline indicator
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
    position?: 'top' | 'bottom';
    showWhenOnline?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
    position = 'bottom',
    showWhenOnline = false,
}) => {
    const { isOnline, isSlowConnection, checkConnection } = useNetworkStatus();
    const [isChecking, setIsChecking] = React.useState(false);
    const [showOnlineMessage, setShowOnlineMessage] = React.useState(false);

    // Show "back online" message briefly when reconnecting
    useEffect(() => {
        if (isOnline && !showWhenOnline) {
            setShowOnlineMessage(true);
            const timer = setTimeout(() => setShowOnlineMessage(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, showWhenOnline]);

    const handleRetry = async () => {
        setIsChecking(true);
        await checkConnection();
        setIsChecking(false);
    };

    const positionClasses = position === 'top' 
        ? 'top-0 left-0 right-0' 
        : 'bottom-0 left-0 right-0';

    // Don't render if online and not showing online message
    if (isOnline && !showOnlineMessage && !isSlowConnection) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
                className={`fixed ${positionClasses} z-[300] p-4 pointer-events-none`}
            >
                <div className={`
                    max-w-md mx-auto pointer-events-auto
                    ${isOnline && showOnlineMessage 
                        ? 'bg-green-500' 
                        : isSlowConnection 
                            ? 'bg-amber-500' 
                            : 'bg-red-500'
                    }
                    text-white rounded-2xl shadow-lg
                    flex items-center gap-3 px-4 py-3
                `}>
                    {isOnline && showOnlineMessage ? (
                        <>
                            <Wifi className="w-5 h-5" />
                            <span className="flex-1 font-medium">Back online!</span>
                        </>
                    ) : isSlowConnection ? (
                        <>
                            <AlertTriangle className="w-5 h-5" />
                            <span className="flex-1 font-medium">Slow connection detected</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="w-5 h-5" />
                            <div className="flex-1">
                                <p className="font-medium">You're offline</p>
                                <p className="text-sm text-white/80">
                                    Some features may not be available
                                </p>
                            </div>
                            <button
                                onClick={handleRetry}
                                disabled={isChecking}
                                title="Retry connection"
                                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

// Queue for offline actions
interface OfflineAction {
    id: string;
    type: string;
    payload: any;
    timestamp: number;
    retries: number;
}

const OFFLINE_QUEUE_KEY = 'genesis_offline_queue';

export function useOfflineQueue() {
    const [queue, setQueue] = useState<OfflineAction[]>(() => {
        try {
            const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const { isOnline } = useNetworkStatus();

    // Save queue to localStorage
    useEffect(() => {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }, [queue]);

    // Add action to queue
    const addToQueue = useCallback((type: string, payload: any) => {
        const action: OfflineAction = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            payload,
            timestamp: Date.now(),
            retries: 0,
        };
        setQueue(prev => [...prev, action]);
        return action.id;
    }, []);

    // Remove action from queue
    const removeFromQueue = useCallback((id: string) => {
        setQueue(prev => prev.filter(action => action.id !== id));
    }, []);

    // Process queue when back online
    const processQueue = useCallback(async (
        processor: (action: OfflineAction) => Promise<boolean>
    ) => {
        if (!isOnline || queue.length === 0) return;

        for (const action of queue) {
            try {
                const success = await processor(action);
                if (success) {
                    removeFromQueue(action.id);
                } else {
                    // Increment retry count
                    setQueue(prev => prev.map(a => 
                        a.id === action.id 
                            ? { ...a, retries: a.retries + 1 }
                            : a
                    ));
                }
            } catch (error) {
                console.error('[OfflineQueue] Failed to process action:', action, error);
            }
        }
    }, [isOnline, queue, removeFromQueue]);

    // Clear old actions (older than 24 hours)
    useEffect(() => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        setQueue(prev => prev.filter(action => action.timestamp > oneDayAgo));
    }, []);

    return {
        queue,
        queueLength: queue.length,
        addToQueue,
        removeFromQueue,
        processQueue,
        clearQueue: () => setQueue([]),
    };
}

export default { useNetworkStatus, OfflineIndicator, useOfflineQueue };
