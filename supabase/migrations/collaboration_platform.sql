-- ==============================================================================
-- GENESIS VISUAL STUDIO - COLLABORATIVE PLATFORM SCHEMA
-- ==============================================================================
-- Extends the existing realtime schema with advanced collaboration features:
-- - Shared Visuals (The Community Gallery)
-- - Reactions (Emoji-based feedback)
-- - Remix Lineage (Fork/remix tracking)
-- - Annotations (Drawing and voice notes)
-- - Challenges (Daily creative prompts with gamification)
-- - Activities (Real-time activity feed)
-- ==============================================================================

-- 1. SHARED VISUALS (Community Gallery)
-- ------------------------------------------------------------------------------
-- Enhanced visual_generations with sharing, remix, and discovery features
CREATE TABLE IF NOT EXISTS public.shared_visuals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Core image data
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    
    -- Generation settings for reproducibility
    settings JSONB DEFAULT '{}'::jsonb,
    -- Example: { "styleA": "Pixar 3D", "styleB": "Watercolor", "mixRatio": 70, "lighting": "Golden Hour" }
    
    -- Remix/Fork lineage
    parent_id UUID REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    remix_count INTEGER DEFAULT 0,
    generation_depth INTEGER DEFAULT 0, -- 0 = original, 1 = first remix, etc.
    
    -- Visibility & moderation
    visibility TEXT CHECK (visibility IN ('public', 'private', 'unlisted', 'featured')) DEFAULT 'public',
    is_nsfw BOOLEAN DEFAULT false,
    moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
    
    -- Engagement metrics (denormalized for performance)
    reaction_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    title TEXT,
    description TEXT,
    
    -- Session context (if created during collaboration)
    session_id UUID REFERENCES public.collaboration_sessions(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shared_visuals_user ON public.shared_visuals(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_visuals_parent ON public.shared_visuals(parent_id);
CREATE INDEX IF NOT EXISTS idx_shared_visuals_session ON public.shared_visuals(session_id);
CREATE INDEX IF NOT EXISTS idx_shared_visuals_visibility ON public.shared_visuals(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_shared_visuals_featured ON public.shared_visuals(visibility) WHERE visibility = 'featured';
CREATE INDEX IF NOT EXISTS idx_shared_visuals_created ON public.shared_visuals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_visuals_reactions ON public.shared_visuals(reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_visuals_tags ON public.shared_visuals USING GIN(tags);

-- Enable RLS
ALTER TABLE public.shared_visuals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public visuals are viewable by everyone"
    ON public.shared_visuals FOR SELECT
    USING (visibility IN ('public', 'featured') OR auth.uid() = user_id);

CREATE POLICY "Users can create visuals"
    ON public.shared_visuals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visuals"
    ON public.shared_visuals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own visuals"
    ON public.shared_visuals FOR DELETE
    USING (auth.uid() = user_id);

-- 2. REACTIONS (Emoji Feedback System)
-- ------------------------------------------------------------------------------
-- Allows users to react to visuals with various emoji types
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    visual_id UUID NOT NULL REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Reaction type (emoji identifier)
    reaction_type TEXT NOT NULL CHECK (reaction_type IN (
        'fire', 'heart', 'star', 'mindblown', 'clap', 
        'rocket', 'sparkles', 'crown', 'lightbulb', 'gem'
    )),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    
    -- Prevent duplicate reactions of same type from same user
    UNIQUE(visual_id, user_id, reaction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_visual ON public.reactions(visual_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON public.reactions(reaction_type);

-- Enable RLS
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Reactions are viewable by everyone"
    ON public.reactions FOR SELECT
    USING (true);

CREATE POLICY "Users can add reactions"
    ON public.reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
    ON public.reactions FOR DELETE
    USING (auth.uid() = user_id);

-- 3. ANNOTATIONS (Drawing & Voice Notes)
-- ------------------------------------------------------------------------------
-- Stores drawing strokes, text notes, and voice recordings on visuals
CREATE TABLE IF NOT EXISTS public.annotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    visual_id UUID NOT NULL REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Annotation type
    type TEXT NOT NULL CHECK (type IN ('drawing', 'text', 'voice', 'pin')),
    
    -- Position and dimensions (percentages for responsiveness)
    position_x FLOAT NOT NULL DEFAULT 50, -- 0-100
    position_y FLOAT NOT NULL DEFAULT 50, -- 0-100
    width FLOAT,
    height FLOAT,
    
    -- Content based on type
    content JSONB NOT NULL,
    -- Drawing: { "paths": [...], "color": "#FF5733", "strokeWidth": 3 }
    -- Text: { "text": "Great detail here!", "fontSize": 14, "color": "#333" }
    -- Voice: { "audioUrl": "...", "duration": 5.2, "transcript": "..." }
    -- Pin: { "label": "A", "color": "#3498db" }
    
    -- Visibility
    is_resolved BOOLEAN DEFAULT false,
    visibility TEXT CHECK (visibility IN ('public', 'collaborators', 'private')) DEFAULT 'public',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_annotations_visual ON public.annotations(visual_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON public.annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON public.annotations(type);

-- Enable RLS
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Annotations are viewable based on visibility"
    ON public.annotations FOR SELECT
    USING (
        visibility = 'public' 
        OR auth.uid() = user_id
        OR (visibility = 'collaborators' AND EXISTS (
            SELECT 1 FROM public.shared_visuals sv
            WHERE sv.id = visual_id AND sv.session_id IN (
                SELECT session_id FROM public.session_participants WHERE user_id = auth.uid()
            )
        ))
    );

CREATE POLICY "Users can create annotations"
    ON public.annotations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
    ON public.annotations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
    ON public.annotations FOR DELETE
    USING (auth.uid() = user_id);

-- 4. CHALLENGES (Daily Creative Prompts)
-- ------------------------------------------------------------------------------
-- Gamified challenges with themes, time limits, and rewards
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Challenge details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    theme TEXT NOT NULL,
    prompt_hint TEXT,
    
    -- Visual inspiration/example
    cover_image_url TEXT,
    
    -- Timing
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    
    -- Constraints
    required_style TEXT, -- Optional: must use this style
    required_elements TEXT[], -- Optional: must include these elements
    
    -- Rewards
    xp_reward INTEGER DEFAULT 100,
    badge_id TEXT, -- Reference to gamification badge
    
    -- Status
    status TEXT CHECK (status IN ('upcoming', 'active', 'voting', 'completed')) DEFAULT 'upcoming',
    
    -- Winner tracking
    winner_visual_id UUID REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    
    -- Metadata
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')) DEFAULT 'medium',
    category TEXT DEFAULT 'general',
    sponsor_name TEXT,
    sponsor_logo_url TEXT,
    
    -- Stats (denormalized)
    submission_count INTEGER DEFAULT 0,
    participant_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_starts ON public.challenges(starts_at);
CREATE INDEX IF NOT EXISTS idx_challenges_ends ON public.challenges(ends_at);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Challenges are viewable by everyone"
    ON public.challenges FOR SELECT
    USING (true);

CREATE POLICY "Only admins can create challenges"
    ON public.challenges FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'is_admin')::boolean = true
        )
    );

-- 5. CHALLENGE SUBMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    visual_id UUID NOT NULL REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Voting
    vote_count INTEGER DEFAULT 0,
    
    -- Ranking (set after challenge ends)
    final_rank INTEGER,
    
    -- Metadata
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    
    -- Prevent duplicate submissions
    UNIQUE(challenge_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON public.challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_visual ON public.challenge_submissions(visual_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON public.challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_votes ON public.challenge_submissions(vote_count DESC);

-- Enable RLS
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Submissions are viewable by everyone"
    ON public.challenge_submissions FOR SELECT
    USING (true);

CREATE POLICY "Users can submit to challenges"
    ON public.challenge_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 6. CHALLENGE VOTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES public.challenge_submissions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    
    -- One vote per user per submission
    UNIQUE(submission_id, user_id)
);

-- Enable RLS
ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are viewable by everyone"
    ON public.challenge_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can vote"
    ON public.challenge_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own votes"
    ON public.challenge_votes FOR DELETE
    USING (auth.uid() = user_id);

-- 7. ACTIVITY FEED
-- ------------------------------------------------------------------------------
-- Tracks all activities for the real-time feed
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Actor
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Activity type
    type TEXT NOT NULL CHECK (type IN (
        'visual_created', 'visual_remixed', 'visual_featured',
        'reaction_added', 'annotation_added', 'comment_added',
        'challenge_submitted', 'challenge_won',
        'user_joined', 'user_leveled_up',
        'collab_started', 'collab_joined'
    )),
    
    -- Related entities (polymorphic references)
    visual_id UUID REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.collaboration_sessions(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Additional context
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Example: { "reactionType": "fire", "xpEarned": 50 }
    
    -- Session scope (null = global activity)
    scope TEXT CHECK (scope IN ('global', 'session', 'private')) DEFAULT 'global',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_activities_user ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_visual ON public.activities(visual_id);
CREATE INDEX IF NOT EXISTS idx_activities_session ON public.activities(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_global ON public.activities(scope, created_at DESC) WHERE scope = 'global';

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Global activities are viewable by everyone"
    ON public.activities FOR SELECT
    USING (
        scope = 'global' 
        OR auth.uid() = user_id
        OR (scope = 'session' AND session_id IN (
            SELECT session_id FROM public.session_participants WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Activities are created by system triggers"
    ON public.activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. REALTIME SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
-- Add new tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_visuals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_submissions;

-- 9. FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

-- Function: Update reaction count on visual
CREATE OR REPLACE FUNCTION update_visual_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.shared_visuals
        SET reaction_count = reaction_count + 1, updated_at = now()
        WHERE id = NEW.visual_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.shared_visuals
        SET reaction_count = GREATEST(0, reaction_count - 1), updated_at = now()
        WHERE id = OLD.visual_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR DELETE ON public.reactions
FOR EACH ROW EXECUTE FUNCTION update_visual_reaction_count();

-- Function: Update remix count on parent visual
CREATE OR REPLACE FUNCTION update_visual_remix_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE public.shared_visuals
        SET remix_count = remix_count + 1, updated_at = now()
        WHERE id = NEW.parent_id;
        
        -- Set generation depth
        UPDATE public.shared_visuals
        SET generation_depth = (
            SELECT COALESCE(generation_depth, 0) + 1 
            FROM public.shared_visuals 
            WHERE id = NEW.parent_id
        )
        WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_remix_count
AFTER INSERT ON public.shared_visuals
FOR EACH ROW EXECUTE FUNCTION update_visual_remix_count();

-- Function: Update submission vote count
CREATE OR REPLACE FUNCTION update_submission_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.challenge_submissions
        SET vote_count = vote_count + 1
        WHERE id = NEW.submission_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.challenge_submissions
        SET vote_count = GREATEST(0, vote_count - 1)
        WHERE id = OLD.submission_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vote_count
AFTER INSERT OR DELETE ON public.challenge_votes
FOR EACH ROW EXECUTE FUNCTION update_submission_vote_count();

-- Function: Create activity on visual creation
CREATE OR REPLACE FUNCTION create_visual_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activities (user_id, type, visual_id, session_id, scope, metadata)
    VALUES (
        NEW.user_id,
        CASE 
            WHEN NEW.parent_id IS NOT NULL THEN 'visual_remixed'
            ELSE 'visual_created'
        END,
        NEW.id,
        NEW.session_id,
        CASE WHEN NEW.session_id IS NOT NULL THEN 'session' ELSE 'global' END,
        jsonb_build_object('prompt', LEFT(NEW.prompt, 100), 'parentId', NEW.parent_id)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_visual_activity
AFTER INSERT ON public.shared_visuals
FOR EACH ROW EXECUTE FUNCTION create_visual_activity();

-- Function: Create activity on reaction
CREATE OR REPLACE FUNCTION create_reaction_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
BEGIN
    SELECT session_id INTO v_session_id FROM public.shared_visuals WHERE id = NEW.visual_id;
    
    INSERT INTO public.activities (user_id, type, visual_id, session_id, scope, metadata)
    VALUES (
        NEW.user_id,
        'reaction_added',
        NEW.visual_id,
        v_session_id,
        CASE WHEN v_session_id IS NOT NULL THEN 'session' ELSE 'global' END,
        jsonb_build_object('reactionType', NEW.reaction_type)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_reaction_activity
AFTER INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION create_reaction_activity();

-- ==============================================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- ==============================================================================
-- Uncomment to insert sample challenge data

-- INSERT INTO public.challenges (title, description, theme, starts_at, ends_at, xp_reward, difficulty)
-- VALUES 
-- ('Magical Forest Adventure', 'Create a scene set in an enchanted forest with mystical creatures', 'Fantasy', now(), now() + interval '24 hours', 150, 'medium'),
-- ('Under the Sea', 'Illustrate an underwater world with colorful sea life', 'Ocean', now() + interval '1 day', now() + interval '2 days', 100, 'easy'),
-- ('Space Odyssey', 'Design a cosmic scene with planets, stars, and spacecraft', 'Sci-Fi', now() + interval '2 days', now() + interval '3 days', 200, 'hard');

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
