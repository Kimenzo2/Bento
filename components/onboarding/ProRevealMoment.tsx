import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Clock,
  Crown,
  Gift,
  Star,
  Users,
  X,
  Zap
} from 'lucide-react';
import { useOnboarding } from './OnboardingState';

// Psychological trigger: Live social proof counter
const LiveUpgradeCounter = () => {
  const [count, setCount] = useState(47);

  useEffect(() => {
    const fetchInitialCount = async () => {
      try {
        const { supabase } = await import('../../services/supabaseClient');
        const { data, error } = await supabase.rpc('get_today_upgrade_count');
        if (!error && data !== null) {
          // Add a base number to make it look more impressive if it's a new day
          setCount(Math.max(47, data));
        }
      } catch (err) {
        console.error('Failed to fetch upgrade count:', err);
      }
    };

    fetchInitialCount();

    // Subscribe to realtime updates
    let subscription: any;
    const setupSubscription = async () => {
      const { supabase } = await import('../../services/supabaseClient');
      subscription = supabase
        .channel('subscription_events_count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'subscription_events'
          },
          (payload: any) => {
            if (['charge_success', 'subscription_create'].includes(payload.new.event_type)) {
              setCount(prev => prev + 1);
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 backdrop-blur-sm rounded-full border border-emerald-400/30"
    >
      <div className="relative">
        <Users className="w-4 h-4 text-emerald-400" />
        <motion.div
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full"
        />
      </div>
      <span className="text-emerald-300 text-sm font-medium">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block"
        >
          {count}
        </motion.span>
        {" "}creators upgraded today
      </span>
    </motion.div>
  );
};

// Countdown timer for urgency
const UrgencyTimer = ({ durationMinutes = 10 }: { durationMinutes?: number }) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60 - 1);

  useEffect(() => {
    setTimeLeft(durationMinutes * 60 - 1);
  }, [durationMinutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <motion.div
      animate={{ scale: timeLeft < 60 ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.5, repeat: timeLeft < 60 ? Infinity : 0 }}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border ${timeLeft < 60
          ? 'bg-red-500/20 border-red-400/50 text-red-300'
          : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
        }`}
    >
      <Clock className="w-4 h-4" />
      <span className="font-mono font-bold">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      <span className="text-sm opacity-70">left</span>
    </motion.div>
  );
};

// Feature comparison with psychological framing
const FeatureComparison = () => {
  const features = [
    { name: 'AI Story Generation', free: '5/month', pro: 'Unlimited', highlight: true },
    { name: 'Illustration Styles', free: '3 basic', pro: '50+ premium', highlight: true },
    { name: 'Export Quality', free: 'Standard', pro: '4K Ultra HD', highlight: false },
    { name: 'Character Consistency', free: false, pro: true, highlight: true },
    { name: 'Commercial License', free: false, pro: true, highlight: false },
    { name: 'Priority Generation', free: false, pro: true, highlight: false },
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div className="text-white/50">Feature</div>
        <div className="text-center text-white/50">Free</div>
        <div className="text-center text-amber-400 font-medium">Pro</div>
      </div>

      <div className="space-y-2">
        {features.map((feature, idx) => (
          <motion.div
            key={feature.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`grid grid-cols-3 gap-2 p-3 rounded-xl ${feature.highlight
                ? 'bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-white/10'
                : 'bg-white/5'
              }`}
          >
            <div className="text-white/80 text-sm">{feature.name}</div>
            <div className="text-center">
              {typeof feature.free === 'boolean' ? (
                feature.free ? (
                  <Check className="w-4 h-4 text-white/50 mx-auto" />
                ) : (
                  <X className="w-4 h-4 text-white/30 mx-auto" />
                )
              ) : (
                <span className="text-white/50 text-sm">{feature.free}</span>
              )}
            </div>
            <div className="text-center">
              {typeof feature.pro === 'boolean' ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                >
                  <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                </motion.div>
              ) : (
                <span className="text-amber-300 text-sm font-medium">{feature.pro}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export const ProRevealMoment: React.FC = () => {
  const { setStep, sparkPoints } = useOnboarding();
  const [showComparison, setShowComparison] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [deal, setDeal] = useState({
    original_price: 19.99,
    deal_price: 11.99,
    duration_minutes: 10
  });

  useEffect(() => {
    const fetchDeal = async () => {
      try {
        const { supabase } = await import('../../services/supabaseClient');
        const { data, error } = await supabase
          .from('exclusive_deals')
          .select('*')
          .eq('name', 'Onboarding Exclusive')
          .eq('is_active', true)
          .maybeSingle();
        
        if (!error && data) {
          setDeal({
            original_price: Number(data.original_price),
            deal_price: Number(data.deal_price),
            duration_minutes: Number(data.duration_minutes)
          });
        }
      } catch (err) {
        console.error('Failed to fetch deal:', err);
      }
    };

    fetchDeal();

    // Subscribe to deal updates
    let subscription: any;
    const setupSubscription = async () => {
      const { supabase } = await import('../../services/supabaseClient');
      subscription = supabase
        .channel('exclusive_deals_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'exclusive_deals',
            filter: "name=eq.Onboarding Exclusive"
          },
          (payload: any) => {
            if (payload.new && payload.new.is_active) {
              setDeal({
                original_price: Number(payload.new.original_price),
                deal_price: Number(payload.new.deal_price),
                duration_minutes: Number(payload.new.duration_minutes)
              });
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Delayed reveal for anticipation building
    const timer = setTimeout(() => setShowComparison(true), 1500);
    return () => {
      clearTimeout(timer);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleContinueFree = () => {
    setStep('tour');
  };

  const handleUpgrade = () => {
    // Navigate to onboarding pricing screen
    setStep('pricing');
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center px-[var(--ob-container-padding)] py-6 overflow-x-hidden overflow-y-auto">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/50 via-[#0a0a0f] to-amber-950/30" />

      {/* Animated glow orbs */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-20 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-20 right-10 w-72 h-72 bg-amber-500 rounded-full blur-[120px]"
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center py-8">

        {/* Header with social proof */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 mb-8"
        >
          <LiveUpgradeCounter />

          {/* Crown icon with glow */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
            className="relative"
          >
            <Crown className="w-16 h-16 text-amber-400" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-conic from-purple-500 via-amber-400 to-purple-500 rounded-full blur-2xl opacity-30"
            />
          </motion.div>
        </motion.div>

        {/* Main Message - Loss Aversion framing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 font-heading">
            You just created
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              something magical.
            </span>
          </h1>

          <p className="text-white/60 text-lg max-w-md mx-auto">
            Imagine what you could create with{' '}
            <span className="text-amber-400 font-semibold">unlimited power.</span>
          </p>
        </motion.div>

        {/* Sparks earned reminder - Reciprocity */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-full border border-amber-400/30">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            <span className="text-white font-bold text-lg">{sparkPoints} Sparks</span>
            <span className="text-amber-300/70">earned so far</span>
          </div>
        </motion.div>

        {/* Feature comparison - revealed with delay */}
        <AnimatePresence>
          {showComparison && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <FeatureComparison />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exclusive Offer Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="relative bg-gradient-to-br from-purple-900/40 to-amber-900/30 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-8 overflow-hidden"
        >
          {/* Animated border glow */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1 bg-gradient-conic from-purple-500 via-amber-400 via-pink-500 to-purple-500 rounded-3xl opacity-20 blur-sm"
          />

          <div className="relative">
            {/* Offer badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span className="text-amber-300 font-semibold">Onboarding Exclusive</span>
              </div>
              <UrgencyTimer durationMinutes={deal.duration_minutes} />
            </div>

            {/* Price comparison - Anchoring */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-white/40 line-through text-2xl">${deal.original_price}</span>
                <span className="text-4xl md:text-5xl font-bold text-white">${deal.deal_price}</span>
                <span className="text-white/60">/month</span>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.5, type: "spring" }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/30"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Save 40%</span>
                <span className="text-emerald-300/60 text-sm">forever</span>
              </motion.div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              {/* Primary CTA - Upgrade */}
              <motion.button
                onClick={handleUpgrade}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full py-4 rounded-2xl font-bold text-lg overflow-hidden"
              >
                {/* Animated gradient background */}
                <motion.div
                  animate={{
                    backgroundPosition: isHovering ? ['0% 50%', '100% 50%', '0% 50%'] : '0% 50%'
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 via-amber-500 to-purple-600 bg-[length:200%_100%]"
                />

                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />

                <span className="relative flex items-center justify-center gap-2 text-white">
                  <Crown className="w-5 h-5" />
                  Unlock Pro Now
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>

              {/* Secondary CTA - Continue free (smaller, less prominent) */}
              <motion.button
                onClick={handleContinueFree}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 rounded-xl text-white/50 hover:text-white/70 text-sm transition-colors"
              >
                Maybe later, continue with Free
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="flex flex-wrap justify-center gap-4 text-white/40 text-xs"
        >
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            Cancel anytime
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            7-day money back
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            Instant access
          </span>
        </motion.div>
      </div>
    </div>
  );
};
