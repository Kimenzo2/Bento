import type React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MonitorSmartphone, Sparkles } from 'lucide-react';
import { useOnboarding } from './OnboardingState';
import { Button } from '@components/ui/button';

export const OnboardingPricing: React.FC = () => {
  const { setStep, addSparkPoints } = useOnboarding();

  const handleContinue = () => {
    addSparkPoints(5);
    setStep('tour');
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center px-(--ob-container-padding) py-6 overflow-x-hidden overflow-y-auto">
      <div className="absolute inset-0 bg-linear-to-br from-purple-950/30 via-[#0d0d1a] to-blue-950/30" />

      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.22, 0.15] }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
        className="absolute top-10 left-0 w-72 h-72 bg-purple-600 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.15, 0.22, 0.15] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY }}
        className="absolute bottom-10 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px]"
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 mb-5">
            <Sparkles className="w-4 h-4 text-gold-sunshine" />
            Billing moved to desktop
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 font-heading">
            Your plans are now managed in the Genesis desktop app
          </h1>
          <p className="text-white/55 text-sm md:text-lg max-w-2xl mx-auto">
            The web onboarding flow no longer collects payments. Core, Pro, and Power live in the
            desktop app so there is one purchase surface and no upgrade confusion.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[
            {
              title: 'Core',
              body: 'Five anchor apps. Local only. No sync. No AI.',
            },
            {
              title: 'Pro',
              body: 'All 21 apps. Sync across 3 devices. Basic AI.',
            },
            {
              title: 'Power',
              body: 'All 21 apps. Unlimited devices. Advanced AI and priority support.',
            },
          ].map((plan) => (
            <div
              key={plan.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
            >
              <h3 className="text-lg font-bold text-white mb-2">{plan.title}</h3>
              <p className="text-sm text-white/60">{plan.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <MonitorSmartphone className="mt-1 w-5 h-5 text-coral-burst shrink-0" />
            <div>
              <h2 className="text-white font-semibold">Continue without checkout</h2>
              <p className="text-white/55 text-sm mt-1">
                You can finish onboarding now and manage billing later in the desktop app.
              </p>
            </div>
          </div>

          <Button onClick={handleContinue} size="lg" className="rounded-full gap-2">
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPricing;
