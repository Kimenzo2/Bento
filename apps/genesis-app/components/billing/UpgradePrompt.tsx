import { AnimatePresence, motion } from 'framer-motion';
import { MonitorSmartphone, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';

interface UpgradePromptProps {
  variant: 'modal' | 'inline' | 'toast';
  limitType: 'books' | 'pages' | 'styles' | 'feature';
  currentTier: string;
  requiredTier?: string;
  onDismiss: () => void;
  currentCount?: number;
  limit?: number;
  featureName?: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = (props) => {
  switch (props.variant) {
    case 'modal':
      return <NoticeModal {...props} />;
    case 'inline':
      return <NoticeInline {...props} />;
    case 'toast':
      return <NoticeToast {...props} />;
  }
};

const LIMIT_MESSAGES: Record<string, (props: UpgradePromptProps) => string> = {
  books: () => 'That limit is tied to billing.',
  pages: () => 'That limit is tied to billing.',
  styles: () => 'That feature is tied to billing.',
  feature: (p) => `${p.featureName || 'This feature'} is tied to billing.`,
};

const NoticeModal: React.FC<UpgradePromptProps> = (props) => {
  const { onDismiss, limitType } = props;
  const message = LIMIT_MESSAGES[limitType](props);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
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
            Billing moved to desktop
          </h2>
          <p className="text-cocoa-light/80 text-sm font-medium relative z-10">{message}</p>
        </div>

        <div className="pt-10 pb-6 px-8">
          <div className="bg-mint-breeze/30 rounded-xl p-4 mb-5 flex items-center gap-3 border border-mint-breeze">
            <MonitorSmartphone className="w-5 h-5 text-coral-burst shrink-0" />
            <div>
              <p className="font-heading font-bold text-charcoal-soft text-sm">
                Use Genesis desktop to manage plans
              </p>
              <p className="text-xs text-cocoa-light">
                Billing actions are intentionally disabled on the web app.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl border border-peach-soft bg-surface px-4 py-3 text-sm font-medium text-charcoal-soft"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const NoticeInline: React.FC<UpgradePromptProps> = (props) => {
  const { onDismiss, limitType } = props;
  const message = LIMIT_MESSAGES[limitType](props);

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gold-sunshine/10 border border-gold-sunshine/30 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-gold-sunshine shrink-0" />
        <p className="text-sm text-charcoal-soft truncate">Billing moved to desktop: {message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-cocoa-light hover:text-charcoal-soft"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const NoticeToast: React.FC<UpgradePromptProps> = (props) => {
  const { onDismiss, limitType } = props;
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
            <div className="min-w-0">
              <p className="text-sm text-charcoal-soft font-medium">
                Billing moved to desktop. {message}
              </p>
              <p className="text-xs text-cocoa-light mt-1">
                Billing actions are disabled in the web app.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-cocoa-light hover:text-charcoal-soft shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpgradePrompt;
