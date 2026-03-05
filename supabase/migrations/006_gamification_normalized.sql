-- ════════════════════════════════════════════════════════════════════════════
-- 006_gamification_normalized.sql
-- Removes ALL hardcoded gamification data from code.
-- Creates canonical DB tables as the single source of truth for:
--   levels, XP action values, badges, daily challenges, and user state.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Canonical level definitions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS level_definitions (
  level       INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  title       TEXT    NOT NULL
);

INSERT INTO level_definitions (level, xp_required, title) VALUES
  (1,     0, 'Aspiring Author'),
  (2,   100, 'Wordsmith'),
  (3,   300, 'Story Weaver'),
  (4,   600, 'Rising Author'),
  (5,  1000, 'Published Creator'),
  (6,  1500, 'Master Storyteller'),
  (7,  2200, 'Literary Legend'),
  (8,  3000, 'Epic Narrator'),
  (9,  4000, 'World Builder'),
  (10, 5500, 'Genesis Grandmaster')
ON CONFLICT (level) DO NOTHING;

-- ── 2. Canonical XP award values ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_action_values (
  action_name TEXT    PRIMARY KEY,
  xp_value    INTEGER NOT NULL
);

INSERT INTO xp_action_values (action_name, xp_value) VALUES
  ('book_created',              50),
  ('page_edited',                5),
  ('illustration_generated',    10),
  ('suggestion_accepted',        3),
  ('daily_challenge_completed', 25),
  ('brand_content_created',     75),
  ('qa_score_90',               30),
  ('daily_login',               10)
ON CONFLICT (action_name) DO NOTHING;

-- ── 3. Extend existing achievement_definitions with gamification trigger data ─
ALTER TABLE achievement_definitions
  ADD COLUMN IF NOT EXISTS trigger_action TEXT,
  ADD COLUMN IF NOT EXISTS trigger_count  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE;

-- Upsert the 10 canonical badges (matches gamificationAgent BADGE_DEFINITIONS)
INSERT INTO achievement_definitions (id, name, description, icon, category, tiers, trigger_action, trigger_count, is_active) VALUES
  ('first_book',    'First Book',        'Created your first ebook',          'BookOpen',  'creation',     '[{"tier":"bronze","target":1}]',  'book_created',            1, true),
  ('five_books',    'Prolific Writer',   'Created 5 ebooks',                  'Library',   'creation',     '[{"tier":"silver","target":5}]',  'book_created',            5, true),
  ('ten_books',     'Publishing House',  'Created 10 ebooks',                 'Building2', 'creation',     '[{"tier":"gold","target":10}]',   'book_created',           10, true),
  ('first_edit',    'Editor''s Eye',     'Used the Smart Editor',             'Pencil',    'creation',     '[{"tier":"bronze","target":1}]',  'page_edited',             1, true),
  ('illustrator',   'Visual Storyteller','Generated 10 illustrations',        'Palette',   'creation',     '[{"tier":"silver","target":10}]', 'illustration_generated', 10, true),
  ('streak_3',      'On a Roll',         '3-day creation streak',             'Flame',     'streak',       '[{"tier":"bronze","target":3}]',  'streak',                  3, true),
  ('streak_7',      'Weekly Warrior',    '7-day creation streak',             'Zap',       'streak',       '[{"tier":"silver","target":7}]',  'streak',                  7, true),
  ('streak_30',     'Monthly Master',    '30-day creation streak',            'Crown',     'streak',       '[{"tier":"gold","target":30}]',   'streak',                 30, true),
  ('brand_creator', 'Brand Builder',     'Created a brand content piece',     'Briefcase', 'professional', '[{"tier":"bronze","target":1}]',  'brand_content_created',   1, true),
  ('qa_perfect',    'Quality Champion',  'Scored 90+ on a QA check',          'Award',     'quality',      '[{"tier":"gold","target":1}]',    'qa_score_90',             1, true)
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  description    = EXCLUDED.description,
  icon           = EXCLUDED.icon,
  trigger_action = EXCLUDED.trigger_action,
  trigger_count  = EXCLUDED.trigger_count,
  is_active      = EXCLUDED.is_active;

-- ── 4. Normalized user gamification state ─────────────────────────────────────
-- Single source of truth per user — replaces gamification_data JSONB on profiles
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id                       UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_xp                    INTEGER NOT NULL DEFAULT 0,    -- XP since last level threshold
  total_xp                      INTEGER NOT NULL DEFAULT 0,    -- All-time accumulated XP
  level                         INTEGER NOT NULL DEFAULT 1,
  level_title                   TEXT    NOT NULL DEFAULT 'Aspiring Author',
  books_created_count           INTEGER NOT NULL DEFAULT 0,
  pages_edited_count            INTEGER NOT NULL DEFAULT 0,
  illustrations_generated_count INTEGER NOT NULL DEFAULT 0,
  brand_content_created_count   INTEGER NOT NULL DEFAULT 0,
  current_streak                INTEGER NOT NULL DEFAULT 0,
  best_streak                   INTEGER NOT NULL DEFAULT 0,
  last_activity_date            DATE,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view own gamification"
  ON user_gamification FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users update own gamification"
  ON user_gamification FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role manages all gamification"
  ON user_gamification FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_gamification_total_xp
  ON user_gamification(total_xp DESC);

-- ── 5. Immutable XP event log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_name TEXT        NOT NULL,
  xp_awarded  INTEGER     NOT NULL,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view own XP events"
  ON xp_events FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role inserts XP events"
  ON xp_events FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_date
  ON xp_events(user_id, created_at DESC);

-- ── 6. Daily challenge pool ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_challenge_pool (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT,
  action_type TEXT    NOT NULL,
  xp_reward   INTEGER NOT NULL DEFAULT 25,
  difficulty  TEXT    DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO daily_challenge_pool (id, title, description, action_type, xp_reward, difficulty) VALUES
  ('create_book_today',  'Create a new ebook today',            'Bring a new story to life',              'book_created',           25, 'easy'),
  ('create_first_book',  'Create your very first ebook!',       'Begin your author journey',              'book_created',           50, 'easy'),
  ('edit_pages',         'Edit 3 pages in the Smart Editor',    'Polish your writing with AI assistance', 'page_edited',            20, 'easy'),
  ('generate_images',    'Generate 2 new illustrations',        'Bring your story to life visually',      'illustration_generated', 20, 'easy'),
  ('new_art_style',      'Try an art style you haven''t used',  'Explore creative possibilities',         'illustration_generated', 30, 'medium'),
  ('brand_content',      'Create a brand content piece',        'Expand your professional portfolio',     'brand_content_created',  40, 'medium'),
  ('start_streak',       'Start a creation streak!',            'Come back tomorrow to keep it going',    'book_created',           15, 'easy'),
  ('maintain_streak_3',  'Maintain your 3-day streak',          'Consistency breeds creativity',          'book_created',           20, 'medium'),
  ('maintain_streak_7',  'Keep your 7-day streak alive',        'A week of dedication',                   'book_created',           35, 'hard'),
  ('qa_score_high',      'Achieve 90+ on a QA check',           'Polish your book to perfection',         'qa_score_90',            30, 'hard')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Per-user daily challenge assignments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_daily_challenges (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id   TEXT    NOT NULL REFERENCES daily_challenge_pool(id),
  challenge_date DATE    NOT NULL DEFAULT CURRENT_DATE,
  completed      BOOLEAN DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  xp_awarded     INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, challenge_id, challenge_date)
);

ALTER TABLE user_daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own daily challenges"
  ON user_daily_challenges FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_daily_challenges_date
  ON user_daily_challenges(user_id, challenge_date DESC);

-- ── 8. Leaderboard view (replaces hardcoded leaderboard data) ─────────────────
CREATE OR REPLACE VIEW leaderboard_top100 AS
SELECT
  ug.user_id,
  COALESCE(p.display_name, p.full_name, 'Anonymous Author') AS display_name,
  p.avatar_url,
  ug.level,
  ug.level_title,
  ug.current_xp,
  ug.total_xp                                               AS current_xp_total,
  ug.books_created_count,
  CAST(RANK() OVER (ORDER BY ug.total_xp DESC) AS INTEGER)  AS rank
FROM user_gamification ug
JOIN public.profiles p ON p.id = ug.user_id
ORDER BY ug.total_xp DESC
LIMIT 100;

-- ── 9. award_xp() — atomic XP grant, level recalc, streak update ──────────────
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id     UUID,
  p_action_name TEXT,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS TABLE (
  xp_awarded    INT,
  total_xp      INT,
  current_xp    INT,
  new_level     INT,
  new_title     TEXT,
  next_level_xp INT,
  leveled_up    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_xp_value     INT;
  v_total_xp     INT;
  v_current_level INT;
  v_new_level    INT;
  v_new_title    TEXT;
  v_thresh_xp    INT;
  v_next_xp      INT;
  v_current_xp   INT;
  v_leveled_up   BOOLEAN;
BEGIN
  -- Resolve XP value (fall back to 5 for unknown actions)
  SELECT xp_value INTO v_xp_value
  FROM xp_action_values WHERE action_name = p_action_name;
  IF v_xp_value IS NULL THEN v_xp_value := 5; END IF;

  -- Log immutable XP event
  INSERT INTO xp_events (user_id, action_name, xp_awarded, metadata)
  VALUES (p_user_id, p_action_name, v_xp_value, p_metadata);

  -- Ensure user row exists
  INSERT INTO user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Current level before adding XP
  SELECT level INTO v_current_level FROM user_gamification WHERE user_id = p_user_id;

  -- Increment action-specific counter
  UPDATE user_gamification SET
    total_xp                      = total_xp + v_xp_value,
    books_created_count           = books_created_count           + CASE WHEN p_action_name = 'book_created'           THEN 1 ELSE 0 END,
    pages_edited_count            = pages_edited_count            + CASE WHEN p_action_name = 'page_edited'            THEN 1 ELSE 0 END,
    illustrations_generated_count = illustrations_generated_count + CASE WHEN p_action_name = 'illustration_generated' THEN 1 ELSE 0 END,
    brand_content_created_count   = brand_content_created_count   + CASE WHEN p_action_name = 'brand_content_created'  THEN 1 ELSE 0 END,
    updated_at                    = NOW()
  WHERE user_id = p_user_id
  RETURNING total_xp INTO v_total_xp;

  -- Recalculate level from cumulative XP
  SELECT level, title, xp_required
  INTO v_new_level, v_new_title, v_thresh_xp
  FROM level_definitions
  WHERE xp_required <= v_total_xp
  ORDER BY xp_required DESC
  LIMIT 1;

  IF v_new_level IS NULL THEN
    v_new_level  := 1;
    v_new_title  := 'Aspiring Author';
    v_thresh_xp  := 0;
  END IF;

  -- Next level XP threshold
  SELECT xp_required INTO v_next_xp
  FROM level_definitions
  WHERE level = v_new_level + 1;
  IF v_next_xp IS NULL THEN v_next_xp := v_thresh_xp + 2000; END IF;

  -- XP since last level threshold
  v_current_xp := v_total_xp - v_thresh_xp;
  v_leveled_up := v_new_level > v_current_level;

  -- Update computed fields
  UPDATE user_gamification SET
    level        = v_new_level,
    level_title  = v_new_title,
    current_xp   = v_current_xp
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT
    v_xp_value,
    v_total_xp,
    v_current_xp,
    v_new_level,
    v_new_title,
    v_next_xp,
    v_leveled_up;
END;
$$;

-- ── 10. update_streak() — must be called once per day per user ────────────────
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS TABLE (current_streak INT, streak_increased BOOLEAN, streak_broken BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_date DATE;
  v_streak    INT;
  v_today     DATE := CURRENT_DATE;
BEGIN
  SELECT last_activity_date, current_streak
  INTO v_last_date, v_streak
  FROM user_gamification WHERE user_id = p_user_id;

  IF v_last_date = v_today THEN
    -- Already counted today
    RETURN QUERY SELECT v_streak, FALSE, FALSE;
    RETURN;
  END IF;

  IF v_last_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day: increment
    v_streak := v_streak + 1;
    UPDATE user_gamification SET
      current_streak     = v_streak,
      best_streak        = GREATEST(best_streak, v_streak),
      last_activity_date = v_today,
      updated_at         = NOW()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT v_streak, TRUE, FALSE;
  ELSE
    -- Streak broken (or first ever activity)
    DECLARE v_broken BOOLEAN := v_streak > 0;
    BEGIN
      UPDATE user_gamification SET
        current_streak     = 1,
        last_activity_date = v_today,
        updated_at         = NOW()
      WHERE user_id = p_user_id;
      RETURN QUERY SELECT 1, TRUE, v_broken;
    END;
  END IF;
END;
$$;

-- ── 11. assign_daily_challenges() — called once/day per user ─────────────────
CREATE OR REPLACE FUNCTION public.assign_daily_challenges(p_user_id UUID)
RETURNS SETOF user_daily_challenges
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today         DATE := CURRENT_DATE;
  v_books_created INT;
  v_streak        INT;
  v_challenge_ids TEXT[];
BEGIN
  -- If already assigned today, return existing
  IF EXISTS (
    SELECT 1 FROM user_daily_challenges
    WHERE user_id = p_user_id AND challenge_date = v_today
  ) THEN
    RETURN QUERY
      SELECT * FROM user_daily_challenges
      WHERE user_id = p_user_id AND challenge_date = v_today;
    RETURN;
  END IF;

  -- Read user context
  SELECT books_created_count, current_streak
  INTO v_books_created, v_streak
  FROM user_gamification WHERE user_id = p_user_id;

  -- Challenge 1: creation (first-book vs returning user)
  IF v_books_created = 0 THEN
    v_challenge_ids := ARRAY['create_first_book'];
  ELSE
    v_challenge_ids := ARRAY['create_book_today'];
  END IF;

  -- Challenge 2: skill variety
  v_challenge_ids := v_challenge_ids || ARRAY['edit_pages'];

  -- Challenge 3: streak-based
  IF v_streak >= 7 THEN
    v_challenge_ids := v_challenge_ids || ARRAY['maintain_streak_7'];
  ELSIF v_streak >= 3 THEN
    v_challenge_ids := v_challenge_ids || ARRAY['maintain_streak_3'];
  ELSE
    v_challenge_ids := v_challenge_ids || ARRAY['start_streak'];
  END IF;

  -- Insert assignments
  INSERT INTO user_daily_challenges (user_id, challenge_id, challenge_date)
  SELECT p_user_id, unnest(v_challenge_ids), v_today
  ON CONFLICT (user_id, challenge_id, challenge_date) DO NOTHING;

  RETURN QUERY
    SELECT * FROM user_daily_challenges
    WHERE user_id = p_user_id AND challenge_date = v_today;
END;
$$;

-- ── 12. Migrate existing gamification_data JSONB → user_gamification rows ─────
INSERT INTO user_gamification (
  user_id,
  current_xp,
  total_xp,
  level,
  level_title,
  books_created_count,
  current_streak
)
SELECT
  id                                                                AS user_id,
  COALESCE((gamification_data->>'currentXP')::INTEGER, 0)         AS current_xp,
  COALESCE((gamification_data->>'currentXP')::INTEGER, 0)         AS total_xp,
  COALESCE((gamification_data->>'level')::INTEGER, 1)             AS level,
  COALESCE(gamification_data->>'levelTitle', 'Aspiring Author')   AS level_title,
  COALESCE((gamification_data->>'booksCreatedCount')::INTEGER, 0) AS books_created_count,
  COALESCE((gamification_data->>'currentStreak')::INTEGER, 0)     AS current_streak
FROM public.profiles
WHERE gamification_data IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
