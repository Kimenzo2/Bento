-- ==============================================================================
-- GENESIS CREATOR SETTINGS & SUBSCRIPTIONS SCHEMA
-- ==============================================================================
-- This script updates the existing 'profiles' table to include Creator Settings
-- and creates a new 'user_subscriptions' table for managing plans.
-- ==============================================================================

-- 1. UPDATE PROFILES TABLE
-- ------------------------------------------------------------------------------
-- Add columns for Creator Settings if they don't exist.
-- We use 'do' blocks to safely add columns only if they are missing.

do $$
begin
    -- Bio / Author Note
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'bio') then
        alter table public.profiles add column bio text;
    end if;

    -- Default Art Style (e.g., 'Pixar 3D', 'Watercolor')
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'default_style') then
        alter table public.profiles add column default_style text default 'Pixar 3D';
    end if;

    -- Creativity Temperature (0.0 to 1.0)
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'creativity_temperature') then
        alter table public.profiles add column creativity_temperature float default 0.7;
    end if;

    -- Email Notifications (Generation Complete Alerts)
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'email_notifications') then
        alter table public.profiles add column email_notifications boolean default true;
    end if;

    -- Marketing Emails
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'marketing_emails') then
        alter table public.profiles add column marketing_emails boolean default false;
    end if;

    -- Public Profile Visibility
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'is_public') then
        alter table public.profiles add column is_public boolean default true;
    end if;

    -- Data Sharing (Content Analysis)
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'data_sharing_enabled') then
        alter table public.profiles add column data_sharing_enabled boolean default false;
    end if;
end $$;

-- 2. CREATE SUBSCRIPTIONS TABLE
-- ------------------------------------------------------------------------------
-- Stores the user's current plan status.
-- This is designed to be compatible with payment providers like Stripe/Paystack.

create table if not exists public.user_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    
    -- Plan Details
    plan_id text not null check (plan_id in ('spark', 'creator', 'visionary')),
    status text not null check (status in ('active', 'canceled', 'past_due', 'trialing')) default 'active',
    
    -- Billing Cycle
    current_period_start timestamp with time zone default timezone('utc'::text, now()),
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean default false,
    
    -- Metadata
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now()),
    
    -- Ensure one active subscription per user
    unique (user_id)
);

-- Enable RLS
alter table public.user_subscriptions enable row level security;

-- Policies
create policy "Users can view their own subscription."
    on public.user_subscriptions for select
    using ( auth.uid() = user_id );

-- Only service role (admin) should insert/update subscriptions usually, 
-- but for now we allow users to read. Updates should happen via server-side functions or webhooks.

-- 3. AUTOMATIC PROFILE CREATION TRIGGER
-- ------------------------------------------------------------------------------
-- Ensures a profile row exists whenever a new user signs up via Supabase Auth.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- Also assign the default 'Spark' plan
  insert into public.user_subscriptions (user_id, plan_id, status)
  values (new.id, 'spark', 'active');
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition (drops if exists to allow updates)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. HELPER FUNCTION: UPDATE SETTINGS
-- ------------------------------------------------------------------------------
-- A simple function to update multiple profile settings at once.

create or replace function update_creator_settings(
    p_bio text,
    p_default_style text,
    p_temperature float,
    p_email_notifications boolean,
    p_marketing_emails boolean,
    p_is_public boolean,
    p_data_sharing_enabled boolean
)
returns void as $$
begin
    update public.profiles
    set 
        bio = p_bio,
        default_style = p_default_style,
        creativity_temperature = p_temperature,
        email_notifications = p_email_notifications,
        marketing_emails = p_marketing_emails,
        is_public = p_is_public,
        data_sharing_enabled = p_data_sharing_enabled,
        updated_at = now()
    where id = auth.uid();
end;
$$ language plpgsql security definer;
