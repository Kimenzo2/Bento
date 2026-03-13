import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Rocket, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type TierName,
  TIER_DISPLAY,
  getEntitlements,
  isUnlimited,
} from '../../config/entitlements';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';

interface UpgradePromptProps {
  variant: 'modal' | 'inline' | 'toast';
  limitType: 'books' | 'pages' | 'styles' | 'feature';
  currentTier: TierName;
  requiredTier?: TierName;
  onDismiss: () => void;
  currentCount?: number;
  limit?: number;
  featureName?: string;
}

const LIMIT_MESSAGES: Record<string, (props: UpgradePromptProps) => string> = {
  books: (p) => {
    const ent = getEntitlements(p.currentTier);
    return `You've reached your limit of ${ent.books_per_month} books this month.`;
  },
  pages: (p) => {
    const ent = getEntitlements(p.currentTier);
    return `Your ${TIER_DISPLAY[p.currentTier].label} plan supports up to ${ent.pages_per_book} pages per book.`;
  },
  styles: () => 'This illustration style requires a higher plan.',
  feature: (p) => `${p.featureName || 'This feature'} is available on the ${TIER_DISPLAY[p.requiredTier || 'CREATOR'].label} plan.`,
};

const UpgradePrompt: React.FC<UpgradePromptProps> = (props) => {
  const { variant } = props;

  switch (variant) {
    case 'modal':
      return <UpgradeModal {...props} />;
    case 'inline':
      return <UpgradeInline {...props} />;
    case 'toast':
      return <UpgradeToast {...props} />;
  }
};

// ── Modal variant ────────────────────────────────────────────

const UpgradeModal: React.FC<UpgradePromptProps> = (props) => {
  const { currentTier, requiredTier, limitType, onDismiss } = props;
  const navigate = useNavigate();
  const targetTier = requiredTier || nextTier(currentTier);
  const message = LIMIT_MESSAGES[limitType](props);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-charcoal-soft pt-10 pb-14 px-8 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-14 h-14 bg-charcoal-soft rounded-2xl flex items-center justify-center border-4 border-white z-10">
            <Sparkles className="w-8 h-8 text-gold-sunshine" />
          </div>
          <h2 className="font-heading font-bold text-xl text-white mb-2 relative z-10">
            Ready for More?
          </h2>
          <p className="text-cocoa-light/80 text-sm font-medium relative z-10">
            {message}
          </p>
        </div>

        <div className="pt-10 pb-6 px-8">
          <div className="bg-mint-breeze/30 rounded-xl p-4 mb-5 flex items-center gap-3 border border-mint-breeze">
            <Rocket className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-heading font-bold text-charcoal-soft text-sm">
                Upgrade to {TIER_DISPLAY[targetTier].label}
              </p>
              <p className="text-xs text-cocoa-light">
                {TIER_DISPLAY[targetTier].price}
              </p>
            </div>
          </div>

          <TierBenefits tier={targetTier} />

          <Button
            onClick={() => { onDismiss(); navigate('/pricing'); }}
            size="lg"
            className="w-full rounded-xl text-base mt-4 group"
          >
            Upgrade to {TIER_DISPLAY[targetTier].label}
            <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full mt-3 text-sm text-cocoa-light hover:text-charcoal-soft transition-colors py-2"
          >
            Continue with {TIER_DISPLAY[currentTier].label}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Inline variant ───────────────────────────────────────────

const UpgradeInline: React.FC<UpgradePromptProps> = (props) => {
  const { currentTier, requiredTier, limitType, onDismiss } = props;
  const navigate = useNavigate();
  const targetTier = requiredTier || nextTier(currentTier);
  const message = LIMIT_MESSAGES[limitType](props);

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gold-sunshine/10 border border-gold-sunshine/30 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="w-4 h-4 text-gold-sunshine shrink-0" />
        <p className="text-sm text-charcoal-soft truncate">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => { onDismiss(); navigate('/pricing'); }}
          className="text-sm font-medium text-coral-burst hover:underline whitespace-nowrap"
        >
          Upgrade to {TIER_DISPLAY[targetTier].label}
        </button>
        <button type="button" onClick={onDismiss} className="text-cocoa-light hover:text-charcoal-soft">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── Toast variant ────────────────────────────────────────────

const UpgradeToast: React.FC<UpgradePromptProps> = (props) => {
  const { limitType, onDismiss } = props;
  const [visible, setVisible] = useState(true);
  const message = LIMIT_MESSAGES[limitType](props);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="fixed bottom-6 right-6 z-50 bg-white shadow-lg rounded-xl border border-peach-soft p-4 max-w-sm"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-gold-sunshine shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-charcoal-soft font-medium">{message}</p>
              <p className="text-xs text-cocoa-light mt-1">
                Consider upgrading for more capacity.
              </p>
            </div>
            <button type="button" onClick={onDismiss} className="text-cocoa-light hover:text-charcoal-soft shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Helpers ──────────────────────────────────────────────────

function nextTier(current: TierName): TierName {
  const order: TierName[] = ['SPARK', 'CREATOR', 'STUDIO', 'EMPIRE'];
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)];
}

function TierBenefits({ tier }: { tier: TierName }) {
  const ent = getEntitlements(tier);
  const benefits: string[] = [];

  if (isUnlimited(ent.books_per_month)) {
    benefits.push('Unlimited books per month');
  } else {
    benefits.push(`Up to ${ent.books_per_month} books per month`);
  }

  if (isUnlimited(ent.pages_per_book)) {
    benefits.push('Unlimited pages per book');
  } else {
    benefits.push(`Up to ${ent.pages_per_book} pages per book`);
  }

  if (!ent.watermark) benefits.push('No watermarks on exports');
  if (ent.commercial_license) benefits.push('Commercial license included');
  if (ent.priority_rendering) benefits.push('Priority rendering');

  return (
    <div className="space-y-2">
      {benefits.map((b) => (
        <div key={b} className="flex items-center gap-2 text-sm text-charcoal-soft">
          <div className="w-4 h-4 rounded-full bg-coral-burst/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-coral-burst" />
          </div>
          {b}
        </div>
      ))}
    </div>
  );
}

export default UpgradePrompt;
