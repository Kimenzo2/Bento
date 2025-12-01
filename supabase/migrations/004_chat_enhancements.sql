-- Migration 004: Chat Enhancements
-- Adds user profiles, reactions, private rooms, search, and notifications

-- ============================================
-- 1. USER PROFILES ENHANCEMENT
-- ============================================

-- Extend profiles table with chat-specific fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create index for search
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ============================================
-- 2. MESSAGE REACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON public.message_reactions(user_id);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reactions
CREATE POLICY "Users can view reactions" 
ON public.message_reactions FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can add reactions" 
ON public.message_reactions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions" 
ON public.message_reactions FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- ============================================
-- 3. PRIVATE ROOMS & INVITATIONS
-- ============================================

-- Add privacy fields to chat_rooms
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Room invitations table
CREATE TABLE IF NOT EXISTS public.room_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, declined
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(room_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_user ON public.room_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_room ON public.room_invitations(room_id);

-- Enable RLS
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitations
CREATE POLICY "Users can view their invitations" 
ON public.room_invitations FOR SELECT 
TO authenticated 
USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

CREATE POLICY "Room creators can invite" 
ON public.room_invitations FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (
        SELECT 1 FROM public.chat_rooms
        WHERE id = room_id AND created_by = auth.uid()
    )
);

CREATE POLICY "Invited users can respond" 
ON public.room_invitations FOR UPDATE 
TO authenticated 
USING (auth.uid() = invited_user_id);

-- ============================================
-- 4. FULL-TEXT SEARCH
-- ============================================

-- Add search vector column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS messages_search_vector_trigger ON public.messages;
CREATE TRIGGER messages_search_vector_trigger
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();

-- Create GIN index for fast search
CREATE INDEX IF NOT EXISTS idx_messages_search ON public.messages USING GIN(search_vector);

-- Update existing messages with search vectors
UPDATE public.messages SET search_vector = to_tsvector('english', COALESCE(content, ''));

-- ============================================
-- 5. NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'new_message', 'mention', 'reaction', 'invitation'
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.user_notifications(user_id, read, created_at DESC);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications" 
ON public.user_notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" 
ON public.user_notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- ============================================
-- 6. UPDATE EXISTING RLS POLICIES FOR PRIVATE ROOMS
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON public.chat_rooms;
DROP POLICY IF EXISTS "View messages" ON public.messages;
DROP POLICY IF EXISTS "View room members" ON public.room_members;

-- New policies for chat_rooms (public + private)
CREATE POLICY "Users can view public rooms" 
ON public.chat_rooms FOR SELECT 
TO authenticated 
USING (is_public = true OR created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = chat_rooms.id AND user_id = auth.uid()
));

-- New policies for messages (respect room privacy)
CREATE POLICY "Users can view messages in accessible rooms" 
ON public.messages FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.chat_rooms cr
        WHERE cr.id = messages.room_id 
        AND (
            cr.is_public = true 
            OR cr.created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.room_members rm
                WHERE rm.room_id = cr.id AND rm.user_id = auth.uid()
            )
        )
    )
);

-- New policies for room_members
CREATE POLICY "Users can view members of accessible rooms" 
ON public.room_members FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.chat_rooms cr
        WHERE cr.id = room_members.room_id 
        AND (
            cr.is_public = true 
            OR cr.created_by = auth.uid()
            OR user_id = auth.uid()
        )
    )
);
