import { AlertCircle } from 'lucide-react';
import type React from 'react';
import {
  type TierName,
  TIER_DISPLAY,
  getEntitlements,
  isUnlimited,
} from '../../config/entitlements';

interface UsageCounterProps {
  tier: TierName;
  monthlyUsage: number;
  compact?: boolean;
}

const UsageCounter: React.FC<UsageCounterProps> = ({ tier, monthlyUsage, compact = false }) => {
  const ent = getEntitlements(tier);
  const unlimited = isUnlimited(ent.books_per_month);

  if (unlimited) {
    return (
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <p className="text-cocoa-light font-medium">Unlimited books</p>
        <div className="h-1.5 bg-mint-breeze/40 rounded-full mt-1.5 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full w-0" />
        </div>
      </div>
    );
  }

  const limit = ent.books_per_month;
  const percent = Math.min(100, Math.round((monthlyUsage / limit) * 100));
  const isWarning = percent >= 80;
  const isMaxed = percent >= 100;

  const barColor = isMaxed ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-coral-burst';

  return (
    <div className={compact ? 'text-xs' : 'text-sm'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-cocoa-light font-medium">
          {monthlyUsage} of {limit} books this month
        </p>
        {isMaxed && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <AlertCircle className="w-3 h-3" />
            {compact ? 'Max' : 'Limit reached'}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-peach-soft/30 rounded-full mt-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!compact && (
        <p className="text-xs text-cocoa-light/70 mt-1">{TIER_DISPLAY[tier].label} plan</p>
      )}
    </div>
  );
};

export default UsageCounter;
