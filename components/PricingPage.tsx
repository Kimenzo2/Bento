import React, { useState, useEffect } from 'react';
import { Check, Star, Zap, Briefcase, Crown, X, Loader } from 'lucide-react';
import { initializePayment, initializeApplePayCheckout, isApplePayAvailable } from '../services/paystackService';

import { UserTier } from '../types';

interface PricingPageProps {
  onUpgrade?: (tier: UserTier) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onUpgrade }) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("author@genesis.ai");

  useEffect(() => {
    try {
      const saved = localStorage.getItem('genesis_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setUserEmail(parsed.email);
      }
    } catch (e) {
      console.error("Failed to load user settings");
    }
  }, []);

  const tiers = [
    {
      name: UserTier.SPARK,
      priceMonthly: 0,
      priceAnnual: 0,
      description: "The Hook That Gets You Addicted",
      icon: Zap,
      color: "bg-gray-100 text-gray-600",
      buttonColor: "bg-gray-200 text-charcoal-soft hover:bg-gray-300",
      features: [
        "3 ebooks per month",
        "Max 4 pages per book",
        "5 illustration styles",
        "Standard templates",
        "Community support"
      ],
      limitations: [
        "Watermarked exports",
        "Basic AI writing",
        "No commercial license"
      ]
    },
    {
      name: UserTier.CREATOR,
      priceMonthly: 19.99,
      priceAnnual: 16.41, // $197/yr
      description: "The Sweet Spot",
      icon: Star,
      color: "bg-blue-50 text-blue-600",
      buttonColor: "bg-blue-500 text-white hover:bg-blue-600",
      saveLabel: "Save 18%",
      features: [
        "30 ebooks per month",
        "Up to 12 pages/book",
        "NO watermarks",
        "20+ illustration styles",
        "Commercial license",
        "Priority rendering"
      ],
      isPopular: false
    },
    {
      name: UserTier.STUDIO,
      priceMonthly: 59.99,
      priceAnnual: 49.92, // $599/yr
      description: "The Professional Choice",
      icon: Briefcase,
      color: "bg-coral-burst/10 text-coral-burst",
      buttonColor: "bg-gradient-to-r from-coral-burst to-gold-sunshine text-white shadow-lg hover:scale-105",
      saveLabel: "Save 17%",
      features: [
        "Everything in Creator",
        "5 team seats",
        "500 pages/book",
        "ALL 50+ styles",
        "White-label exports",
        "Brand Hub & Style Guides",
        "Video book exports"
      ],
      isPopular: true
    },
    {
      name: UserTier.EMPIRE,
      priceMonthly: 199.99,
      priceAnnual: 166.58, // $1999/yr
      description: "Best Value for Scale",
      icon: Crown,
      color: "bg-purple-50 text-purple-600",
      buttonColor: "bg-charcoal-soft text-white hover:bg-black",
      saveLabel: "Save 17%",
      features: [
        "Everything in Studio",
        "Unlimited team members",
        "Unlimited pages",
        "Custom AI Model Training",
        "Dedicated Account Manager",
        "API Access",
        "VIP 24/7 Support"
      ],
      isPopular: false
    }
  ];

  const handleSubscribe = async (tier: any) => {
    if (tier.priceMonthly === 0) {
      // Free tier logic - likely just redirect or do nothing
      alert("You are now on the Free Spark plan!");
      if (onUpgrade) onUpgrade(UserTier.SPARK);
      return;
    }

    setProcessingTier(tier.name);

    // Calculate total amount to charge based on billing cycle
    // Annual prices in the array are "monthly equivalent", so we multiply by 12 for the actual charge
    const amountToCharge = isAnnual ? (tier.priceAnnual * 12) : tier.priceMonthly;

    try {
      // Use Apple Pay checkout on Apple devices for better UX
      // This shows a pre-checkout modal with Apple Pay button on iOS/Safari
      if (isApplePayAvailable()) {
        await initializeApplePayCheckout({
          email: userEmail,
          amount: amountToCharge,
          currency: "USD",
          metadata: {
            tier: tier.name,
            billing_cycle: isAnnual ? 'annual' : 'monthly'
          },
          onSuccess: (transaction) => {
            alert(`Subscription successful! Reference: ${transaction.reference}`);
            setProcessingTier(null);
            if (onUpgrade) onUpgrade(tier.name as UserTier);
          },
          onCancel: () => {
            setProcessingTier(null);
          }
        });
      } else {
        // Fallback to regular Paystack payment for non-Apple devices
        await initializePayment({
          email: userEmail,
          amount: amountToCharge,
          currency: "USD",
          metadata: {
            tier: tier.name,
            billing_cycle: isAnnual ? 'annual' : 'monthly'
          },
          onSuccess: (transaction) => {
            alert(`Subscription successful! Reference: ${transaction.reference}`);
            setProcessingTier(null);
            if (onUpgrade) onUpgrade(tier.name as UserTier);
          },
          onCancel: () => {
            setProcessingTier(null);
          },
          onError: (error) => {
            console.error("Payment error:", error);
            alert(`Payment failed: ${error.message}`);
            setProcessingTier(null);
          }
        });
      }
    } catch (error) {
      console.error("Payment initialization failed:", error);
      alert("Unable to start payment processing. Please try again.");
      setProcessingTier(null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-cream-base pb-24 animate-fadeIn">

      <div className="max-w-7xl mx-auto px-6 pt-12">

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-heading font-bold text-4xl md:text-5xl text-charcoal-soft mb-6">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-burst to-gold-sunshine">Creative Journey</span>
          </h1>
          <p className="font-body text-xl text-cocoa-light max-w-2xl mx-auto mb-10">
            Join 100,000+ creators making beautiful books today. Upgrade to unlock your full potential.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`font-heading font-bold ${!isAnnual ? 'text-charcoal-soft' : 'text-cocoa-light'}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-16 h-8 bg-peach-soft rounded-full p-1 transition-colors duration-300 focus:outline-none"
              title={isAnnual ? 'Switch to monthly billing' : 'Switch to annual billing'}
              aria-label={isAnnual ? 'Switch to monthly billing' : 'Switch to annual billing'}
              role="switch"
              aria-checked={isAnnual}
            >
              <div className={`w-6 h-6 bg-coral-burst rounded-full shadow-md transform transition-transform duration-300 ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`}></div>
            </button>
            <span className={`font-heading font-bold flex items-center gap-2 ${isAnnual ? 'text-charcoal-soft' : 'text-cocoa-light'}`}>
              Annual
              <span className="bg-gold-sunshine/20 text-yellow-600 text-xs px-2 py-0.5 rounded-full">Save up to 18%</span>
            </span>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative bg-white rounded-3xl p-8 border-2 transition-all duration-300 flex flex-col h-full
                ${tier.isPopular
                  ? 'border-gold-sunshine shadow-glow transform scale-105 z-10'
                  : 'border-peach-soft/50 shadow-soft-md hover:shadow-soft-lg hover:-translate-y-2'
                }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white px-4 py-1 rounded-full font-heading font-bold text-sm shadow-md whitespace-nowrap">
                  Most Popular ⭐
                </div>
              )}

              <div className={`w-12 h-12 rounded-2xl ${tier.color} flex items-center justify-center mb-6`}>
                <tier.icon className="w-6 h-6" />
              </div>

              <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-2">{tier.name}</h3>
              <p className="text-xs font-bold text-cocoa-light uppercase tracking-wider mb-6">{tier.description}</p>

              <div className="mb-6">
                <span className="font-heading font-bold text-4xl text-charcoal-soft">
                  ${isAnnual ? tier.priceAnnual : tier.priceMonthly}
                </span>
                <span className="text-cocoa-light font-medium">/mo</span>
                {isAnnual && tier.priceAnnual > 0 && (
                  <div className="text-xs text-green-500 font-bold mt-1">Billed ${Math.ceil(tier.priceAnnual * 12)}/yr</div>
                )}
              </div>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={processingTier !== null}
                className={`w-full py-3 rounded-xl font-heading font-bold transition-all mb-8 ${tier.buttonColor} flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {processingTier === tier.name ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  tier.priceMonthly === 0 ? "Start Creating Free" : "Start 7-Day Free Trial"
                )}
              </button>

              <div className="flex-1 space-y-4 mb-4">
                {tier.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-charcoal-soft font-medium">
                    <div className="mt-0.5 min-w-4 min-h-4 rounded-full bg-mint-breeze flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-600" />
                    </div>
                    {feature}
                  </div>
                ))}
                {tier.limitations?.map((limitation, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-cocoa-light/70">
                    <X className="w-4 h-4 mt-0.5" />
                    {limitation}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
      
      {/* Bottom Illustration with Fade Up Effect */}
      <div className="relative w-full mt-16 overflow-hidden">
        {/* Gradient fade overlay - fades upward */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,248,231,1) 0%, rgba(255,248,231,0.8) 15%, rgba(255,248,231,0) 40%)'
          }}
        />
        
        {/* Illustration container */}
        <div className="relative w-full flex justify-center items-end">
          <img 
            src="/assets/mascots/8k_3d_pixar_202512022053.jpeg"
            alt="Genesis Community"
            className="w-full max-w-7xl h-auto object-contain object-bottom"
            style={{
              maxHeight: '400px',
              minHeight: '200px'
            }}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
