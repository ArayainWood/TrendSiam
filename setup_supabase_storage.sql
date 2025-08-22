-- =============================================
-- Supabase Storage Setup for AI Images
-- =============================================

-- 1. Create ai-images bucket (run this in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ai-images', 'ai-images', true);

-- 2. Set up RLS policies for ai-images bucket
-- Allow public read access
CREATE POLICY "Allow public read access on ai-images" ON storage.objects
FOR SELECT USING (bucket_id = 'ai-images');

-- Allow service role to upload/manage files
CREATE POLICY "Allow service role full access on ai-images" ON storage.objects
FOR ALL USING (bucket_id = 'ai-images');

-- 3. Ensure ai_images table has proper RLS
-- Allow anonymous users to read ai_images
CREATE POLICY "Allow public read on ai_images" ON ai_images
FOR SELECT USING (true);

-- Allow service role to insert/update ai_images
CREATE POLICY "Allow service role write on ai_images" ON ai_images
FOR ALL USING (true);

-- Enable RLS on ai_images table
ALTER TABLE ai_images ENABLE ROW LEVEL SECURITY;
