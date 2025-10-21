-- =============================================
-- SECTION B — Database Contract Migration
-- TrendSiam Schema Compliance Update
-- =============================================
-- This migration updates the existing schema to match the specification
-- All changes are additive - no data will be lost
-- =============================================

-- 1. Update news_trends table to match specification
-- =============================================

-- First, add missing columns if they don't exist
ALTER TABLE news_trends 
ADD COLUMN IF NOT EXISTS platform text CHECK (platform IN ('youtube','x','news','instagram')),
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS published_at timestamptz,
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS extra jsonb DEFAULT '{}'::jsonb;

-- Update existing columns to ensure proper constraints
ALTER TABLE news_trends 
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN summary SET NOT NULL,
ALTER COLUMN category SET NOT NULL,
ALTER COLUMN popularity_score TYPE numeric(6,3), -- SECTION G: Ensure decimal with 3dp precision
ALTER COLUMN popularity_score SET DEFAULT 0,
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

-- Create unique constraint on platform + external_id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'news_trends_platform_external_id_key'
    ) THEN
        -- Populate external_id from video_id for existing records
        UPDATE news_trends 
        SET external_id = video_id, 
            platform = COALESCE(platform, 'youtube')
        WHERE external_id IS NULL AND video_id IS NOT NULL;
        
        -- Add unique constraint
        ALTER TABLE news_trends 
        ADD CONSTRAINT news_trends_platform_external_id_key 
        UNIQUE (platform, external_id);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_trends_published_at_desc ON news_trends(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_trends_popularity_published ON news_trends(popularity_score DESC, published_at DESC);

-- 2. Create ai_images table (if not exists)
-- =============================================
CREATE TABLE IF NOT EXISTS ai_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id uuid NOT NULL REFERENCES news_trends(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    prompt text,
    model text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(news_id) -- 1 image per story
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_ai_images_news_id ON ai_images(news_id);

-- 3. Create system_meta table for cache-busting
-- =============================================
CREATE TABLE IF NOT EXISTS system_meta (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to system_meta
DROP TRIGGER IF EXISTS update_system_meta_updated_at ON system_meta;
CREATE TRIGGER update_system_meta_updated_at 
    BEFORE UPDATE ON system_meta 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Create stats table (optional aggregates)
-- =============================================
CREATE TABLE IF NOT EXISTS stats (
    name text PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apply trigger to stats
DROP TRIGGER IF EXISTS update_stats_updated_at ON stats;
CREATE TRIGGER update_stats_updated_at 
    BEFORE UPDATE ON stats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to news_trends (SECTION G)
DROP TRIGGER IF EXISTS update_news_trends_updated_at ON news_trends;
CREATE TRIGGER update_news_trends_updated_at 
    BEFORE UPDATE ON news_trends 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Set up RLS Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE news_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

-- Read policies for anon users (public read)
DROP POLICY IF EXISTS "Allow anon read news_trends" ON news_trends;
CREATE POLICY "Allow anon read news_trends" ON news_trends 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon read ai_images" ON ai_images;
CREATE POLICY "Allow anon read ai_images" ON ai_images 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon read system_meta" ON system_meta;
CREATE POLICY "Allow anon read system_meta" ON system_meta 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon read stats" ON stats;
CREATE POLICY "Allow anon read stats" ON stats 
FOR SELECT USING (true);

-- Write policies - only service role can insert/update
-- (No explicit policy needed - service role bypasses RLS)

-- 6. Initialize system_meta with current timestamp
-- =============================================
INSERT INTO system_meta (key, value) 
VALUES ('news_last_updated', now()::text)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();

-- 7. Verification Query
-- =============================================
SELECT 
    'Schema migration completed' as status,
    (SELECT count(*) FROM news_trends) as news_count,
    (SELECT count(*) FROM ai_images) as images_count,
    (SELECT count(*) FROM system_meta) as meta_count,
    (SELECT count(*) FROM stats) as stats_count;

-- End of migration
-- =============================================
