-- Query to get the Global Visual Studio room ID
SELECT id, name, description, is_public, created_at
FROM public.chat_rooms
WHERE name = 'Global Visual Studio';

-- Alternative: Get all rooms
-- SELECT id, name, description, is_public, created_at
-- FROM public.chat_rooms
-- ORDER BY created_at DESC;
