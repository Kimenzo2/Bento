import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Shield, 
    ShieldCheck, 
    ShieldAlert, 
    ShieldX,
    BookOpen,
    AlertTriangle,
    Info,
    X,
    Lightbulb
} from 'lucide-react';

interface SafetyWarning {
    type: 'vocabulary' | 'theme' | 'intensity' | 'content';
    description: string;
    severity: 'info' | 'warning' | 'critical';
    suggestion?: string;
}

interface AudienceSafetyProps {
    isAnalyzing?: boolean;
    isAppropriate: boolean;
    warnings: SafetyWarning[];
    readingLevel: string;
    recommendedAgeRange: string;
    targetAudience: string;
    onDismiss?: () => void;
    onAnalyze?: () => void;
}

const AudienceSafety: React.FC<AudienceSafetyProps> = ({
    isAnalyzing = false,
    isAppropriate,
    warnings,
    readingLevel,
    recommendedAgeRange,
    targetAudience,
    onDismiss,
    onAnalyze
}) => {
    const getWarningIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <ShieldX className="w-4 h-4 text-red-500" />;
            case 'warning': return <ShieldAlert className="w-4 h-4 text-orange-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'vocabulary': return '📚 Vocabulary';
            case 'theme': return '🎭 Theme';
            case 'intensity': return '⚡ Intensity';
            case 'content': return '⚠️ Content';
            default: return type;
        }
    };

    const criticalCount = warnings.filter(w => w.severity === 'critical').length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;

    // Overall status
    const status = criticalCount > 0 
        ? { icon: <ShieldX className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critical Issues' }
        : warningCount > 0 
            ? { icon: <ShieldAlert className="w-5 h-5" />, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Some Warnings' }
            : { icon: <ShieldCheck className="w-5 h-5" />, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Age Appropriate' };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl border ${status.border} ${status.bg} overflow-hidden`}
        >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.bg}`}>
                        {isAnalyzing ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                                <Shield className="w-5 h-5 text-purple-500" />
                            </motion.div>
                        ) : status.icon}
                    </div>
                    <div>
                        <h3 className={`font-semibold text-sm ${status.color}`}>
                            {isAnalyzing ? 'Analyzing Content...' : status.label}
                        </h3>
                        <p className="text-xs text-slate-400">
                            Target: {targetAudience}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {onAnalyze && !isAnalyzing && (
                        <button
                            onClick={onAnalyze}
                            className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                        >
                            Re-analyze
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="p-1 text-slate-400 hover:text-slate-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Reading Level Info */}
            {!isAnalyzing && (
                <div className="px-4 py-2 border-t border-slate-700/30 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400">Reading Level:</span>
                        <span className="text-xs font-medium text-white">{readingLevel}</span>
                    </div>
                    <div className="w-px h-4 bg-slate-700" />
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Recommended Age:</span>
                        <span className={`text-xs font-medium ${
                            recommendedAgeRange === targetAudience ? 'text-green-400' : 'text-orange-400'
                        }`}>
                            {recommendedAgeRange}
                        </span>
                    </div>
                </div>
            )}

            {/* Warnings List */}
            <AnimatePresence>
                {warnings.length > 0 && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-700/30 overflow-hidden"
                    >
                        <div className="p-4 space-y-3">
                            {warnings.map((warning, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`p-3 rounded-lg ${
                                        warning.severity === 'critical' 
                                            ? 'bg-red-500/10 border border-red-500/30' 
                                            : warning.severity === 'warning'
                                                ? 'bg-orange-500/10 border border-orange-500/30'
                                                : 'bg-blue-500/10 border border-blue-500/30'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {getWarningIcon(warning.severity)}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium text-slate-300">
                                                    {getTypeLabel(warning.type)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                {warning.description}
                                            </p>
                                            {warning.suggestion && (
                                                <div className="mt-2 flex items-start gap-2 text-xs">
                                                    <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5" />
                                                    <span className="text-yellow-400/80">{warning.suggestion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* All Clear Message */}
            {!isAnalyzing && warnings.length === 0 && isAppropriate && (
                <div className="px-4 py-3 border-t border-slate-700/30 flex items-center gap-2 text-green-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs">Content is appropriate for {targetAudience}</span>
                </div>
            )}
        </motion.div>
    );
};

export default AudienceSafety;
