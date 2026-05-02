-- ==============================================================================
-- GENESIS PHANTOM TABLES — SQL-READY SCHEMA
-- ==============================================================================
-- 23 tables referenced in code but not yet created in the database.
-- Extracted by deep analysis of every .from(), .select(), .insert(),
-- .update(), .upsert(), .delete(), and realtime subscription in:
--   services/broadcastService.ts, services/notificationService.ts,
--   services/collaborationService.ts, services/versionControlService.ts,
--   services/insightsService.ts, components/settings/DataManagement.tsx
-- Types cross-referenced from types/advanced.ts and types/collaboration.ts
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. broadcast_sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts
-- Operations: INSERT, SELECT, UPDATE (status, viewer_count, settings)
-- Realtime: postgres_changes UPDATE (filter: id=eq.{sessionId})
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    description     text,
    status          text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','live','ended','recorded')),
    viewer_count    integer NOT NULL DEFAULT 0,
    max_viewers     integer NOT NULL DEFAULT 100,
    started_at      timestamptz,
    ended_at        timestamptz,
    scheduled_for   timestamptz,
    recording_url   text,
    thumbnail_url   text,
    settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
    tags            text[] NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_sessions_broadcaster ON public.broadcast_sessions(broadcaster_id);
CREATE INDEX idx_broadcast_sessions_status ON public.broadcast_sessions(status);
CREATE INDEX idx_broadcast_sessions_scheduled ON public.broadcast_sessions(scheduled_for)
    WHERE status = 'scheduled';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. broadcast_viewers
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts
-- Operations: UPSERT, SELECT, UPDATE (is_active, left_at)
-- Realtime: postgres_changes INSERT/UPDATE/DELETE (filter: session_id=eq.{sessionId})
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_viewers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES public.broadcast_sessions(id) ON DELETE CASCADE,
    viewer_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at       timestamptz NOT NULL DEFAULT now(),
    left_at         timestamptz,
    is_active       boolean NOT NULL DEFAULT true,
    watch_duration  integer NOT NULL DEFAULT 0,
    interactions    integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (session_id, viewer_id)
);

CREATE INDEX idx_broadcast_viewers_session_active ON public.broadcast_viewers(session_id)
    WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. broadcast_messages
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts
-- Operations: INSERT, SELECT, UPDATE (is_pinned, is_answered)
-- Realtime: postgres_changes INSERT (filter: session_id=eq.{sessionId})
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES public.broadcast_sessions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message         text NOT NULL,
    type            text NOT NULL DEFAULT 'chat'
                        CHECK (type IN ('chat','question','tip','system','highlight')),
    is_pinned       boolean NOT NULL DEFAULT false,
    is_answered     boolean NOT NULL DEFAULT false,
    parent_id       uuid REFERENCES public.broadcast_messages(id) ON DELETE SET NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_messages_session ON public.broadcast_messages(session_id, created_at);
CREATE INDEX idx_broadcast_messages_unanswered ON public.broadcast_messages(session_id)
    WHERE type = 'question' AND is_answered = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. broadcast_bookmarks
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts
-- Operations: INSERT, SELECT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_bookmarks (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES public.broadcast_sessions(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp_seconds   integer NOT NULL,
    title               text,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_bookmarks_session_user ON public.broadcast_bookmarks(session_id, user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. mentor_relationships
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts
-- Operations: INSERT, SELECT, UPDATE (status)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_relationships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    apprentice_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','completed','cancelled')),
    goals           text,
    notes           text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,

    UNIQUE (mentor_id, apprentice_id)
);

CREATE INDEX idx_mentor_relationships_mentor ON public.mentor_relationships(mentor_id);
CREATE INDEX idx_mentor_relationships_apprentice ON public.mentor_relationships(apprentice_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. user_follows
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/broadcastService.ts + services/insightsService.ts
-- Operations: INSERT, SELECT, DELETE
-- Code references: follower_id, following_id, notifications_enabled, id, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_follows (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notifications_enabled   boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),

    UNIQUE (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. notifications
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/notificationService.ts + services/broadcastService.ts
-- Operations: INSERT (single + bulk), SELECT, UPDATE (is_read, read_at), DELETE
-- Realtime: postgres_changes INSERT (filter: user_id=eq.{userId})
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type            text NOT NULL,
    title           text NOT NULL,
    message         text NOT NULL,
    action_url      text,
    action_label    text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    priority        text NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','urgent')),
    is_read         boolean NOT NULL DEFAULT false,
    is_archived     boolean NOT NULL DEFAULT false,
    group_key       text,
    grouped_with    text,
    read_at         timestamptz,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC)
    WHERE is_read = false;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at)
    WHERE expires_at IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. notification_preferences
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/notificationService.ts
-- Operations: SELECT, UPSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email_enabled           boolean NOT NULL DEFAULT true,
    push_enabled            boolean NOT NULL DEFAULT true,
    in_app_enabled          boolean NOT NULL DEFAULT true,
    broadcast_live          boolean NOT NULL DEFAULT true,
    challenge_reminders     boolean NOT NULL DEFAULT true,
    social_interactions     boolean NOT NULL DEFAULT true,
    mentorship_updates      boolean NOT NULL DEFAULT true,
    weekly_digest           boolean NOT NULL DEFAULT true,
    quiet_hours_start       text NOT NULL DEFAULT '22:00',
    quiet_hours_end         text NOT NULL DEFAULT '08:00',
    quiet_hours_enabled     boolean NOT NULL DEFAULT false,
    digest_frequency        text DEFAULT 'realtime'
                                CHECK (digest_frequency IN ('realtime','daily','weekly','never')),
    enabled_types           text[],
    sound_enabled           boolean DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. collaboration_sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts
-- Operations: INSERT, SELECT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            text NOT NULL DEFAULT 'Creative Session',
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_collaboration_sessions_active ON public.collaboration_sessions(created_at DESC)
    WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. session_participants
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts
-- Operations: UPSERT, SELECT, UPDATE (status, last_seen_at), DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_participants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES public.collaboration_sessions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'idle'
                        CHECK (status IN ('idle','typing','generating','done','away')),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),

    UNIQUE (session_id, user_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. shared_visuals
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts + services/versionControlService.ts
--         + services/insightsService.ts
-- Operations: INSERT, SELECT, UPDATE (implicit via reaction_count)
-- Realtime: postgres_changes INSERT (filter: session_id=eq.{sessionId})
-- Note: Some queries use user_id, others use creator_id — the fork code
--       uses creator_id. TypeScript interface uses user_id. We include both
--       to satisfy all code paths (creator_id as alias or separate column).
--       Recommendation: use user_id in schema and rename creator_id refs in code.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_visuals (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- creator_id is used in versionControlService fork code; alias it:
    creator_id          uuid GENERATED ALWAYS AS (user_id) STORED,

    -- Core image data
    image_url           text NOT NULL,
    thumbnail_url       text,
    prompt              text NOT NULL,
    negative_prompt     text,

    -- Settings for reproducibility
    settings            jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Remix / fork lineage
    parent_id           uuid REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    forked_from_id      uuid REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    is_fork             boolean NOT NULL DEFAULT false,
    remix_count         integer NOT NULL DEFAULT 0,
    generation_depth    integer NOT NULL DEFAULT 0,

    -- Visibility & moderation
    visibility          text NOT NULL DEFAULT 'public'
                            CHECK (visibility IN ('public','private','unlisted','featured')),
    is_nsfw             boolean NOT NULL DEFAULT false,
    moderation_status   text NOT NULL DEFAULT 'pending'
                            CHECK (moderation_status IN ('pending','approved','rejected')),

    -- Engagement metrics
    reaction_count      integer NOT NULL DEFAULT 0,
    comment_count       integer NOT NULL DEFAULT 0,
    view_count          integer NOT NULL DEFAULT 0,

    -- Metadata
    tags                text[] NOT NULL DEFAULT '{}',
    title               text,
    description         text,

    -- Session context
    session_id          uuid REFERENCES public.collaboration_sessions(id) ON DELETE SET NULL,

    -- Timestamps
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- NOTE: If GENERATED ALWAYS is not desired, use a simple column instead:
-- creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
-- and keep it in sync with user_id in your application code or via trigger.
-- Alternatively, drop `creator_id` and update versionControlService.ts to use `user_id`.

CREATE INDEX idx_shared_visuals_user ON public.shared_visuals(user_id);
CREATE INDEX idx_shared_visuals_session ON public.shared_visuals(session_id);
CREATE INDEX idx_shared_visuals_visibility ON public.shared_visuals(visibility, created_at DESC);
CREATE INDEX idx_shared_visuals_parent ON public.shared_visuals(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_shared_visuals_forked ON public.shared_visuals(forked_from_id) WHERE forked_from_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. reactions
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts + services/insightsService.ts
-- Operations: INSERT, SELECT, DELETE
-- Realtime: postgres_changes INSERT/DELETE (table-level, no filter)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_id       uuid NOT NULL REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type   text NOT NULL
                        CHECK (reaction_type IN (
                            'fire','heart','star','mindblown','clap',
                            'rocket','sparkles','crown','lightbulb','gem'
                        )),
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (visual_id, user_id, reaction_type)
);

CREATE INDEX idx_reactions_visual ON public.reactions(visual_id);
CREATE INDEX idx_reactions_user ON public.reactions(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. challenges
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts + services/insightsService.ts
-- Operations: SELECT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               text NOT NULL,
    description         text NOT NULL,
    theme               text NOT NULL,
    prompt_hint         text,
    cover_image_url     text,
    starts_at           timestamptz NOT NULL,
    ends_at             timestamptz NOT NULL,
    required_style      text,
    required_elements   text[],
    xp_reward           integer NOT NULL DEFAULT 0,
    badge_id            text,
    status              text NOT NULL DEFAULT 'upcoming'
                            CHECK (status IN ('upcoming','active','voting','completed')),
    winner_visual_id    uuid REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    difficulty          text NOT NULL DEFAULT 'medium'
                            CHECK (difficulty IN ('easy','medium','hard','expert')),
    category            text NOT NULL DEFAULT 'general',
    sponsor_name        text,
    sponsor_logo_url    text,
    submission_count    integer NOT NULL DEFAULT 0,
    participant_count   integer NOT NULL DEFAULT 0,
    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_status ON public.challenges(status, ends_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. challenge_submissions
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts + services/insightsService.ts
-- Operations: INSERT, SELECT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id    uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    visual_id       uuid NOT NULL REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_count      integer NOT NULL DEFAULT 0,
    final_rank      integer,
    is_winner       boolean NOT NULL DEFAULT false,
    submitted_at    timestamptz NOT NULL DEFAULT now(),

    UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_challenge_submissions_challenge ON public.challenge_submissions(challenge_id);
CREATE INDEX idx_challenge_submissions_user ON public.challenge_submissions(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. challenge_votes
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts
-- Operations: INSERT, SELECT, DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenge_votes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   uuid NOT NULL REFERENCES public.challenge_submissions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (submission_id, user_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 16. visual_versions
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/versionControlService.ts
-- Operations: INSERT, SELECT, UPDATE (is_starred), DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_versions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_id           uuid NOT NULL,  -- FK to shared_visuals if versions belong to shared visuals
    parent_version_id   uuid REFERENCES public.visual_versions(id) ON DELETE SET NULL,
    branch_id           uuid,           -- FK added after visual_branches is created
    version_number      integer NOT NULL,
    version_name        text,
    prompt              text NOT NULL,
    negative_prompt     text,
    image_url           text NOT NULL,
    thumbnail_url       text,
    settings            jsonb NOT NULL DEFAULT '{}'::jsonb,
    data                jsonb,
    diff                jsonb,
    change_description  text,
    commit_message      text,
    is_auto_save        boolean NOT NULL DEFAULT false,
    is_starred          boolean NOT NULL DEFAULT false,
    changes_summary     jsonb,
    created_by          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visual_versions_visual ON public.visual_versions(visual_id, version_number);
CREATE INDEX idx_visual_versions_parent ON public.visual_versions(parent_version_id)
    WHERE parent_version_id IS NOT NULL;
CREATE INDEX idx_visual_versions_starred ON public.visual_versions(created_by)
    WHERE is_starred = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 17. visual_branches
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/versionControlService.ts
-- Operations: INSERT, SELECT, UPDATE (is_merged, merged_at, merged_version_id), DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_branches (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_id               uuid NOT NULL,
    name                    text NOT NULL,
    branch_name             text,
    description             text,
    created_from_version_id uuid NOT NULL REFERENCES public.visual_versions(id) ON DELETE CASCADE,
    base_version_id         uuid REFERENCES public.visual_versions(id) ON DELETE SET NULL,
    head_version_id         uuid REFERENCES public.visual_versions(id) ON DELETE SET NULL,
    is_default              boolean NOT NULL DEFAULT false,
    is_merged               boolean NOT NULL DEFAULT false,
    merged_at               timestamptz,
    merged_version_id       uuid REFERENCES public.visual_versions(id) ON DELETE SET NULL,
    merged_into_id          uuid REFERENCES public.visual_branches(id) ON DELETE SET NULL,
    created_by              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- Now add the FK from visual_versions.branch_id → visual_branches.id
ALTER TABLE public.visual_versions
    ADD CONSTRAINT fk_visual_versions_branch
    FOREIGN KEY (branch_id) REFERENCES public.visual_branches(id) ON DELETE SET NULL;

CREATE INDEX idx_visual_branches_visual ON public.visual_branches(visual_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 18. version_comparisons
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/versionControlService.ts
-- Operations: INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.version_comparisons (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_a_id        uuid NOT NULL REFERENCES public.visual_versions(id) ON DELETE CASCADE,
    version_b_id        uuid NOT NULL REFERENCES public.visual_versions(id) ON DELETE CASCADE,
    diff_data           jsonb NOT NULL DEFAULT '{}'::jsonb,
    similarity_score    integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 19. user_insights
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/insightsService.ts
-- Operations: SELECT, UPSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_insights (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    period_type                 text CHECK (period_type IN ('week','month','year')),
    period_start                timestamptz,
    period_end                  timestamptz,
    total_visuals               integer NOT NULL DEFAULT 0,
    total_reactions_received    integer NOT NULL DEFAULT 0,
    total_remixes               integer NOT NULL DEFAULT 0,
    streak_days                 integer NOT NULL DEFAULT 0,
    best_streak                 integer NOT NULL DEFAULT 0,
    challenges_won              integer NOT NULL DEFAULT 0,
    challenges_participated     integer NOT NULL DEFAULT 0,
    favorite_styles             text[] NOT NULL DEFAULT '{}',
    favorite_subjects           text[] NOT NULL DEFAULT '{}',
    peak_creative_hours         integer[] NOT NULL DEFAULT '{}',
    avg_generation_time         integer NOT NULL DEFAULT 0,
    style_diversity_score       integer NOT NULL DEFAULT 0,
    engagement_rate             integer NOT NULL DEFAULT 0,
    weekly_summary              jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics                     jsonb,
    recommendations             jsonb NOT NULL DEFAULT '[]'::jsonb,
    achievements                jsonb,
    calculated_at               timestamptz NOT NULL DEFAULT now(),
    created_at                  timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 20. visual_generations
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/insightsService.ts + components/settings/DataManagement.tsx
-- Operations: SELECT (count, settings, created_at, generation_time_ms, is_shared), DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_generations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt              text,
    image_url           text,
    settings            jsonb NOT NULL DEFAULT '{}'::jsonb,
    generation_time_ms  integer,
    is_shared           boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visual_generations_user ON public.visual_generations(user_id, created_at DESC);
CREATE INDEX idx_visual_generations_unshared ON public.visual_generations(user_id)
    WHERE is_shared = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 21. visual_tags
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/insightsService.ts
-- Operations: SELECT (tag, created_at)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_id       uuid REFERENCES public.shared_visuals(id) ON DELETE CASCADE,
    tag             text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visual_tags_tag ON public.visual_tags(tag);
CREATE INDEX idx_visual_tags_created ON public.visual_tags(created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 22. trending_styles
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/insightsService.ts
-- Operations: SELECT, UPSERT (onConflict: style_name)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trending_styles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    style_name      text NOT NULL UNIQUE,
    style           text,                       -- alias used in some reads
    usage_count     integer NOT NULL DEFAULT 0,
    growth_rate     numeric NOT NULL DEFAULT 0,
    growth_percentage numeric NOT NULL DEFAULT 0,
    trend_direction text NOT NULL DEFAULT 'stable'
                        CHECK (trend_direction IN ('rising','falling','stable')),
    period_start    timestamptz,
    period_end      timestamptz,
    sample_visuals  text[] DEFAULT '{}',
    sample_visual_ids text[] DEFAULT '{}',
    sample_images   text[] DEFAULT '{}',
    rank            integer,
    metadata        jsonb,
    calculated_at   timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 23. projects
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: components/settings/DataManagement.tsx
-- Operations: SELECT (count + full), DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            text,
    description     text,
    settings        jsonb DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON public.projects(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVITIES (bonus — referenced in collaborationService.ts realtime)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source: services/collaborationService.ts
-- Operations: SELECT
-- Realtime: postgres_changes INSERT (filter: session_id=eq.{sessionId})
-- Not in the original 23 list but tightly coupled — included for completeness
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type            text NOT NULL,
    visual_id       uuid REFERENCES public.shared_visuals(id) ON DELETE SET NULL,
    challenge_id    uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
    session_id      uuid REFERENCES public.collaboration_sessions(id) ON DELETE SET NULL,
    target_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    scope           text NOT NULL DEFAULT 'global'
                        CHECK (scope IN ('global','session','private')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_scope ON public.activities(scope, created_at DESC);
CREATE INDEX idx_activities_session ON public.activities(session_id, created_at DESC)
    WHERE session_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have updated_at columns
CREATE TRIGGER trg_broadcast_sessions_updated_at
    BEFORE UPDATE ON public.broadcast_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_shared_visuals_updated_at
    BEFORE UPDATE ON public.shared_visuals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: RPC function referenced in versionControlService.ts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_remix_count(visual_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.shared_visuals
    SET remix_count = remix_count + 1
    WHERE id = visual_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.broadcast_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_visuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE REALTIME FOR TABLES THAT NEED IT
-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_sessions:  UPDATE subscription (status, viewer_count)
-- broadcast_viewers:   INSERT/UPDATE/* subscription
-- broadcast_messages:  INSERT subscription
-- notifications:       INSERT subscription
-- shared_visuals:      INSERT subscription
-- reactions:           INSERT/DELETE subscription
-- activities:          INSERT subscription
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_visuals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
