import { Briefcase, Check, Crown, Loader, Star, X, Zap } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePageSEO } from '../hooks/usePageSEO';
import type { LucideProps } from 'lucide-react';
import { UserTier } from '../types';
import { createDodoCheckout } from '../services/dodoService';
import { supportsAnnualDodoBilling, tierToDodoPlan } from '../config/dodoPricing';
import { Button } from './ui/button';
import { Switch } from './ui/switch';

interface PricingPageProps {
  onUpgrade?: (tier: UserTier) => void;
}

interface TierData {
  name: UserTier;
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >;
  color: string;
  buttonColor: string;
  features: string[];
  limitations?: string[];
  saveLabel?: string;
  isPopular?: boolean;
}

const tiers: TierData[] = [
  {
    name: UserTier.SPARK,
    priceMonthly: 0,
    priceAnnual: 0,
    description: 'The Hook That Gets You Addicted',
    icon: Zap,
    color: 'bg-peach-soft/30 text-cocoa-light',
    buttonColor: 'bg-peach-light/50 text-charcoal-soft hover:bg-gray-300',
    features: [
      '3 ebooks per month',
      'Max 4 pages per book',
      '5 illustration styles',
      'Standard templates',
      'Community support',
    ],
    limitations: ['Watermarked exports', 'Basic AI writing', 'No commercial license'],
  },
  {
    name: UserTier.CREATOR,
    priceMonthly: 19.99,
    priceAnnual: 16.41, // $197/yr
    description: 'The Sweet Spot',
    icon: Star,
    color: 'bg-blue-50 text-blue-600',
    buttonColor: 'bg-blue-500 text-white hover:bg-blue-600',
    saveLabel: 'Save 18%',
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
    priceMonthly: 59.99,
    priceAnnual: 49.92, // $599/yr
    description: 'The Professional Choice',
    icon: Briefcase,
    color: 'bg-coral-burst/10 text-coral-burst',
    buttonColor:
      'bg-linear-to-r from-coral-burst to-gold-sunshine text-white border border-white/20 hover:scale-105',
    saveLabel: 'Save 17%',
    features: [
      'Everything in Creator',
      '5 team seats',
      '500 pages/book',
      'ALL 50+ styles',
      'White-label exports',
      'Brand Hub & Style Guides',
      'Video book exports',
    ],
    isPopular: true,
  },
  {
    name: UserTier.EMPIRE,
    priceMonthly: 199.99,
    priceAnnual: 166.58, // $1999/yr
    description: 'Best Value for Scale',
    icon: Crown,
    color: 'bg-purple-50 text-purple-600',
    buttonColor: 'bg-charcoal-soft text-white hover:bg-black',
    saveLabel: 'Save 17%',
    features: [
      'Everything in Studio',
      'Unlimited team members',
      'Unlimited pages',
      'Custom AI Model Training',
      'Dedicated Account Manager',
      'API Access',
      'VIP 24/7 Support',
    ],
    isPopular: false,
  },
];

const PricingPage: React.FC<PricingPageProps> = ({ onUpgrade }) => {
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(supportsAnnualDodoBilling);
  const [processingTier, setProcessingTier] = useState<string | null>(null);

  usePageSEO({
    title: 'Pricing — Genesis AI Visual Storytelling',
    description: 'Genesis plans from free to enterprise. Create AI-powered visual stories, educational content, and illustrated books.',
    canonical: '/pricing',
  });

  // Inject pricing JSON-LD
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'pricing-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Genesis',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web Browser',
      offers: [
        { '@type': 'Offer', name: 'Spark', price: '0', priceCurrency: 'USD', description: 'Free tier with basic features' },
        { '@type': 'Offer', name: 'Creator', price: '19.99', priceCurrency: 'USD', description: 'Monthly plan for individual creators', url: 'https://iamazeyou.me/tier/creator' },
        { '@type': 'Offer', name: 'Studio', price: '59.99', priceCurrency: 'USD', description: 'Monthly plan for professional studios', url: 'https://iamazeyou.me/tier/studio' },
        { '@type': 'Offer', name: 'Empire', price: '199.99', priceCurrency: 'USD', description: 'Monthly plan for enterprise teams', url: 'https://iamazeyou.me/tier/empire' },
      ],
    });
    document.head.appendChild(script);
    return () => { document.getElementById('pricing-jsonld')?.remove(); };
  }, []);

  const handleSubscribe = (tier: TierData) => {
    if (tier.priceMonthly === 0) {
      alert('You are now on the Free Spark plan!');
      if (onUpgrade) onUpgrade(UserTier.SPARK);
      return;
    }

    handleDodoCheckout(tier);
  };

  // -- Dodo Payments checkout --
  const handleDodoCheckout = async (tier: TierData) => {
    const dodoPlan = tierToDodoPlan(tier.name, isAnnual ? 'yearly' : 'monthly');
    if (!dodoPlan) {
      alert('This plan is not available for subscription.');
      return;
    }

    if (!user) {
      alert('Please sign in to upgrade your plan.');
      return;
    }

    try {
      setProcessingTier(tier.name);
      const checkoutUrl = await createDodoCheckout({
        plan: dodoPlan,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Dodo checkout error:', err);
      alert(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.');
    } finally {
      setProcessingTier(null);
    }
  };

  return (
    <section aria-label="Pricing plans" className="w-full min-h-screen bg-cream-base pb-24 animate-fadeIn">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-heading font-bold text-4xl md:text-5xl text-charcoal-soft mb-6">
            Choose Your{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-coral-burst to-gold-sunshine">
              Creative Journey
            </span>
          </h1>
          <p className="font-body text-xl text-cocoa-light max-w-2xl mx-auto mb-10">
            Join 100,000+ creators making beautiful books today. Upgrade to unlock your full
            potential.
          </p>

          {/* Toggle */}
          {supportsAnnualDodoBilling ? (
            <div className="flex items-center justify-center gap-4">
              <span
                className={`font-heading font-bold ${isAnnual ? 'text-cocoa-light' : 'text-charcoal-soft'}`}
              >
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                aria-label={
                  isAnnual
                    ? 'Currently annual billing, click to switch to monthly'
                    : 'Currently monthly billing, click to switch to annual'
                }
              />
              <span
                className={`font-heading font-bold flex items-center gap-2 ${isAnnual ? 'text-charcoal-soft' : 'text-cocoa-light'}`}
              >
                Annual
                <span className="bg-gold-sunshine/20 text-yellow-600 text-xs px-2 py-0.5 rounded-full">
                  Save up to 18%
                </span>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-peach-soft/60 bg-surface px-4 py-2 text-sm font-medium text-cocoa-light">
              Monthly billing only
            </div>
          )}
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative bg-surface rounded-3xl p-8 border transition-all duration-300 flex flex-col h-full
                ${
                  tier.isPopular
                    ? 'border-gold-sunshine transform scale-105 z-10'
                    : 'border-peach-soft/50 hover:-translate-y-2'
                }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-linear-to-r from-coral-burst to-gold-sunshine text-white px-4 py-1 rounded-full font-heading font-bold text-sm whitespace-nowrap">
                  Most Popular ⭐
                </div>
              )}

              <div
                className={`w-12 h-12 rounded-2xl ${tier.color} flex items-center justify-center mb-6`}
              >
                <tier.icon className="w-6 h-6" />
              </div>

              <h2 className="font-heading font-bold text-2xl text-charcoal-soft mb-2">
                {tier.name.charAt(0) + tier.name.slice(1).toLowerCase()}
              </h2>
              <p className="text-xs font-bold text-cocoa-light uppercase tracking-wider mb-6">
                {tier.description}
              </p>

              <div className="mb-6">
                <span className="font-heading font-bold text-4xl text-charcoal-soft">
                  ${isAnnual ? tier.priceAnnual : tier.priceMonthly}
                </span>
                <span className="text-cocoa-light font-medium">/mo</span>
                {isAnnual && tier.priceAnnual > 0 && (
                  <div className="text-xs text-green-500 font-bold mt-1">
                    Billed ${Math.ceil(tier.priceAnnual * 12)}/yr
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleSubscribe(tier)}
                disabled={processingTier !== null}
                className={`w-full py-3 mb-4 ${tier.buttonColor}`}
              >
                {processingTier === tier.name ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : tier.priceMonthly === 0 ? (
                  'Start Creating Free'
                ) : (
                  'Upgrade now'
                )}
              </Button>

              {/* Why This Tier Button */}
              {tier.priceMonthly > 0 && (
                <Button
                  onClick={() => {
                    const el = document.getElementById('pricing-faq');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full py-2 font-medium text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/30 mb-6 border border-transparent hover:border-peach-soft"
                >
                  Why {tier.name.charAt(0) + tier.name.slice(1).toLowerCase()}?
                </Button>
              )}
              {tier.priceMonthly === 0 && <div className="mb-4" />}

              <div className="flex-1 space-y-4 mb-4">
                {tier.features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm text-charcoal-soft font-medium"
                  >
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
        <div className="absolute inset-0 z-10 pointer-events-none bg-linear-to-b from-cream-base via-cream-base/80 to-transparent" />

        {/* Illustration container */}
        <div className="relative w-full flex justify-center items-end">
          <img
            src="/assets/mascots/8k_3d_pixar_202512022053.jpeg"
            alt="Genesis Community"
            className="w-full max-w-7xl h-auto object-contain object-bottom max-h-100 min-h-50"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
};

export default PricingPage;
