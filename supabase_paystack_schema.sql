-- =============================================
-- PAYSTACK SUBSCRIPTION SCHEMA
-- =============================================
-- Run this in Supabase SQL Editor to add subscription support

-- =============================================
-- 1. ADD SUBSCRIPTION COLUMNS TO PROFILES
-- =============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_plan_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- =============================================
-- 2. CREATE SUBSCRIPTION EVENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  paystack_reference TEXT,
  plan_code TEXT,
  amount INTEGER,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own subscription events" ON public.subscription_events;
DROP POLICY IF EXISTS "Users can insert own subscription events" ON public.subscription_events;

-- Create policies
CREATE POLICY "Users can view own subscription events"
  ON public.subscription_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription events"
  ON public.subscription_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. CREATE HELPER FUNCTIONS
-- =============================================

-- Function to update user tier based on Paystack plan code
CREATE OR REPLACE FUNCTION update_user_tier_from_plan(p_user_id UUID, p_plan_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET user_tier = CASE
    WHEN p_plan_code = 'PLN_zbnzvdqjsdxfcqc' THEN 'CREATOR'
    WHEN p_plan_code = 'PLN_09zg1ly5kg57niz' THEN 'STUDIO'
    WHEN p_plan_code = 'PLN_tv2y349z88b1bd8' THEN 'EMPIRE'
    ELSE 'SPARK'
  END,
  subscription_status = 'active',
  subscription_plan_code = p_plan_code,
  subscription_start_date = NOW()
  WHERE id = p_user_id;
  
  RAISE NOTICE 'Updated user % to tier based on plan %', p_user_id, p_plan_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to downgrade user to Spark tier
CREATE OR REPLACE FUNCTION downgrade_to_spark(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET user_tier = 'SPARK',
      subscription_status = 'inactive',
      subscription_plan_code = NULL,
      cancel_at_period_end = false
  WHERE id = p_user_id;
  
  RAISE NOTICE 'Downgraded user % to Spark tier', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id 
  ON public.subscription_events(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at 
  ON public.subscription_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
  ON public.profiles(subscription_status);

CREATE INDEX IF NOT EXISTS idx_profiles_paystack_customer_code 
  ON public.profiles(paystack_customer_code);

-- =============================================
-- 5. VERIFY SETUP
-- =============================================

-- Check that columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name LIKE '%subscription%'
ORDER BY column_name;

-- Check subscription_events table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscription_events'
ORDER BY ordinal_position;

-- Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'subscription_events';

-- =============================================
-- DONE!
-- =============================================
-- Your database is now ready for Paystack subscriptions
-- Next steps:
-- 1. Deploy the webhook handler to Vercel
-- 2. Configure webhook URL in Paystack dashboard
-- 3. Test with Paystack test cards
