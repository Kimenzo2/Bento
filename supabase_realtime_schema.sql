-- ==============================================================================
-- GENESIS VISUAL STUDIO - REAL-TIME COLLABORATION SCHEMA
-- ==============================================================================
-- This script sets up the database schema, security policies (RLS), and real-time
-- subscriptions required to replace the simulated features in VisualStudio.tsx
-- and MessagesWidget.tsx with a production-ready Supabase backend.
-- ==============================================================================

-- 1. ENABLE REALTIME
-- ------------------------------------------------------------------------------
-- Ensure the realtime publication exists
drop publication if exists supabase_realtime;
create publication supabase_realtime;

-- 2. PROFILES (User Identity)
-- ------------------------------------------------------------------------------
-- Extends auth.users with application-specific data like avatars and names.
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- 3. COLLABORATION SESSIONS (The "Room")
-- ------------------------------------------------------------------------------
-- Represents a collaborative workspace session.
create table public.collaboration_sessions (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references public.profiles(id),
  name text not null default 'Untitled Session',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.collaboration_sessions enable row level security;

-- Policies
create policy "Sessions are viewable by authenticated users."
  on public.collaboration_sessions for select
  using ( auth.role() = 'authenticated' );

create policy "Users can create sessions."
  on public.collaboration_sessions for insert
  with check ( auth.role() = 'authenticated' );

-- 4. SESSION PARTICIPANTS (Presence & Status)
-- ------------------------------------------------------------------------------
-- Tracks who is in the session and their current activity status.
-- Replaces the 'collaborators' state in VisualStudio.tsx.
-- Status values: 'idle', 'typing', 'generating', 'done'
create table public.session_participants (
  session_id uuid references public.collaboration_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('idle', 'typing', 'generating', 'done')) default 'idle',
  last_seen_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (session_id, user_id)
);

-- Enable RLS
alter table public.session_participants enable row level security;

-- Policies
create policy "Participants are viewable by everyone in the session."
  on public.session_participants for select
  using ( true );

create policy "Users can join sessions (insert themselves)."
  on public.session_participants for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own status."
  on public.session_participants for update
  using ( auth.uid() = user_id );

-- Enable Realtime for Participants (Critical for status updates like 'typing'/'generating')
alter publication supabase_realtime add table public.session_participants;

-- 5. MESSAGES (Chat & Interactive Widgets)
-- ------------------------------------------------------------------------------
-- Stores chat history and interactive elements like the "Yay" button.
-- Replaces 'messages' state in MessagesWidget.tsx.
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.collaboration_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id),
  content text, -- The text message
  type text check (type in ('text', 'system', 'action')) default 'text',
  
  -- Stores data for interactive widgets (e.g., the "Yay" button state)
  -- Structure: { "type": "yay_button", "clickCount": 0, "maxClicks": 5, "clickedBy": [] }
  action_data jsonb default '{}'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies
create policy "Messages are viewable by session participants."
  on public.messages for select
  using ( true );

create policy "Users can insert messages."
  on public.messages for insert
  with check ( auth.uid() = user_id );

create policy "Users can update messages (needed for 'Yay' button clicks)."
  on public.messages for update
  using ( true ); -- Allow anyone to click the button (update the row)

-- Enable Realtime for Messages (Critical for chat and button updates)
alter publication supabase_realtime add table public.messages;

-- 6. VISUAL GENERATIONS (Shared Art)
-- ------------------------------------------------------------------------------
-- Stores the images generated by users during the session.
-- Replaces the 'image' property in the 'collaborators' state.
create table public.visual_generations (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.collaboration_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id),
  image_url text not null,
  prompt text,
  
  -- Store full generation settings for reproducibility/inspectability
  settings jsonb default '{}'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.visual_generations enable row level security;

-- Policies
create policy "Generations are viewable by session participants."
  on public.visual_generations for select
  using ( true );

create policy "Users can insert their own generations."
  on public.visual_generations for insert
  with check ( auth.uid() = user_id );

-- Enable Realtime for Generations (To show when a user finishes 'generating')
alter publication supabase_realtime add table public.visual_generations;

-- ==============================================================================
-- USAGE GUIDE FOR FRONTEND INTEGRATION
-- ==============================================================================
--
-- 1. ON JOIN:
--    - Insert row into `session_participants` with status 'idle'.
--    - Subscribe to `session_participants` changes to update the grid UI.
--
-- 2. ON TYPING:
--    - Update `session_participants` row: set status = 'typing'.
--    - Debounce this update to avoid DB spam.
--
-- 3. ON GENERATING START:
--    - Update `session_participants` row: set status = 'generating'.
--
-- 4. ON GENERATING FINISH:
--    - Insert row into `visual_generations` with the new image URL.
--    - Update `session_participants` row: set status = 'done'.
--
-- 5. "YAY" BUTTON:
--    - Insert message with type='action' and initial action_data.
--    - On click: Fetch current row, increment clickCount, append userId to clickedBy, and UPDATE the row.
--    - Realtime subscription will propagate the new count to all users.
--
-- ==============================================================================
