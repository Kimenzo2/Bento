import { initializePayment } from './paystackService';
import { supabase } from './supabaseClient';
import { UserTier } from '../types';

interface SubscriptionPlan {
    name: string;
    tier: UserTier;
    planCode: string;
    amount: number; // Monthly price in dollars
    annualPrice: number; // Annual billing amount
    currency: string;
    features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
    creator: {
        name: 'Creator',
        tier: UserTier.CREATOR,
        planCode: 'PLN_zbnzvdqjsdxfcqc',
        amount: 16.41, // $16.41/mo
        annualPrice: 197, // Billed $197/yr
        currency: 'USD',
        features: [
            '30 ebooks per month',
            'Up to 12 pages/book',
            'NO watermarks',
            '20+ illustration styles',
            'Commercial license',
            'Priority rendering'
        ]
    },
    studio: {
        name: 'Studio',
        tier: UserTier.STUDIO,
        planCode: 'PLN_09zg1ly5kg57niz',
        amount: 49.92, // $49.92/mo
        annualPrice: 600, // Billed $600/yr
        currency: 'USD',
        features: [
            'Everything in Creator',
            '5 team seats',
            '500 pages/book',
            'ALL 50+ styles',
            'White-label exports',
            'Brand Hub & Style Guides'
        ]
    },
    empire: {
        name: 'Empire',
        tier: UserTier.EMPIRE,
        planCode: 'PLN_tv2y349z88b1bd8',
        amount: 166.58, // $166.58/mo
        annualPrice: 1999, // Billed $1999/yr
        currency: 'USD',
        features: [
            'Everything in Studio',
            'Unlimited team members',
            'Unlimited pages',
            'Custom AI Model Training',
            'Dedicated Account Manager',
            'API Access'
        ]
    }
};

export const initiateSubscription = async (
    planKey: 'creator' | 'studio' | 'empire',
    userEmail: string,
    userId: string,
    userName?: string
): Promise<void> => {
    const plan = SUBSCRIPTION_PLANS[planKey];

    if (!plan) {
        throw new Error('Invalid plan selected');
    }

    console.log(`Initiating ${plan.name} subscription for user ${userId}`);

    // Initialize Paystack payment with subscription plan
    await initializePayment({
        email: userEmail,
        amount: plan.amount,
        currency: plan.currency,
        firstName: userName?.split(' ')[0],
        lastName: userName?.split(' ').slice(1).join(' '),
        metadata: {
            user_id: userId,
            plan_code: plan.planCode,
            plan_name: plan.name,
            plan_tier: plan.tier,
            subscription: true,
            custom_fields: [
                {
                    display_name: 'Plan',
                    variable_name: 'plan',
                    value: plan.name
                },
                {
                    display_name: 'User ID',
                    variable_name: 'user_id',
                    value: userId
                }
            ]
        },
        onSuccess: async (transaction) => {
            console.log('✅ Payment successful:', transaction);

            try {
                // Log the subscription event
                await supabase.from('subscription_events').insert({
                    user_id: userId,
                    event_type: 'payment_success',
                    paystack_reference: transaction.reference,
                    plan_code: plan.planCode,
                    amount: Math.round(plan.amount * 100), // Convert to cents
                    status: 'success',
                    metadata: transaction
                });

                console.log('✅ Subscription event logged');

                // Show success message
                alert(`🎉 Payment successful! Your ${plan.name} subscription is being activated. The page will refresh shortly.`);

                // Wait a moment for webhook to process, then reload
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } catch (error) {
                console.error('Error logging subscription event:', error);
                // Still reload to get updated tier from backend
                setTimeout(() => window.location.reload(), 2000);
            }
        },
        onCancel: () => {
            console.log('❌ Payment cancelled by user');
        },
        onError: (error) => {
            console.error('❌ Payment error:', error);
            alert('Payment failed. Please try again or contact support if the issue persists.');
        }
    });
};

export const cancelSubscription = async (userId: string): Promise<void> => {
    try {
        // Mark subscription for cancellation at period end
        const { error } = await supabase
            .from('profiles')
            .update({
                cancel_at_period_end: true,
                subscription_status: 'canceling'
            })
            .eq('id', userId);

        if (error) throw error;

        // Log the cancellation event
        await supabase.from('subscription_events').insert({
            user_id: userId,
            event_type: 'subscription_cancel_requested',
            status: 'pending',
            metadata: { cancelled_at: new Date().toISOString() }
        });

        alert('Your subscription will be cancelled at the end of the current billing period. You will retain access until then.');
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        throw error;
    }
};

export const reactivateSubscription = async (userId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                cancel_at_period_end: false,
                subscription_status: 'active'
            })
            .eq('id', userId);

        if (error) throw error;

        await supabase.from('subscription_events').insert({
            user_id: userId,
            event_type: 'subscription_reactivated',
            status: 'success',
            metadata: { reactivated_at: new Date().toISOString() }
        });

        alert('Your subscription has been reactivated!');
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        throw error;
    }
};

export const getSubscriptionStatus = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_plan_code, subscription_end_date, cancel_at_period_end, user_tier')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching subscription status:', error);
        return null;
    }

    return data;
};
