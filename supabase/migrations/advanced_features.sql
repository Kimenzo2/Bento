-- ==============================================================================
-- GENESIS ADVANCED FEATURES - DATABASE MIGRATION
-- ==============================================================================
-- Features: Live Broadcasting, Notifications, Insights, Version Control
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- LIVE BROADCASTING SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- Broadcast Sessions
CREATE TABLE IF NOT EXISTS broadcast_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcaster_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'recorded')),
    viewer_count INTEGER DEFAULT 0,
    max_viewers INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    recording_url TEXT,
    thumbnail_url TEXT,
    settings JSONB DEFAULT '{
        "chat_enabled": true,
        "questions_enabled": true,
        "copy_settings_enabled": true,
        "max_viewers": 100,
        "is_private": false,
        "notification_sent": false
    }'::jsonb,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast Viewers
CREATE TABLE IF NOT EXISTS broadcast_viewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    watch_duration INTEGER DEFAULT 0, -- seconds
    interactions INTEGER DEFAULT 0, -- messages, reactions, etc.
    UNIQUE(session_id, viewer_id)
);

-- Broadcast Messages (Chat + Questions)
CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'chat' CHECK (type IN ('chat', 'question', 'tip', 'system', 'highlight')),
    is_pinned BOOLEAN DEFAULT false,
    is_answered BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES broadcast_messages(id), -- For replies
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mentor Relationships
CREATE TABLE IF NOT EXISTS mentor_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    apprentice_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    goals TEXT,
    notes TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(mentor_id, apprentice_id)
);

-- Follower System
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notifications_enabled BOOLEAN DEFAULT true,
    UNIQUE(follower_id, following_id)
);

-- Broadcast Bookmarks (Timestamp markers)
CREATE TABLE IF NOT EXISTS broadcast_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp_seconds INTEGER NOT NULL,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'remix', 'reaction', 'mention', 'follower', 'broadcast', 
        'challenge', 'milestone', 'trend_alert', 'insight', 
        'collaboration', 'broadcast_live', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    grouped_with UUID REFERENCES notifications(id), -- For batched notifications
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('realtime', 'daily', 'weekly', 'never')),
    enabled_types TEXT[] DEFAULT ARRAY['remix', 'reaction', 'mention', 'follower', 'broadcast', 'challenge', 'milestone', 'trend_alert', 'insight', 'collaboration', 'broadcast_live'],
    quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00", "timezone": "UTC"}'::jsonb,
    sound_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CREATIVE INSIGHTS SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- User Insights (Weekly/Monthly summaries)
CREATE TABLE IF NOT EXISTS user_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'year')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    achievements JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_type, period_start)
);

-- Trending Styles
CREATE TABLE IF NOT EXISTS trending_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    style_combination TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    growth_rate DECIMAL(7,2) DEFAULT 0, -- Percentage growth
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    sample_visual_ids UUID[] DEFAULT '{}',
    rank INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Achievements/Milestones
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    progress INTEGER DEFAULT 0,
    target INTEGER DEFAULT 1,
    unlocked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_type, achievement_name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERSION CONTROL SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- Visual Versions
CREATE TABLE IF NOT EXISTS visual_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_id UUID REFERENCES shared_visuals(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    parent_version_id UUID REFERENCES visual_versions(id),
    branch_id UUID, -- Set after branch creation
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    diff JSONB, -- Changes from parent version
    commit_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(visual_id, version_number)
);

-- Visual Branches
CREATE TABLE IF NOT EXISTS visual_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_id UUID REFERENCES shared_visuals(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    description TEXT,
    base_version_id UUID REFERENCES visual_versions(id),
    head_version_id UUID REFERENCES visual_versions(id),
    is_default BOOLEAN DEFAULT false,
    is_merged BOOLEAN DEFAULT false,
    merged_into_id UUID REFERENCES visual_branches(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    merged_at TIMESTAMPTZ,
    UNIQUE(visual_id, branch_name)
);

-- Add branch reference to versions
ALTER TABLE visual_versions 
ADD CONSTRAINT fk_visual_versions_branch 
FOREIGN KEY (branch_id) REFERENCES visual_branches(id);

-- Version Comparisons (cached AI analysis)
CREATE TABLE IF NOT EXISTS version_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_a_id UUID REFERENCES visual_versions(id) ON DELETE CASCADE,
    version_b_id UUID REFERENCES visual_versions(id) ON DELETE CASCADE,
    diff_analysis JSONB,
    visual_changes TEXT[],
    similarity_score DECIMAL(5,4), -- 0.0000 to 1.0000
    ai_recommendations TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(version_a_id, version_b_id)
);

-- Version Restore History
CREATE TABLE IF NOT EXISTS version_restores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_id UUID REFERENCES shared_visuals(id) ON DELETE CASCADE,
    from_version_id UUID REFERENCES visual_versions(id),
    to_version_id UUID REFERENCES visual_versions(id),
    restored_by UUID REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Broadcasting indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcast_sessions(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON broadcast_sessions(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_broadcasts_broadcaster ON broadcast_sessions(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_viewers_session ON broadcast_viewers(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_viewers_viewer ON broadcast_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_session ON broadcast_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type);

-- Insights indexes
CREATE INDEX IF NOT EXISTS idx_user_insights_user ON user_insights(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_trending_styles_period ON trending_styles(period_end DESC, rank);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, unlocked_at DESC);

-- Version control indexes
CREATE INDEX IF NOT EXISTS idx_versions_visual ON visual_versions(visual_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_versions_parent ON visual_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_branches_visual ON visual_branches(visual_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_versions ON version_comparisons(version_a_id, version_b_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE broadcast_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_restores ENABLE ROW LEVEL SECURITY;

-- Broadcast Sessions policies
CREATE POLICY "Public broadcasts are viewable by all" ON broadcast_sessions
    FOR SELECT USING (
        settings->>'is_private' = 'false' OR 
        broadcaster_id = auth.uid()
    );

CREATE POLICY "Users can create broadcasts" ON broadcast_sessions
    FOR INSERT WITH CHECK (broadcaster_id = auth.uid());

CREATE POLICY "Broadcasters can update own sessions" ON broadcast_sessions
    FOR UPDATE USING (broadcaster_id = auth.uid());

-- Broadcast Viewers policies
CREATE POLICY "Viewers can see their own viewing history" ON broadcast_viewers
    FOR SELECT USING (viewer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM broadcast_sessions WHERE id = session_id AND broadcaster_id = auth.uid()
    ));

CREATE POLICY "Users can join broadcasts" ON broadcast_viewers
    FOR INSERT WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Users can update own viewing status" ON broadcast_viewers
    FOR UPDATE USING (viewer_id = auth.uid());

-- Broadcast Messages policies
CREATE POLICY "Messages in public broadcasts are viewable" ON broadcast_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM broadcast_sessions 
            WHERE id = session_id AND (settings->>'is_private' = 'false' OR broadcaster_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages" ON broadcast_messages
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Notification Preferences policies
CREATE POLICY "Users can manage own preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- User Insights policies
CREATE POLICY "Users can view own insights" ON user_insights
    FOR SELECT USING (user_id = auth.uid());

-- Trending Styles policies (public read)
CREATE POLICY "Trending styles are public" ON trending_styles
    FOR SELECT USING (true);

-- User Achievements policies
CREATE POLICY "Achievements are viewable by all" ON user_achievements
    FOR SELECT USING (true);

CREATE POLICY "System can manage achievements" ON user_achievements
    FOR ALL USING (user_id = auth.uid());

-- Visual Versions policies
CREATE POLICY "Versions follow visual visibility" ON visual_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM shared_visuals 
            WHERE id = visual_id AND (
                visibility IN ('public', 'featured') OR 
                user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Visual owners can create versions" ON visual_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM shared_visuals 
            WHERE id = visual_id AND user_id = auth.uid()
        ) OR created_by = auth.uid()
    );

-- Visual Branches policies
CREATE POLICY "Branches follow visual visibility" ON visual_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM shared_visuals 
            WHERE id = visual_id AND (
                visibility IN ('public', 'featured') OR 
                user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create branches" ON visual_branches
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- User Follows policies
CREATE POLICY "Follows are public" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON user_follows
    FOR ALL USING (follower_id = auth.uid());

-- Mentor Relationships policies
CREATE POLICY "Relationships visible to participants" ON mentor_relationships
    FOR SELECT USING (mentor_id = auth.uid() OR apprentice_id = auth.uid());

CREATE POLICY "Users can create relationships" ON mentor_relationships
    FOR INSERT WITH CHECK (mentor_id = auth.uid() OR apprentice_id = auth.uid());

CREATE POLICY "Participants can update relationships" ON mentor_relationships
    FOR UPDATE USING (mentor_id = auth.uid() OR apprentice_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE visual_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_follows;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to update broadcast viewer count
CREATE OR REPLACE FUNCTION update_broadcast_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false) THEN
        UPDATE broadcast_sessions
        SET viewer_count = viewer_count + 1,
            max_viewers = GREATEST(max_viewers, viewer_count + 1)
        WHERE id = NEW.session_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
        UPDATE broadcast_sessions
        SET viewer_count = GREATEST(viewer_count - 1, 0)
        WHERE id = NEW.session_id;
    ELSIF TG_OP = 'DELETE' AND OLD.is_active = true THEN
        UPDATE broadcast_sessions
        SET viewer_count = GREATEST(viewer_count - 1, 0)
        WHERE id = OLD.session_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_broadcast_viewer_count
AFTER INSERT OR UPDATE OR DELETE ON broadcast_viewers
FOR EACH ROW EXECUTE FUNCTION update_broadcast_viewer_count();

-- Function to auto-create notification preferences
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment version number
CREATE OR REPLACE FUNCTION get_next_version_number(p_visual_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM visual_versions
    WHERE visual_id = p_visual_id;
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA FOR ACHIEVEMENTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert achievement definitions (these are templates, actual user achievements reference these)
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    tiers JSONB NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO achievement_definitions (id, name, description, icon, category, tiers) VALUES
('first_visual', 'First Creation', 'Create your first visual', '🎨', 'creation', '[{"tier": "bronze", "target": 1}]'),
('prolific_creator', 'Prolific Creator', 'Create multiple visuals', '🖼️', 'creation', '[{"tier": "bronze", "target": 10}, {"tier": "silver", "target": 50}, {"tier": "gold", "target": 100}, {"tier": "platinum", "target": 500}, {"tier": "diamond", "target": 1000}]'),
('remix_master', 'Remix Master', 'Have your visuals remixed', '🔄', 'engagement', '[{"tier": "bronze", "target": 5}, {"tier": "silver", "target": 25}, {"tier": "gold", "target": 100}, {"tier": "platinum", "target": 500}]'),
('reaction_magnet', 'Reaction Magnet', 'Receive reactions on your work', '❤️', 'engagement', '[{"tier": "bronze", "target": 10}, {"tier": "silver", "target": 100}, {"tier": "gold", "target": 500}, {"tier": "platinum", "target": 2000}]'),
('style_explorer', 'Style Explorer', 'Try different art styles', '🎭', 'exploration', '[{"tier": "bronze", "target": 5}, {"tier": "silver", "target": 10}, {"tier": "gold", "target": 20}]'),
('challenge_champion', 'Challenge Champion', 'Win community challenges', '🏆', 'competition', '[{"tier": "bronze", "target": 1}, {"tier": "silver", "target": 5}, {"tier": "gold", "target": 10}, {"tier": "platinum", "target": 25}]'),
('mentor', 'Mentor', 'Help other creators learn', '👨‍🏫', 'community', '[{"tier": "bronze", "target": 1}, {"tier": "silver", "target": 5}, {"tier": "gold", "target": 10}]'),
('broadcaster', 'Broadcaster', 'Go live and share your process', '📺', 'community', '[{"tier": "bronze", "target": 1}, {"tier": "silver", "target": 10}, {"tier": "gold", "target": 50}]'),
('trendsetter', 'Trendsetter', 'Create visuals with trending styles', '🔥', 'trending', '[{"tier": "bronze", "target": 1}, {"tier": "silver", "target": 5}, {"tier": "gold", "target": 20}]'),
('early_adopter', 'Early Adopter', 'Join during beta period', '⭐', 'special', '[{"tier": "gold", "target": 1}]')
ON CONFLICT (id) DO NOTHING;
