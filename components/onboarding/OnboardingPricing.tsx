import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, Star, Zap, Briefcase, X, Loader, ArrowRight, Shield, Gift, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from './OnboardingState';
import { initializePayment, initializeApplePayCheckout, isApplePayAvailable } from '../../services/paystackService';
import { UserTier } from '../../types';

// Tier data matching PricingPage
const tiers = [
  {
    name: 'OFFER',
    displayName: 'Onboarding Exclusive',
    priceMonthly: 11.99,
    originalPrice: 19.99,
    priceAnnual: 11.99, // Keep it simple for the special offer
    description: 'Same features as Creator',
    icon: Gift,
    gradient: 'from-purple-500 via-pink-500 to-amber-500',
    glowColor: 'shadow-purple-500/40',
    borderColor: 'border-amber-400/50',
    paystackPaymentUrl: 'https://paystack.shop/pay/mfkoveuu1o', // Using Creator link for now
    planCode: 'PLN_zbnzvdqjsdxfcqc',
    features: [
      '30 ebooks per month',
      'Up to 12 pages/book',
      'NO watermarks',
      '20+ illustration styles',
      'Commercial license',
      'Priority rendering',
    ],
    limitations: []
  },
  {
    name: UserTier.CREATOR,
    displayName: 'Creator',
    priceMonthly: 19.99,
    priceAnnual: 16.41,
    description: 'Most Popular',
    icon: Star,
    gradient: 'from-blue-500 to-cyan-500',
    glowColor: 'shadow-blue-500/30',
    borderColor: 'border-blue-400/30',
    saveLabel: 'Save 18%',
    paystackPaymentUrl: 'https://paystack.shop/pay/mfkoveuu1o',
    planCode: 'PLN_zbnzvdqjsdxfcqc',
    features: [
      '30 ebooks per month',
      'Up to 12 pages/book',
      'NO watermarks',
      '20+ illustration styles',
      'Commercial license',
      'Priority rendering',
    ],
    isPopular: false,
  },
  {
    name: UserTier.STUDIO,
    displayName: 'Studio',
    priceMonthly: 59.99,
    priceAnnual: 49.92,
    description: 'Professional',
    icon: Briefcase,
    gradient: 'from-purple-500 via-pink-500 to-amber-500',
    glowColor: 'shadow-purple-500/40',
    borderColor: 'border-amber-400/40',
    saveLabel: 'Save 17%',
    paystackPaymentUrl: 'https://paystack.shop/pay/akv70alb1x',
    planCode: 'PLN_09zg1ly5kg57niz',
    features: [
      'Everything in Creator',
      '5 team seats',
      '500 pages/book',
      'ALL 50+ styles',
      'White-label exports',
      'Brand Hub & Style Guides',
    ],
    isPopular: true,
  },
  {
    name: UserTier.EMPIRE,
    displayName: 'Empire',
    priceMonthly: 199.99,
    priceAnnual: 166.58,
    description: 'Enterprise',
    icon: Crown,
    gradient: 'from-amber-400 to-yellow-500',
    glowColor: 'shadow-amber-500/30',
    borderColor: 'border-amber-400/30',
    saveLabel: 'Save 17%',
    paystackPaymentUrl: 'https://paystack.shop/pay/uvcz30todn',
    planCode: 'PLN_tv2y349z88b1bd8',
    features: [
      'Everything in Studio',
      'Unlimited team members',
      'Unlimited pages',
      'Custom AI Model Training',
      'Dedicated Account Manager',
      'API Access',
    ],
    isPopular: false,
  },
];

// Reusing UrgencyTimer from ProRevealMoment for consistency
const UrgencyTimer = () => {
  const [timeLeft, setTimeLeft] = useState(599); // 9:59

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] md:text-[10px] font-bold ${timeLeft < 60
      ? 'bg-red-500/20 border-red-400/50 text-red-300'
      : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
      }`}>
      <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
      <span>{minutes}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
};



export const OnboardingPricing: React.FC = () => {
  const { setStep, addSparkPoints } = useOnboarding();
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(true);
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('author@genesis.ai');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('genesis_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setUserEmail(parsed.email);
      }
    } catch (e) {
      console.error('Failed to load user settings');
    }
  }, []);

  // Helper to get user ID
  const getUserId = async (): Promise<string> => {
    try {
      const { supabase } = await import('../../services/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) return user.id;

      let localUserId = localStorage.getItem('genesis_user_id');
      if (!localUserId) {
        localUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('genesis_user_id', localUserId);
      }
      return localUserId;
    } catch (error) {
      return `temp_${Date.now()}`;
    }
  };

  const handleSubscribe = async (tier: typeof tiers[0]) => {
    if (tier.priceMonthly === 0) {
      // Free tier - continue to tour
      addSparkPoints(5);
      setStep('tour');
      return;
    }

    setProcessingTier(tier.name);
    setSelectedTier(tier.name);

    if (tier.paystackPaymentUrl && tier.planCode) {
      try {
        const userId = await getUserId();
        const paymentUrl = new URL(tier.paystackPaymentUrl);
        paymentUrl.searchParams.append('email', userEmail);
        paymentUrl.searchParams.append('metadata[user_id]', userId);
        paymentUrl.searchParams.append('metadata[plan_code]', tier.planCode);
        paymentUrl.searchParams.append('metadata[billing_cycle]', isAnnual ? 'annual' : 'monthly');
        paymentUrl.searchParams.append('metadata[source]', 'onboarding');

        const paymentWindow = window.open(
          paymentUrl.toString(),
          '_blank',
          'width=600,height=800,scrollbars=yes,resizable=yes'
        );

        if (!paymentWindow) {
          alert('Please allow pop-ups to complete payment');
          setProcessingTier(null);
          return;
        }

        const pollInterval = setInterval(() => {
          if (paymentWindow.closed) {
            clearInterval(pollInterval);
            setProcessingTier(null);
            // Continue to tour after payment window closes
            addSparkPoints(50);
            setStep('tour');
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setProcessingTier(null);
        }, 300000);

      } catch (error) {
        console.error('Failed to open payment page:', error);
        alert('Unable to start payment. Please try again.');
        setProcessingTier(null);
      }
      return;
    }

    // Fallback payment flow
    const amountToCharge = isAnnual ? (tier.priceAnnual * 12) : tier.priceMonthly;

    try {
      if (isApplePayAvailable()) {
        await initializeApplePayCheckout({
          email: userEmail,
          amount: amountToCharge,
          currency: 'USD',
          metadata: {
            tier: tier.name,
            billing_cycle: isAnnual ? 'annual' : 'monthly',
            source: 'onboarding',
          },
          onSuccess: () => {
            setProcessingTier(null);
            addSparkPoints(50);
            setStep('tour');
          },
          onCancel: () => {
            setProcessingTier(null);
          },
        });
      } else {
        await initializePayment({
          email: userEmail,
          amount: amountToCharge,
          currency: 'USD',
          metadata: {
            tier: tier.name,
            billing_cycle: isAnnual ? 'annual' : 'monthly',
            source: 'onboarding',
          },
          onSuccess: () => {
            setProcessingTier(null);
            addSparkPoints(50);
            setStep('tour');
          },
          onCancel: () => {
            setProcessingTier(null);
          },
          onError: (error) => {
            console.error('Payment error:', error);
            alert(`Payment failed: ${error.message}`);
            setProcessingTier(null);
          },
        });
      }
    } catch (error) {
      console.error('Payment initialization failed:', error);
      alert('Unable to start payment processing. Please try again.');
      setProcessingTier(null);
    }
  };

  const handleSkip = () => {
    setStep('tour');
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center px-[var(--ob-container-padding)] py-6 overflow-x-hidden overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-[#0a0a0f] to-blue-950/30" />

      {/* Ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-10 left-0 w-72 h-72 bg-purple-600 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-10 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px]"
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col py-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 md:mb-10"
        >
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-3 font-heading">
            Choose Your
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent"> Creative Journey</span>
          </h1>
          <p className="text-white/50 text-sm md:text-lg max-w-md mx-auto mb-4">
            Join 100,000+ creators making beautiful books
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-2">
            <span className={`text-xs font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-white/50'}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-[44px] h-[22px] bg-white/15 rounded-full transition-all border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
              role="switch"
              aria-checked={isAnnual}
            >
              <motion.div
                animate={{ x: isAnnual ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[2px] w-[18px] h-[18px] bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-lg"
              />
            </button>
            <span className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${isAnnual ? 'text-white' : 'text-white/50'}`}>
              Annual
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30">
                Save 18%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--ob-card-gap)] mb-6">
          {tiers.map((tier, index) => {
            const isSelected = selectedTier === tier.name;
            const isProcessing = processingTier === tier.name;
            const isOffer = tier.name === 'OFFER';

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white/5 backdrop-blur-xl rounded-2xl border ob-p-card flex flex-col transition-all duration-300 ${tier.isPopular || isOffer
                  ? `${isOffer ? 'border-amber-400/60' : 'border-amber-400/50'} ${tier.glowColor} shadow-xl`
                  : `${tier.borderColor} hover:border-white/20`
                  } ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
              >
                {/* Popular/Offer Badge */}
                {(tier.isPopular || isOffer) && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold whitespace-nowrap z-10 ${isOffer
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white'
                    }`}>
                    {isOffer ? '🔥 EXCLUSIVE DEAL' : '⭐ Most Popular'}
                  </div>
                )}

                {/* Card Header Content (Icon or Discount Info) */}
                <div className="flex flex-col items-start gap-1 mb-2">
                  <div className="w-full flex items-start justify-between gap-1 overflow-hidden">
                    {isOffer ? (
                      <div className="flex flex-col flex-shrink-0">
                        <div className="flex items-center gap-0.5">
                          <span className="text-white/40 line-through text-[8px] font-bold">$19.99</span>
                          <span className="text-sm md:text-xl font-black text-white">$11.99</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`w-7 h-7 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center flex-shrink-0`}>
                        <tier.icon className="w-3.5 h-3.5 md:w-6 md:h-6 text-white" />
                      </div>
                    )}
                    {isOffer && <div className="flex-shrink-0 scale-90 origin-right"><UrgencyTimer /></div>}
                  </div>

                  {isOffer && (
                    <div className="flex items-center gap-1 px-1 py-0.5 bg-emerald-500/20 rounded-md border border-emerald-400/30">
                      <Zap className="w-2 h-2 text-emerald-400" />
                      <span className="text-emerald-400 text-[7px] font-bold">40% OFF FOREVER</span>
                    </div>
                  )}
                </div>

                {/* Name & Description */}
                <h3 className="text-[12px] md:text-xl font-bold text-white mb-0.5 truncate leading-tight">{tier.displayName}</h3>
                <p className="text-white/40 text-[8px] md:text-[10px] mb-2 leading-tight line-clamp-2 md:line-clamp-none h-5 md:h-auto">{tier.description}</p>

                {/* Price (Standard cards show price here, discounted shows original above) */}
                {!isOffer && (
                  <div className="mb-2">
                    <span className="text-xl md:text-3xl font-bold text-white">
                      ${isAnnual ? tier.priceAnnual : tier.priceMonthly}
                    </span>
                    <span className="text-white/40 text-xs md:text-sm">/mo</span>
                    {isAnnual && tier.priceAnnual > 0 && (
                      <div className="text-emerald-400 text-[9px] md:text-xs mt-0.5">
                        ${Math.ceil(tier.priceAnnual * 12)}/yr
                      </div>
                    )}
                  </div>
                )}

                {/* Features */}
                <div className="flex-1 space-y-1 md:space-y-1.5 mb-2 md:mb-3 overflow-hidden">
                  {tier.features.slice(0, isOffer ? 5 : 4).map((feature, i) => (
                    <div key={i} className="flex items-start gap-1 text-[8px] md:text-xs text-white/70">
                      <Check className="w-2 h-2 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1 leading-none">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <motion.button
                  onClick={() => handleSubscribe(tier as any)}
                  disabled={processingTier !== null}
                  whileHover={{ scale: processingTier ? 1 : 1.02 }}
                  whileTap={{ scale: processingTier ? 1 : 0.98 }}
                  className={`w-full py-1.5 md:py-3 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm transition-all flex items-center justify-center gap-1 ${tier.isPopular || isOffer
                    ? `bg-gradient-to-r ${tier.gradient} text-white shadow-lg`
                    : 'bg-white/10 text-white hover:bg-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-3 h-3 animate-spin" />
                      ...
                    </>
                  ) : (
                    <>
                      {isOffer ? 'Claim Offer' : 'Upgrade'}
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </motion.button>

                {/* Why Choose Button */}
                {tier.name !== UserTier.SPARK && tier.name !== 'OFFER' && (
                  <button
                    onClick={() => navigate(`/tier/${tier.name.toLowerCase()}`)}
                    className="w-full mt-2 py-2 rounded-lg font-medium text-[10px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                  >
                    Why Choose {tier.displayName}?
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Trust Signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-4 text-white/40 text-xs mb-4"
        >
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            Secure Payment
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            Cancel anytime
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            7-day money back
          </span>
        </motion.div>

        {/* Skip Link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={handleSkip}
          className="text-white/30 hover:text-white/50 text-sm transition-colors mx-auto"
        >
          Maybe later, continue with Free →
        </motion.button>
      </div>
    </div>
  );
};
