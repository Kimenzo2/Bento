-- ============================================
-- GENESIS REMIX & GREEN ROOM FEATURE MIGRATION
-- ============================================
-- This migration adds tables for:
-- 1. Green Room Sessions (character interviews)
-- 2. Remixable Worlds (public world library)
-- 3. World Forks (lineage tracking)
-- ============================================

-- ============================================
-- GREEN ROOM SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS green_room_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    total_facts_extracted INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for Green Room
CREATE INDEX IF NOT EXISTS idx_green_room_user ON green_room_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_green_room_character ON green_room_sessions(character_id);
CREATE INDEX IF NOT EXISTS idx_green_room_project ON green_room_sessions(project_id);

-- RLS for Green Room
ALTER TABLE green_room_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
    ON green_room_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON green_room_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON green_room_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON green_room_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- REMIXABLE WORLDS
-- ============================================
CREATE TABLE IF NOT EXISTS remixable_worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_name TEXT NOT NULL,
    creator_avatar TEXT,
    
    -- World Content
    magic_system TEXT,
    locations JSONB DEFAULT '[]'::jsonb,
    lore TEXT,
    rules JSONB DEFAULT '[]'::jsonb,
    era TEXT DEFAULT 'Fantasy',
    
    -- Sharing Settings
    is_public BOOLEAN DEFAULT true,
    allow_remix BOOLEAN DEFAULT true,
    require_credit BOOLEAN DEFAULT true,
    license TEXT DEFAULT 'attribution' CHECK (license IN ('open', 'attribution', 'non-commercial', 'restricted')),
    
    -- Stats
    total_remixes INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for Remixable Worlds
CREATE INDEX IF NOT EXISTS idx_worlds_creator ON remixable_worlds(creator_id);
CREATE INDEX IF NOT EXISTS idx_worlds_public ON remixable_worlds(is_public, allow_remix);
CREATE INDEX IF NOT EXISTS idx_worlds_trending ON remixable_worlds(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_popular ON remixable_worlds(total_remixes DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_tags ON remixable_worlds USING GIN(tags);

-- RLS for Remixable Worlds
ALTER TABLE remixable_worlds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public worlds"
    ON remixable_worlds FOR SELECT
    USING (is_public = true);

CREATE POLICY "Users can view their own worlds"
    ON remixable_worlds FOR SELECT
    USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert their own worlds"
    ON remixable_worlds FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own worlds"
    ON remixable_worlds FOR UPDATE
    USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own worlds"
    ON remixable_worlds FOR DELETE
    USING (auth.uid() = creator_id);

-- ============================================
-- WORLD FORKS (Lineage Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS world_forks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_world_id UUID NOT NULL REFERENCES remixable_worlds(id) ON DELETE SET NULL,
    parent_world_name TEXT NOT NULL,
    original_creator_id UUID NOT NULL,
    original_creator_name TEXT NOT NULL,
    
    forked_world_id UUID NOT NULL REFERENCES remixable_worlds(id) ON DELETE CASCADE,
    forked_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    forked_by_user_name TEXT NOT NULL,
    
    generation_number INTEGER DEFAULT 1,
    ancestor_chain UUID[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for World Forks
CREATE INDEX IF NOT EXISTS idx_forks_parent ON world_forks(parent_world_id);
CREATE INDEX IF NOT EXISTS idx_forks_forked ON world_forks(forked_world_id);
CREATE INDEX IF NOT EXISTS idx_forks_user ON world_forks(forked_by_user_id);

-- RLS for World Forks
ALTER TABLE world_forks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forks"
    ON world_forks FOR SELECT
    USING (true);

CREATE POLICY "Users can create forks"
    ON world_forks FOR INSERT
    WITH CHECK (auth.uid() = forked_by_user_id);

-- ============================================
-- WORLD LIKES
-- ============================================
CREATE TABLE IF NOT EXISTS world_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES remixable_worlds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(world_id, user_id)
);

-- Indexes for World Likes
CREATE INDEX IF NOT EXISTS idx_likes_world ON world_likes(world_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON world_likes(user_id);

-- RLS for World Likes
ALTER TABLE world_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
    ON world_likes FOR SELECT
    USING (true);

CREATE POLICY "Users can like worlds"
    ON world_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike worlds"
    ON world_likes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment remix count
CREATE OR REPLACE FUNCTION increment_remix_count(world_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE remixable_worlds
    SET total_remixes = total_remixes + 1,
        updated_at = now()
    WHERE id = world_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment like count
CREATE OR REPLACE FUNCTION increment_like_count(world_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE remixable_worlds
    SET total_likes = total_likes + 1,
        updated_at = now()
    WHERE id = world_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement like count
CREATE OR REPLACE FUNCTION decrement_like_count(world_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE remixable_worlds
    SET total_likes = GREATEST(0, total_likes - 1),
        updated_at = now()
    WHERE id = world_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment view count
CREATE OR REPLACE FUNCTION increment_view_count(world_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE remixable_worlds
    SET total_views = total_views + 1
    WHERE id = world_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_remixable_worlds_updated_at
    BEFORE UPDATE ON remixable_worlds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
