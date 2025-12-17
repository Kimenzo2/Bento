import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { TierConfig } from '../TierDetailShared';

interface ROICalculatorProps {
    tier: TierConfig;
}

export const ROICalculator: React.FC<ROICalculatorProps> = ({ tier }) => {
    // Inputs
    const [booksPerMonth, setBooksPerMonth] = useState(5);
    const [pagesPerBook, setPagesPerBook] = useState(12);
    const [hourlyRate, setHourlyRate] = useState(50);

    // Computed Values
    const [monthlyValue, setMonthlyValue] = useState(0);
    const [timeSaved, setTimeSaved] = useState(0);
    const [costPerBook, setCostPerBook] = useState(0);
    const [annualProfit, setAnnualProfit] = useState(0);

    // Constants (Assumptions)
    const HOURS_PER_BOOK_MANUAL = 5; // Creating a book manually takes ~5 hours
    const HOURS_PER_BOOK_GENESIS = 0.5; // Creating with Genesis takes ~30 mins

    useEffect(() => {
        // 1. Time Saved Calculation
        // (Manual Hours - Genesis Hours) * Books
        const hoursSavedPerBook = HOURS_PER_BOOK_MANUAL - HOURS_PER_BOOK_GENESIS;
        const totalTimeSaved = hoursSavedPerBook * booksPerMonth;
        setTimeSaved(Math.round(totalTimeSaved));

        // 2. Monetary Value of Time
        const valueOfTime = totalTimeSaved * hourlyRate;
        setMonthlyValue(Math.round(valueOfTime));

        // 3. Cost Per Book
        // Tier Price / Books
        const tierPrice = tier.price.monthly || 0;
        const cpb = booksPerMonth > 0 ? tierPrice / booksPerMonth : 0;
        setCostPerBook(Number(cpb.toFixed(2)));

        // 4. Annual Profit Projection
        // (Monthly Value - Monthly Cost) * 12
        const monthlyProfit = valueOfTime - tierPrice;
        setAnnualProfit(Math.round(monthlyProfit * 12));

    }, [booksPerMonth, pagesPerBook, hourlyRate, tier.price.monthly]);

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-charcoal-soft/5 overflow-hidden my-16">
            <div className={`bg-gradient-to-r ${tier.gradient} p-1`}></div>
            <div className="p-8 md:p-12 grid lg:grid-cols-2 gap-12">

                {/* Left: Inputs */}
                <div className="space-y-8">
                    <div>
                        <h3 className="text-2xl font-heading font-bold text-charcoal-soft mb-2 flex items-center gap-2">
                            <Calculator className={`w-6 h-6 text-${tier.accentColor}-500`} />
                            Calculate Your ROI
                        </h3>
                        <p className="text-charcoal-soft/70">
                            Adjust the sliders to see what Genesis {tier.name} could mean for your bottom line.
                        </p>
                    </div>

                    {/* Slider 1: Books per Month */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-charcoal-soft text-sm">Books to Create / Month</label>
                            <span className={`px-3 py-1 rounded-full bg-${tier.accentColor}-100 text-${tier.accentColor}-700 font-bold font-mono`}>
                                {booksPerMonth}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={booksPerMonth}
                            onChange={(e) => setBooksPerMonth(Number(e.target.value))}
                            className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-${tier.accentColor}-500`}
                        />
                        <div className="flex justify-between text-xs text-charcoal-soft/40">
                            <span>1 book</span>
                            <span>100 books</span>
                        </div>
                    </div>

                    {/* Slider 2: Hourly Rate */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-charcoal-soft text-sm">Your Hourly Value ($)</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setHourlyRate(30)} className="text-xs text-gray-400 hover:text-gray-600 underline">Junior ($30)</button>
                                <button onClick={() => setHourlyRate(100)} className="text-xs text-gray-400 hover:text-gray-600 underline">Pro ($100)</button>
                                <span className={`ml-2 px-3 py-1 rounded-full bg-${tier.accentColor}-100 text-${tier.accentColor}-700 font-bold font-mono`}>
                                    ${hourlyRate}/hr
                                </span>
                            </div>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="5"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(Number(e.target.value))}
                            className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-${tier.accentColor}-500`}
                        />
                    </div>
                </div>

                {/* Right: Results Dashboard */}
                <div className={`rounded-xl p-8 ${tier.bgClass} relative`}>
                    <div className="grid grid-cols-2 gap-8 relative z-10">

                        {/* Metric 1 */}
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-white/50">
                            <div className="flex items-center gap-2 mb-2 text-charcoal-soft/60 text-xs font-bold uppercase">
                                <Clock className="w-4 h-4" /> Time Saved
                            </div>
                            <div className="text-3xl font-heading font-black text-charcoal-soft">
                                {timeSaved}<span className="text-lg font-normal text-charcoal-soft/50 ml-1">hrs/mo</span>
                            </div>
                        </div>

                        {/* Metric 2 */}
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-white/50">
                            <div className="flex items-center gap-2 mb-2 text-charcoal-soft/60 text-xs font-bold uppercase">
                                <DollarSign className="w-4 h-4" /> Monthly Value
                            </div>
                            <div className={`text-3xl font-heading font-black bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                                ${monthlyValue.toLocaleString()}
                            </div>
                        </div>

                        {/* Metric 3 */}
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-white/50">
                            <div className="flex items-center gap-2 mb-2 text-charcoal-soft/60 text-xs font-bold uppercase">
                                <TrendingUp className="w-4 h-4" /> Cost Per Book
                            </div>
                            <div className="text-3xl font-heading font-black text-charcoal-soft">
                                ${costPerBook}
                            </div>
                        </div>

                        {/* Metric 4 (Big Annual) */}
                        <div className="col-span-2 bg-charcoal-soft rounded-xl p-6 text-white shadow-lg transform scale-105 border border-white/10">
                            <div className="text-white/60 text-sm font-bold uppercase tracking-wider mb-2">Projected Annual Profit</div>
                            <div className="text-4xl md:text-5xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-mint-fresh to-white">
                                ${annualProfit.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-white/40">
                                *Based on time saved vs subscription cost
                            </div>
                        </div>
                    </div>

                    {/* Background Blob decoration */}
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full ${tier.blobColors[0]} blur-3xl opacity-20`} />
                </div>
            </div>
        </div>
    );
};
