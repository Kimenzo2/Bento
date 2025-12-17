import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface CommitmentCalculatorProps {
    tier: TierConfig;
}

export const CommitmentCalculator: React.FC<CommitmentCalculatorProps> = ({ tier }) => {
    const [booksPerYear, setBooksPerYear] = useState(12);
    const monthlyCost = tier.price.annual; // Using annual price for calculation

    const annualCost = monthlyCost * 12;
    const avgProfitPerBook = 500; // Conservative estimate
    const breakEvenBooks = Math.ceil(annualCost / avgProfitPerBook);

    const totalProfit = (booksPerYear * avgProfitPerBook) - annualCost;

    return (
        <div className="bg-gradient-to-br from-charcoal-soft to-black rounded-3xl p-8 text-white relative overflow-hidden">
            {/* Background blobs */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${tier.gradient} opacity-20 blur-3xl rounded-full`} />

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                <div>
                    <h3 className="font-heading font-bold text-2xl mb-4">When does it pay for itself?</h3>
                    <p className="text-white/70 mb-8">
                        See how quickly your Genesis subscription turns from a cost into a profit engine.
                    </p>

                    <div className="mb-8">
                        <label className="block text-sm font-bold text-white/80 mb-4">
                            I plan to publish <span className="text-xl text-white">{booksPerYear}</span> books this year
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={booksPerYear}
                            onChange={(e) => setBooksPerYear(Number(e.target.value))}
                            className={`w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-${tier.accentColor}-500`}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className={`p-4 rounded-xl bg-white/10 border border-white/10 flex-1`}>
                            <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Break Even</div>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                {breakEvenBooks} Books
                                <Calendar className="w-5 h-5 text-white/50" />
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl bg-gradient-to-br ${tier.gradient} border border-white/10 flex-1`}>
                            <div className="text-xs text-white/80 uppercase tracking-wider mb-1">Projected Profit</div>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                ${totalProfit.toLocaleString()}
                                <DollarSign className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Visualization */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h4 className="font-bold text-white/90 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Profit Timeline
                    </h4>

                    <div className="space-y-6 relative">
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-white/10" />

                        {/* Cost Start */}
                        <div className="flex items-center gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center shrink-0 z-10">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                            </div>
                            <div className="text-sm">
                                <span className="text-red-400 font-bold">-$ {annualCost.toFixed(0)}</span>
                                <span className="text-white/40 ml-2">Initial Annual Cost</span>
                            </div>
                        </div>

                        {/* Break Even */}
                        <div className="flex items-center gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center shrink-0 z-10">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            </div>
                            <div className="text-sm">
                                <span className="text-yellow-400 font-bold">Book {breakEvenBooks}</span>
                                <span className="text-white/40 ml-2">Investment Recovered</span>
                            </div>
                        </div>

                        {/* Profit */}
                        <div className="flex items-center gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center shrink-0 z-10">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            <div className="text-sm">
                                <span className="text-green-400 font-bold px-2 py-0.5 rounded bg-green-500/10">+$ {totalProfit.toLocaleString()}</span>
                                <span className="text-white/40 ml-2">Net Profit</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
