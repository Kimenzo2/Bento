-- Create storage buckets for images

-- Bucket for generated page images
INSERT INTO storage.buckets (id, name, public)
VALUES ('page-images', 'page-images', true);

-- Bucket for character reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-refs', 'character-refs', true);

-- Bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Storage policies for page-images
CREATE POLICY "Users can upload own page images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'page-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own page images"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'page-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own page images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'page-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own page images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'page-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for character-refs
CREATE POLICY "Users can upload own character refs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'character-refs' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own character refs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'character-refs' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own character refs"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'character-refs' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own character refs"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'character-refs' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
