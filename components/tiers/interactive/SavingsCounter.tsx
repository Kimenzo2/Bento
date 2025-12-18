import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Clock, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface SavingsCounterProps {
    tier: TierConfig;
}

type ComparisonMode = 'hiring' | 'competitor' | 'diy';

export const SavingsCounter: React.FC<SavingsCounterProps> = ({ tier }) => {
    const [mode, setMode] = useState<ComparisonMode>('hiring');
    const [savings, setSavings] = useState(0);
    const [projection, setProjection] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    // Configuration for different comparisons
    const comparisons = {
        hiring: {
            label: 'vs Hiring a Designer',
            icon: Users,
            monthlyCost: 1500, // Avg cost for ~5-10 designs
            description: 'based on freelance rates'
        },
        competitor: {
            label: 'vs Competitor Tools',
            icon: TrendingUp,
            monthlyCost: 100, // Avg competitor stack
            description: 'based on multi-tool subscriptions'
        },
        diy: {
            label: 'vs DIY (Your Time)',
            icon: Clock,
            monthlyCost: 800, // 20 hours * $40/hr
            description: 'valuing your time at $40/hr'
        }
    };

    useEffect(() => {
        // Calculate monthly savings
        const tierCost = tier.price.monthly || 0;
        const comparisonCost = comparisons[mode].monthlyCost;
        const monthlySavings = Math.max(0, comparisonCost - tierCost);

        // Animate to new values
        const targetSavings = monthlySavings;
        const targetProjection = monthlySavings * 12;

        // Simple count-up effect
        let start = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);
            const easedProgress = easeOutQuart(progress);

            setSavings(Math.floor(targetSavings * easedProgress));
            setProjection(Math.floor(targetProjection * easedProgress));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [mode, tier.price.monthly]);

    return (
        <div
            className={`relative overflow-hidden rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-12 border border-white/20 shadow-xl ${tier.bgClass.replace('/30', '/50')}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Decorative Elements */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${tier.gradient} opacity-5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2`} />
            <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr ${tier.gradient} opacity-5 blur-2xl rounded-full translate-y-1/2 -translate-x-1/3`} />

            <div className="relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-between">

                {/* Left Side: Controls & Context */}
                <div className="w-full md:w-1/2 space-y-4 md:space-y-6">
                    <div>
                        <h3 className="text-base sm:text-lg md:text-xl font-heading font-bold text-charcoal-soft mb-1 md:mb-2">
                            See How Much You'll Save
                        </h3>
                        <p className="text-charcoal-soft/70 text-xs md:text-sm">
                            Stop overpaying specifically for content creation. Compare Genesis {tier.name} against traditional methods.
                        </p>
                    </div>

                    {/* Toggles */}
                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(comparisons) as ComparisonMode[]).map((key) => {
                            const isActive = mode === key;
                            const Icon = comparisons[key].icon;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setMode(key)}
                                    className={`
                    flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300
                    ${isActive
                                            ? `bg-gradient-to-r ${tier.gradient} text-white shadow-md transform scale-105`
                                            : 'bg-white text-charcoal-soft hover:bg-gray-50 border border-charcoal-soft/10'
                                        }
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {comparisons[key].label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-charcoal-soft/50 italic">
                        <TrendingUp className="w-3 h-3" />
                        Comparison {comparisons[mode].description}
                    </div>
                </div>

                {/* Right Side: Big Numbers */}
                <div className="w-full md:w-1/2 bg-white/60 backdrop-blur-md rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/50 text-center relative overflow-hidden group">
                    <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                    <div className="grid grid-cols-2 gap-2 md:gap-4 divide-x divide-charcoal-soft/10">
                        <div className="space-y-1">
                            <div className="text-charcoal-soft/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Monthly Savings</div>
                            <div className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-black bg-gradient-to-br ${tier.gradient} bg-clip-text text-transparent`}>
                                ${savings.toLocaleString()}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-charcoal-soft/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Yearly Projection</div>
                            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-black text-charcoal-soft flex items-center justify-center gap-1">
                                <span className="text-lg opacity-40">$</span>
                                {projection.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-charcoal-soft/10 flex items-center justify-between">
                        <div className="text-xs text-left">
                            <span className="block font-bold text-charcoal-soft">AI Projection</span>
                            <span className="text-charcoal-soft/60">At your current pace</span>
                        </div>

                        {/* Sparkline visualization (simplified) */}
                        <div className="h-8 flex-1 mx-4 flex items-end justify-end gap-1 opacity-50">
                            {[20, 35, 45, 60, 55, 70, 80, 85, 90, 100].map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                    className={`w-1 rounded-t-sm bg-gradient-to-t ${tier.gradient}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
