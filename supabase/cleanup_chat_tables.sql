-- STEP 1: Clean up existing tables (if they exist)
-- Run this first to start fresh
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;

-- STEP 2: Now run the full migration
-- After running the above, run the entire 003_group_chat_schema.sql file
