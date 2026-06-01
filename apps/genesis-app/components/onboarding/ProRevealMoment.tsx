import { motion } from 'framer-motion';
import { ArrowRight, MonitorSmartphone, Sparkles } from 'lucide-react';
import type React from 'react';
import { useOnboarding } from './OnboardingState';
import { Button } from '../ui/button';

const ProRevealMoment: React.FC = () => {
  const { setStep, addSparkPoints } = useOnboarding();

  const handleContinueFree = () => {
    addSparkPoints(10);
    setStep('tour');
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center px-(--ob-container-padding) py-6 overflow-x-hidden overflow-y-auto">
      <div className="absolute inset-0 bg-linear-to-br from-purple-950/40 via-[#0d0d1a] to-amber-950/30" />

      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
        className="absolute top-20 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY }}
        className="absolute bottom-20 right-10 w-72 h-72 bg-amber-500 rounded-full blur-[120px]"
      />

      <div className="relative z-10 w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70">
            <Sparkles className="w-4 h-4 text-gold-sunshine" />
            Billing moved to desktop
          </div>

          <div className="relative">
            <MonitorSmartphone className="w-16 h-16 text-amber-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 font-heading">
            The web app no longer sells Pro
          </h1>

          <p className="text-white/60 text-lg max-w-md mx-auto">
            Core, Pro, and Power are now managed in the Genesis desktop app so there is one purchase
            surface and no upgrade confusion.
          </p>
        </motion.div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 mb-8 text-white/75">
          <p className="text-sm leading-6">
            Desktop billing is the source of truth. If you need to upgrade later, open the desktop
            app and use the billing page there. For now, continue onboarding and finish the tour.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="default" className="w-full" onClick={handleContinueFree}>
            Maybe later, continue with Free
          </Button>

          <Button variant="primary" size="xl" className="w-full" onClick={handleContinueFree}>
            Continue to the tour
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProRevealMoment;
