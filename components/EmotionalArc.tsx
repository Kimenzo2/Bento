import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Minus, Zap, Info } from 'lucide-react';

interface ArcPoint {
    pageNumber: number;
    sentiment: number; // -1 to 1
    tension: number; // 0 to 10
    label: string;
}

interface EmotionalArcProps {
    arc: ArcPoint[];
    climaxPage: number;
    pacing: 'slow' | 'medium' | 'fast' | 'uneven';
    suggestions: string[];
    onPageClick?: (pageNumber: number) => void;
    currentPage?: number;
}

const EmotionalArc: React.FC<EmotionalArcProps> = ({
    arc,
    climaxPage,
    pacing,
    suggestions,
    onPageClick,
    currentPage
}) => {
    // Calculate SVG path for the emotional arc line
    const svgPath = useMemo(() => {
        if (arc.length < 2) return '';
        
        const width = 100;
        const height = 50;
        const padding = 5;
        
        const points = arc.map((point, i) => {
            const x = padding + ((width - 2 * padding) / (arc.length - 1)) * i;
            // Normalize sentiment (-1 to 1) to y coordinate (height to 0)
            const y = height - padding - ((point.sentiment + 1) / 2) * (height - 2 * padding);
            return { x, y };
        });
        
        // Create smooth curve using quadratic bezier
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpX = (prev.x + curr.x) / 2;
            path += ` Q ${prev.x + (curr.x - prev.x) * 0.5} ${prev.y} ${cpX} ${(prev.y + curr.y) / 2}`;
        }
        path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        
        return path;
    }, [arc]);

    const getPacingInfo = () => {
        switch (pacing) {
            case 'slow': return { icon: <Minus className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-500/20' };
            case 'medium': return { icon: <Activity className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/20' };
            case 'fast': return { icon: <Zap className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/20' };
            case 'uneven': return { icon: <TrendingDown className="w-4 h-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
            default: return { icon: <Activity className="w-4 h-4" />, color: 'text-gray-400', bg: 'bg-gray-500/20' };
        }
    };

    const pacingInfo = getPacingInfo();

    if (arc.length === 0) {
        return (
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 text-center">
                <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No emotional arc data available</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold text-white">Emotional Arc</h3>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${pacingInfo.bg}`}>
                    {pacingInfo.icon}
                    <span className={`text-xs font-medium ${pacingInfo.color} capitalize`}>{pacing} pacing</span>
                </div>
            </div>

            {/* Arc Visualization */}
            <div className="p-4">
                <div className="relative h-32 bg-slate-900/50 rounded-lg overflow-hidden">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between py-2">
                        <div className="h-px bg-green-500/20 w-full" />
                        <div className="h-px bg-slate-700/50 w-full" />
                        <div className="h-px bg-red-500/20 w-full" />
                    </div>
                    
                    {/* Labels */}
                    <div className="absolute left-2 top-1 text-[10px] text-green-400/60">Positive</div>
                    <div className="absolute left-2 bottom-1 text-[10px] text-red-400/60">Negative</div>

                    {/* SVG Arc Line */}
                    <svg 
                        viewBox="0 0 100 50" 
                        className="absolute inset-0 w-full h-full"
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#8B5CF6" />
                                <stop offset="50%" stopColor="#EC4899" />
                                <stop offset="100%" stopColor="#F97316" />
                            </linearGradient>
                        </defs>
                        <motion.path
                            d={svgPath}
                            fill="none"
                            stroke="url(#arcGradient)"
                            strokeWidth="0.8"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.5, ease: 'easeInOut' }}
                        />
                    </svg>

                    {/* Data Points */}
                    <div className="absolute inset-0 flex justify-between items-end px-2 pb-2">
                        {arc.map((point, i) => {
                            const heightPercent = ((point.sentiment + 1) / 2) * 100;
                            const isClimax = point.pageNumber === climaxPage;
                            const isCurrent = point.pageNumber === currentPage;
                            
                            return (
                                <motion.button
                                    key={point.pageNumber}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    onClick={() => onPageClick?.(point.pageNumber)}
                                    className="relative group"
                                    style={{ marginBottom: `${heightPercent - 50}%` }}
                                >
                                    <div 
                                        className={`w-3 h-3 rounded-full transition-all ${
                                            isClimax 
                                                ? 'bg-yellow-400 ring-2 ring-yellow-400/50 scale-125' 
                                                : isCurrent
                                                    ? 'bg-purple-500 ring-2 ring-purple-500/50'
                                                    : 'bg-slate-400 hover:bg-purple-400'
                                        }`}
                                    />
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        <div className="bg-slate-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg border border-slate-700">
                                            <div className="font-bold">Page {point.pageNumber}</div>
                                            <div className="text-slate-400">{point.label}</div>
                                            <div className="text-[10px] mt-1">
                                                Tension: {point.tension}/10
                                            </div>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Page Labels */}
                <div className="flex justify-between mt-2 px-1">
                    {arc.map((point) => (
                        <span 
                            key={point.pageNumber}
                            className={`text-[10px] ${
                                point.pageNumber === climaxPage 
                                    ? 'text-yellow-400 font-bold' 
                                    : 'text-slate-500'
                            }`}
                        >
                            {point.pageNumber}
                        </span>
                    ))}
                </div>
            </div>

            {/* Climax Indicator */}
            <div className="px-4 py-2 border-t border-slate-700/30 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400">Climax at page <span className="text-yellow-400 font-bold">{climaxPage}</span></span>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/30 bg-slate-900/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-medium text-blue-400">Suggestions</span>
                    </div>
                    <ul className="space-y-1">
                        {suggestions.slice(0, 3).map((suggestion, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                {suggestion}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default EmotionalArc;
