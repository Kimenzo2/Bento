import { motion } from 'framer-motion';
import {
  Calendar,
  CreditCard,
  Crown,
  ExternalLink,
  Shield,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  type TierName,
  TIER_DISPLAY,
  TIER_ENTITLEMENTS,
  getEntitlements,
  isUnlimited,
  userTierToTierName,
} from '../config/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/profileService';
import { getCurrentMonthUsage } from '../services/usageService';
import { AppMode, UserTier } from '../types';
import UsageCounter from './billing/UsageCounter';
import { Button } from './ui/button';

interface AccountPageProps {
  onNavigate: (mode: AppMode) => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700' },
  inactive: { label: 'Free', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600' },
};

const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, userProfile } = useAuth();
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
        // fallback to defaults
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal-soft flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-charcoal-soft">Account</h1>
            <p className="text-sm text-cocoa-light">{user?.email}</p>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-white rounded-2xl border-2 border-peach-soft/30 overflow-hidden">
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

          {/* Usage */}
          <div className="p-6 border-b border-peach-soft/20">
            <h3 className="text-sm font-medium text-charcoal-soft mb-3">Monthly Usage</h3>
            <UsageCounter tier={tier} monthlyUsage={monthlyUsage} />
          </div>

          {/* Features */}
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

        {/* Manage Billing (paid users) */}
        {!isSpark && (
          <div className="bg-white rounded-2xl border-2 border-peach-soft/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-cocoa-light" />
              <h2 className="font-heading font-bold text-charcoal-soft">Billing</h2>
            </div>
            <p className="text-sm text-cocoa-light mb-4">
              Manage your subscription, update payment method, or download invoices through the Dodo
              Payments portal.
            </p>
            <Button
              variant="outline"
              onClick={() => window.open('https://checkout.dodopayments.com/billing', '_blank')}
              className="gap-2"
            >
              Manage Billing
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Upgrade Cards (Spark users) */}
        {isSpark && (
          <div className="space-y-3">
            <h2 className="font-heading font-bold text-lg text-charcoal-soft flex items-center gap-2">
              <Zap className="w-5 h-5 text-gold-sunshine" />
              Upgrade Your Plan
            </h2>
            {(['CREATOR', 'STUDIO', 'EMPIRE'] as TierName[]).map((t) => {
              const tEnt = getEntitlements(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onNavigate(AppMode.PRICING)}
                  className="w-full text-left bg-white rounded-2xl border-2 border-peach-soft/30 p-5 hover:border-coral-burst/40 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-charcoal-soft group-hover:text-coral-burst transition-colors">
                        {TIER_DISPLAY[t].label}
                      </h3>
                      <p className="text-sm text-cocoa-light mt-1">
                        {isUnlimited(tEnt.books_per_month) ? 'Unlimited' : tEnt.books_per_month}{' '}
                        books/mo
                        {' · '}
                        {isUnlimited(tEnt.pages_per_book) ? 'Unlimited' : tEnt.pages_per_book} pages
                        {!tEnt.watermark ? ' · No watermark' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-charcoal-soft">{TIER_DISPLAY[t].price}</span>
                      <Sparkles className="w-4 h-4 text-gold-sunshine ml-2 inline-block" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Security */}
        <div className="flex items-center gap-2 text-xs text-cocoa-light/60 justify-center pb-4">
          <Shield className="w-3 h-3" />
          Payments handled securely by Dodo Payments
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
