import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

interface OfflineIndicatorProps {
    isOnline: boolean;
    isSyncing: boolean;
    pendingChanges: number;
    lastSyncTime: Date | null;
    onSync?: () => void;
    variant?: 'minimal' | 'full';
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
    isOnline,
    isSyncing,
    pendingChanges,
    lastSyncTime,
    onSync,
    variant = 'minimal'
}) => {
    const formatLastSync = (date: Date | null) => {
        if (!date) return 'Never';
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    if (variant === 'minimal') {
        return (
            <AnimatePresence mode="wait">
                {!isOnline ? (
                    <motion.div
                        key="offline"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium"
                    >
                        <WifiOff className="w-3 h-3" />
                        Offline
                        {pendingChanges > 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-500/30 rounded-full text-[10px]">
                                {pendingChanges} pending
                            </span>
                        )}
                    </motion.div>
                ) : isSyncing ? (
                    <motion.div
                        key="syncing"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium"
                    >
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <RefreshCw className="w-3 h-3" />
                        </motion.div>
                        Syncing...
                    </motion.div>
                ) : pendingChanges > 0 ? (
                    <motion.button
                        key="pending"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={onSync}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium hover:bg-yellow-500/30 transition-colors"
                    >
                        <CloudOff className="w-3 h-3" />
                        {pendingChanges} pending
                    </motion.button>
                ) : (
                    <motion.div
                        key="synced"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium"
                    >
                        <Cloud className="w-3 h-3" />
                        Synced
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    // Full variant
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 border ${
                isOnline 
                    ? 'bg-slate-800/40 border-slate-700/50' 
                    : 'bg-orange-500/10 border-orange-500/30'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOnline ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                        {isOnline ? (
                            <Wifi className="w-5 h-5 text-green-400" />
                        ) : (
                            <WifiOff className="w-5 h-5 text-orange-400" />
                        )}
                    </div>
                    <div>
                        <h3 className={`font-semibold text-sm ${isOnline ? 'text-green-400' : 'text-orange-400'}`}>
                            {isOnline ? 'Online' : 'Working Offline'}
                        </h3>
                        <p className="text-xs text-slate-400">
                            {isOnline 
                                ? 'Changes sync automatically' 
                                : 'Changes saved locally'
                            }
                        </p>
                    </div>
                </div>

                {isOnline && pendingChanges > 0 && onSync && (
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSyncing ? (
                            <>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                    <RefreshCw className="w-3 h-3" />
                                </motion.div>
                                Syncing...
                            </>
                        ) : (
                            <>
                                <Cloud className="w-3 h-3" />
                                Sync Now
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <CloudOff className={`w-3 h-3 ${pendingChanges > 0 ? 'text-yellow-400' : 'text-slate-500'}`} />
                        <span className={pendingChanges > 0 ? 'text-yellow-400' : 'text-slate-500'}>
                            {pendingChanges} pending
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-500">
                            Last sync: {formatLastSync(lastSyncTime)}
                        </span>
                    </div>
                </div>
            </div>

            {!isOnline && pendingChanges > 0 && (
                <div className="mt-3 p-2 bg-orange-500/10 rounded-lg">
                    <p className="text-xs text-orange-300">
                        💡 Your changes are saved locally and will sync when you're back online.
                    </p>
                </div>
            )}
        </motion.div>
    );
};

export default OfflineIndicator;
