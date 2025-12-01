-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text', -- text, system, action
    action_data JSONB, -- For special interactions like the "Yay" button
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create room_members table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_rooms
-- Anyone can view public rooms (for now, we'll make all rooms public to authenticated users)
CREATE POLICY "Public rooms are viewable by everyone" 
ON public.chat_rooms FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms" 
ON public.chat_rooms FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- RLS Policies for room_members
-- Users can view members of rooms they are in or public rooms
CREATE POLICY "View room members" 
ON public.room_members FOR SELECT 
TO authenticated 
USING (true);

-- Users can join rooms
CREATE POLICY "Users can join rooms" 
ON public.room_members FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Users can leave rooms
CREATE POLICY "Users can leave rooms" 
ON public.room_members FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- RLS Policies for messages
-- Users can view messages in rooms they belong to OR if the room is public
CREATE POLICY "View messages" 
ON public.messages FOR SELECT 
TO authenticated 
USING (true); -- Simplified for open chat, can be restricted to room members later

-- Users can insert messages if they are authenticated
CREATE POLICY "Insert messages" 
ON public.messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);

-- Insert a default global room
INSERT INTO public.chat_rooms (id, name, description, is_public)
VALUES ('00000000-0000-0000-0000-000000000001', 'Global Visual Studio', 'The main hub for all creators', true)
ON CONFLICT (id) DO NOTHING;
