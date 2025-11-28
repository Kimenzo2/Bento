import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase with service role key for admin access
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Add this to Vercel env vars
);

export default async function handler(req: any, res: any) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify Paystack signature for security
    const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET!)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('📨 Paystack webhook event:', event.event);

    try {
        switch (event.event) {
            case 'charge.success':
                await handleChargeSuccess(event.data);
                break;

            case 'subscription.create':
                await handleSubscriptionCreate(event.data);
                break;

            case 'subscription.disable':
            case 'subscription.not_renew':
                await handleSubscriptionDisable(event.data);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data);
                break;

            default:
                console.log('ℹ️ Unhandled event:', event.event);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}

async function handleChargeSuccess(data: any) {
    console.log('💰 Processing charge success');

    const userId = data.metadata?.user_id;
    const planCode = data.metadata?.plan_code;

    if (!userId || !planCode) {
        console.error('Missing user_id or plan_code in metadata');
        return;
    }

    try {
        // Update user tier based on plan
        await supabase.rpc('update_user_tier_from_plan', {
            p_user_id: userId,
            p_plan_code: planCode
        });

        // Update subscription info
        await supabase
            .from('profiles')
            .update({
                subscription_status: 'active',
                subscription_plan_code: planCode,
                paystack_customer_code: data.customer?.customer_code,
                subscription_start_date: new Date().toISOString(),
                cancel_at_period_end: false
            })
            .eq('id', userId);

        // Log event
        await supabase.from('subscription_events').insert({
            user_id: userId,
            event_type: 'charge_success',
            paystack_reference: data.reference,
            plan_code: planCode,
            amount: data.amount,
            status: 'success',
            metadata: data
        });

        console.log(`✅ User ${userId} upgraded to plan ${planCode}`);
    } catch (error) {
        console.error('Error in handleChargeSuccess:', error);
        throw error;
    }
}

async function handleSubscriptionCreate(data: any) {
    console.log('📝 Processing subscription create');

    const customerCode = data.customer?.customer_code;

    if (!customerCode) return;

    try {
        // Find user by customer code
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('paystack_customer_code', customerCode)
            .single();

        if (!profile) {
            console.error('User not found for customer code:', customerCode);
            return;
        }

        // Update subscription details
        await supabase
            .from('profiles')
            .update({
                paystack_subscription_code: data.subscription_code,
                subscription_end_date: data.next_payment_date
            })
            .eq('id', profile.id);

        // Log event
        await supabase.from('subscription_events').insert({
            user_id: profile.id,
            event_type: 'subscription_create',
            plan_code: data.plan?.plan_code,
            status: 'success',
            metadata: data
        });

        console.log(`✅ Subscription created for user ${profile.id}`);
    } catch (error) {
        console.error('Error in handleSubscriptionCreate:', error);
        throw error;
    }
}

async function handleSubscriptionDisable(data: any) {
    console.log('🚫 Processing subscription disable');

    try {
        // Find user by subscription code
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('paystack_subscription_code', data.subscription_code)
            .single();

        if (!profile) {
            console.error('User not found for subscription code:', data.subscription_code);
            return;
        }

        // Downgrade user to Spark tier
        await supabase.rpc('downgrade_to_spark', {
            p_user_id: profile.id
        });

        // Log event
        await supabase.from('subscription_events').insert({
            user_id: profile.id,
            event_type: 'subscription_disable',
            status: 'success',
            metadata: data
        });

        console.log(`✅ User ${profile.id} downgraded to Spark`);
    } catch (error) {
        console.error('Error in handleSubscriptionDisable:', error);
        throw error;
    }
}

async function handlePaymentFailed(data: any) {
    console.log('⚠️ Processing payment failed');

    const customerCode = data.customer?.customer_code;

    if (!customerCode) return;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('paystack_customer_code', customerCode)
            .single();

        if (!profile) return;

        // Update subscription status to payment_failed
        await supabase
            .from('profiles')
            .update({
                subscription_status: 'payment_failed'
            })
            .eq('id', profile.id);

        // Log event
        await supabase.from('subscription_events').insert({
            user_id: profile.id,
            event_type: 'payment_failed',
            status: 'failed',
            metadata: data
        });

        console.log(`⚠️ Payment failed for user ${profile.id}`);
    } catch (error) {
        console.error('Error in handlePaymentFailed:', error);
        throw error;
    }
}
