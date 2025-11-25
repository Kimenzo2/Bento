-- =============================================
-- GENESIS SUPABASE DATABASE SCHEMA
-- =============================================
-- This schema handles user authentication, profiles, and book storage
-- Run this in your Supabase SQL Editor

-- =============================================
-- 1. USER PROFILES TABLE
-- =============================================
-- Extends Supabase auth.users with additional profile information
-- Automatically created when a user signs up

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  user_tier TEXT DEFAULT 'SPARK' CHECK (user_tier IN ('SPARK', 'CREATOR', 'STUDIO', 'EMPIRE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles table
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- 2. BOOKS TABLE
-- =============================================
-- Stores user-generated books with full project data

CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  synopsis TEXT,
  cover_image TEXT,
  project_data JSONB NOT NULL, -- Full BookProject object
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Policies for books table
CREATE POLICY "Users can view own books"
  ON public.books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own books"
  ON public.books FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS books_user_id_idx ON public.books(user_id);
CREATE INDEX IF NOT EXISTS books_created_at_idx ON public.books(created_at DESC);

-- =============================================
-- 3. TRIGGER: Auto-create profile on signup
-- =============================================
-- Automatically creates a profile when a new user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for re-running this script)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 4. TRIGGER: Update timestamp on profile changes
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_book_updated ON public.books;
CREATE TRIGGER on_book_updated
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Function to get user's current tier
CREATE OR REPLACE FUNCTION public.get_user_tier(user_id UUID)
RETURNS TEXT AS $$
  SELECT user_tier FROM public.profiles WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to count user's books
CREATE OR REPLACE FUNCTION public.count_user_books(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.books WHERE user_id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================
-- SETUP COMPLETE
-- =============================================
-- Next steps:
-- 1. Enable Google OAuth in Supabase Dashboard > Authentication > Providers
-- 2. Configure email templates in Supabase Dashboard > Authentication > Email Templates
-- 3. Add your environment variables to .env file
