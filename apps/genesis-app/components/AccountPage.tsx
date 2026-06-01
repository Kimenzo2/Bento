import { motion } from 'framer-motion';
import { Calendar, Crown, MonitorSmartphone, Shield, User } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  type TierName,
  TIER_DISPLAY,
  getEntitlements,
  isUnlimited,
  userTierToTierName,
} from '../config/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/profileService';
import { getCurrentMonthUsage } from '../services/usageService';
import { UserTier } from '../types';
import UsageCounter from './billing/UsageCounter';

interface AccountPageProps {
  onNavigate?: (mode: any) => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700' },
  inactive: { label: 'Read only', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600' },
};

const AccountPage: React.FC<AccountPageProps> = () => {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierName>('SPARK');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    async function load() {
      try {
        const profile = await getUserProfile();
        if (profile) {
          setTier(userTierToTierName(profile.user_tier || UserTier.SPARK));
          setSubscriptionStatus(profile.subscription_status || 'inactive');
          setSubscriptionEndDate((profile as any).subscription_end_date || null);
          setCancelAtPeriodEnd((profile as any).cancel_at_period_end || false);
        }
        const usage = await getCurrentMonthUsage(userId);
        setMonthlyUsage(usage);
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-peach-soft/30 rounded-xl w-48" />
          <div className="h-40 bg-peach-soft/20 rounded-2xl" />
          <div className="h-32 bg-peach-soft/20 rounded-2xl" />
        </div>
      </div>
    );
  }

  const ent = getEntitlements(tier);
  const isSpark = tier === 'SPARK';
  const badge = STATUS_BADGE[subscriptionStatus] || STATUS_BADGE.inactive;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal-soft flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-charcoal-soft">Account</h1>
            <p className="text-sm text-cocoa-light">{user?.email}</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-peach-soft/30 overflow-hidden bg-white">
          <div className="p-6 border-b border-peach-soft/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Crown
                  className={`w-5 h-5 ${isSpark ? 'text-cocoa-light' : 'text-gold-sunshine'}`}
                />
                <h2 className="font-heading font-bold text-lg text-charcoal-soft">
                  {TIER_DISPLAY[tier].label} Plan
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <span className="text-lg font-bold text-charcoal-soft">
                {TIER_DISPLAY[tier].price}
              </span>
            </div>

            {cancelAtPeriodEnd && subscriptionEndDate && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-800">
                <Calendar className="w-4 h-4 shrink-0" />
                Access continues until {new Date(subscriptionEndDate).toLocaleDateString()}
              </div>
            )}

            {!isSpark && subscriptionEndDate && !cancelAtPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-cocoa-light">
                <Calendar className="w-4 h-4" />
                Next billing: {new Date(subscriptionEndDate).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="p-6 border-b border-peach-soft/20">
            <h3 className="text-sm font-medium text-charcoal-soft mb-3">Monthly Usage</h3>
            <UsageCounter tier={tier} monthlyUsage={monthlyUsage} />
          </div>

          <div className="p-6">
            <h3 className="text-sm font-medium text-charcoal-soft mb-3">Your Features</h3>
            <div className="grid grid-cols-2 gap-2">
              <FeatureRow
                label="Pages/book"
                value={isUnlimited(ent.pages_per_book) ? 'Unlimited' : String(ent.pages_per_book)}
              />
              <FeatureRow label="Styles" value={`${ent.illustration_styles}+`} />
              <FeatureRow label="Watermark" value={ent.watermark ? 'Yes' : 'None'} />
              <FeatureRow label="Commercial" value={ent.commercial_license ? 'Yes' : 'No'} />
              <FeatureRow
                label="Team seats"
                value={isUnlimited(ent.team_seats) ? 'Unlimited' : String(ent.team_seats)}
              />
              <FeatureRow label="Priority" value={ent.priority_rendering ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-peach-soft/30 bg-surface p-6">
          <div className="flex items-start gap-3">
            <MonitorSmartphone className="mt-1 w-5 h-5 text-coral-burst shrink-0" />
            <div>
              <h2 className="font-heading font-bold text-charcoal-soft">Billing is desktop-only</h2>
              <p className="mt-2 text-sm text-cocoa-light">
                Subscription changes, upgrades, and device-limit changes are now handled in the
                Genesis desktop app. The web app only shows your current access state.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-cocoa-light/60 justify-center pb-4">
          <Shield className="w-3 h-3" />
          Billing managed through the desktop app
        </div>
      </motion.div>
    </div>
  );
};

function FeatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-cocoa-light">{label}</span>
      <span className="font-medium text-charcoal-soft">{value}</span>
    </div>
  );
}

export default AccountPage;
