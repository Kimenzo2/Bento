import { MonitorSmartphone, Sparkles } from 'lucide-react';
import type React from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  void onUpgrade;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-charcoal-soft pt-12 pb-14 px-8 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-charcoal-soft rounded-2xl flex items-center justify-center border-4 border-white z-10 overflow-hidden">
            <Sparkles className="w-8 h-8 text-gold-sunshine" />
          </div>

          <h2 className="font-heading font-bold text-2xl text-white mb-2 relative z-10">
            Billing moved to desktop
          </h2>
          <p className="text-cocoa-light/80 text-sm font-medium relative z-10">
            Subscription changes now happen in the Genesis desktop app.
          </p>
        </div>

        <div className="pt-10 pb-6 px-8">
          <div className="bg-mint-breeze/30 rounded-xl p-4 mb-6 flex items-center gap-4 border border-mint-breeze">
            <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-peach-soft/50 shrink-0">
              <MonitorSmartphone className="w-5 h-5 text-coral-burst" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-charcoal-soft text-sm">
                Desktop owns the purchase flow
              </h3>
              <p className="text-xs text-cocoa-light">
                The web app no longer opens checkout or billing actions.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-charcoal-soft">
            {[
              'Core, Pro, and Power are managed in desktop',
              'Device limits and AI plans live in the app',
              'The web app now stays read only for billing',
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-coral-burst shrink-0" />
                <span>{line}</span>
              </div>
            ))}
          </div>

          <Button onClick={onClose} size="xl" className="w-full rounded-xl text-lg mt-6">
            Close
          </Button>

          <p className="text-center text-xs text-cocoa-light mt-4">
            Open Genesis desktop to manage subscriptions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
