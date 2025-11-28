import React from 'react';
import { X, Rocket, Check, Zap } from 'lucide-react';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpgrade: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, onUpgrade }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-charcoal-soft/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="bg-charcoal-soft pt-12 pb-16 px-8 text-center relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>

                    {/* Floating Icon */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-charcoal-soft rounded-2xl flex items-center justify-center border-4 border-white shadow-lg z-10 overflow-hidden">
                        <svg viewBox="0 0 24 24" className="w-10 h-10 text-gold-sunshine" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <defs>
                                <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#FF6B6B" />
                                    <stop offset="100%" stopColor="#FFD93D" />
                                </linearGradient>
                            </defs>
                            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#sparkGradient)" stroke="none" />
                            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="url(#sparkGradient)" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" fill="white" fillOpacity="0.2" />
                        </svg>
                    </div>

                    <h2 className="font-heading font-bold text-2xl text-white mb-2 relative z-10">
                        Whoa, Slow Down Shakespeare! 🎭
                    </h2>
                    <p className="text-cocoa-light/80 text-sm font-medium relative z-10">
                        Your imagination is moving faster than your plan.
                    </p>
                </div>

                {/* Body */}
                <div className="pt-12 pb-8 px-8">

                    {/* Highlight Box */}
                    <div className="bg-mint-breeze/30 rounded-xl p-4 mb-6 flex items-center gap-4 border border-mint-breeze">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                            <Zap className="w-5 h-5 text-green-600 fill-current" />
                        </div>
                        <div>
                            <h3 className="font-heading font-bold text-charcoal-soft text-sm">Unlock Unlimited Power</h3>
                            <p className="text-xs text-cocoa-light">Save 18% when you upgrade to annual</p>
                        </div>
                    </div>

                    {/* Benefits List */}
                    <div className="space-y-3 mb-8">
                        {[
                            "Create UNLIMITED books per month",
                            "Generate UNLIMITED AI illustrations",
                            "Up to 100 pages per story",
                            "Remove all watermarks",
                            "Commercial rights included"
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-charcoal-soft">
                                <div className="w-5 h-5 rounded-full bg-coral-burst/10 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 text-coral-burst" />
                                </div>
                                {benefit}
                            </div>
                        ))}
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={onUpgrade}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-heading font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                    >
                        Upgrade to Creator
                        <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Footer */}
                    <p className="text-center text-xs text-cocoa-light mt-4">
                        14-day free trial • Cancel anytime • No hidden fees
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;
