-- =============================================
-- TrendSiam Two-Layer Database Schema
-- =============================================
-- This schema implements a two-layer model for idempotency without losing history:
-- 1. stories: Canonical items keyed by story_id (stable hash)
-- 2. snapshots: Per run/day views keyed by (snapshot_date, story_id)
-- =============================================

-- Step 1: Create stories table (canonical data)
-- =============================================
CREATE TABLE IF NOT EXISTS stories (
  story_id VARCHAR(64) PRIMARY KEY, -- stable hash of source_id/platform + publish_time
  source_id TEXT NOT NULL, -- original video_id/platform identifier
  platform TEXT NOT NULL,
  publish_time TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  channel TEXT,
  category TEXT,
  
  -- Content fields (updated when content changes)
  summary TEXT,
  summary_en TEXT,
  ai_image_prompt TEXT,
  
  -- Static metadata
  duration TEXT,
  
  -- System fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create snapshots table (per-run data)
-- =============================================
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id VARCHAR(64) NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  run_id UUID, -- optional run identifier for same-day runs
  
  -- Current snapshot data (changes per run)
  rank INTEGER, -- position in this snapshot (1, 2, 3, etc.)
  view_count TEXT,
  like_count TEXT,
  comment_count TEXT,
  popularity_score NUMERIC,
  popularity_score_precise NUMERIC,
  
  -- Image data (linked to story but tracked per snapshot)
  image_url TEXT,
  image_status VARCHAR(20) DEFAULT 'pending', -- 'ready', 'pending', 'failed'
  image_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Snapshot-specific metadata
  reason TEXT,
  raw_view TEXT,
  growth_rate TEXT,
  platform_mentions TEXT,
  keywords TEXT,
  ai_opinion TEXT,
  score_details TEXT,
  
  -- System fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one snapshot per story per day (unless using run_id for multiple daily runs)
  UNIQUE(story_id, snapshot_date, run_id)
);

-- Step 3: Create image_files table (track actual image files)
-- =============================================
CREATE TABLE IF NOT EXISTS image_files (
  story_id VARCHAR(64) PRIMARY KEY REFERENCES stories(story_id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  is_valid BOOLEAN DEFAULT true,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes for performance
-- =============================================
-- Stories indexes
CREATE INDEX IF NOT EXISTS idx_stories_platform ON stories(platform);
CREATE INDEX IF NOT EXISTS idx_stories_publish_time ON stories(publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_updated_at ON stories(updated_at DESC);

-- Snapshots indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_story_date ON snapshots(story_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_date_rank ON snapshots(snapshot_date DESC, rank ASC);
CREATE INDEX IF NOT EXISTS idx_snapshots_popularity ON snapshots(popularity_score_precise DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_snapshots_image_status ON snapshots(image_status);

-- Image files indexes
CREATE INDEX IF NOT EXISTS idx_image_files_generated_at ON image_files(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_files_valid ON image_files(is_valid);

-- Step 5: Create functions for story_id generation
-- =============================================
CREATE OR REPLACE FUNCTION generate_story_id(
  source_id TEXT,
  platform TEXT,
  publish_time TIMESTAMP WITH TIME ZONE
) RETURNS VARCHAR(64) AS $$
BEGIN
  -- Generate stable hash using source_id + platform + publish_time
  RETURN ENCODE(
    DIGEST(
      CONCAT(
        COALESCE(source_id, ''),
        '|',
        COALESCE(platform, ''),
        '|',
        EXTRACT(EPOCH FROM publish_time)::TEXT
      ),
      'sha256'
    ),
    'hex'
  )::VARCHAR(64);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger functions
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 7: Create triggers
-- =============================================
CREATE TRIGGER update_stories_updated_at 
  BEFORE UPDATE ON stories 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_snapshots_updated_at 
  BEFORE UPDATE ON snapshots 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Enable Row Level Security
-- =============================================
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_files ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS Policies (public read access)
-- =============================================
CREATE POLICY "Public read access" ON stories
  FOR SELECT
  USING (true);

CREATE POLICY "Public read access" ON snapshots
  FOR SELECT
  USING (true);

CREATE POLICY "Public read access" ON image_files
  FOR SELECT
  USING (true);

-- Step 10: Create views for easy querying
-- =============================================
-- View for current trending stories (today's snapshot)
CREATE OR REPLACE VIEW current_trending AS
SELECT 
  s.story_id,
  st.title,
  st.summary,
  st.summary_en,
  st.platform,
  st.channel,
  st.category,
  st.description,
  s.rank,
  s.popularity_score_precise,
  s.view_count,
  s.like_count,
  s.comment_count,
  s.image_url,
  s.image_status,
  s.image_updated_at,
  s.snapshot_date,
  s.created_at,
  -- Generate data_version for cache busting
  EXTRACT(EPOCH FROM MAX(s.updated_at) OVER ())::TEXT as data_version
FROM snapshots s
JOIN stories st ON s.story_id = st.story_id
WHERE s.snapshot_date = CURRENT_DATE
ORDER BY s.rank ASC, s.popularity_score_precise DESC NULLS LAST;

-- View for historical trending data
CREATE OR REPLACE VIEW historical_trending AS
SELECT 
  s.story_id,
  st.title,
  st.summary,
  st.summary_en,
  st.platform,
  st.channel,
  st.category,
  s.rank,
  s.popularity_score_precise,
  s.view_count,
  s.snapshot_date,
  s.image_url,
  s.image_status,
  s.created_at
FROM snapshots s
JOIN stories st ON s.story_id = st.story_id
WHERE s.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY s.snapshot_date DESC, s.rank ASC;

-- View for top 3 stories with image status
CREATE OR REPLACE VIEW top3_stories AS
SELECT 
  s.story_id,
  st.title,
  st.summary,
  st.summary_en,
  st.platform,
  st.channel,
  st.category,
  st.ai_image_prompt,
  s.rank,
  s.popularity_score_precise,
  s.image_url,
  s.image_status,
  s.image_updated_at,
  if.file_path as local_image_path,
  if.is_valid as image_file_valid,
  s.snapshot_date
FROM snapshots s
JOIN stories st ON s.story_id = st.story_id
LEFT JOIN image_files if ON s.story_id = if.story_id
WHERE s.snapshot_date = CURRENT_DATE
  AND s.rank <= 3
ORDER BY s.rank ASC;

-- =============================================
-- Migration from existing news_trends table
-- =============================================
-- This function helps migrate existing data to the new schema
CREATE OR REPLACE FUNCTION migrate_from_news_trends() RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER := 0;
  rec RECORD;
  new_story_id VARCHAR(64);
BEGIN
  -- Migrate existing news_trends data to stories/snapshots
  FOR rec IN 
    SELECT *
    FROM news_trends 
    WHERE video_id IS NOT NULL 
      AND title IS NOT NULL
    ORDER BY created_at DESC
  LOOP
    -- Generate story_id
    new_story_id := generate_story_id(
      rec.video_id,
      COALESCE(rec.platform, rec.channel, 'Unknown'),
      COALESCE(rec.published_date, rec.created_at)
    );
    
    -- Insert into stories (ignore duplicates)
    INSERT INTO stories (
      story_id, source_id, platform, publish_time,
      title, description, channel, category,
      summary, summary_en, ai_image_prompt
    ) VALUES (
      new_story_id,
      rec.video_id,
      COALESCE(rec.platform, rec.channel, 'Unknown'),
      COALESCE(rec.published_date, rec.created_at),
      rec.title,
      rec.description,
      rec.channel,
      rec.category,
      rec.summary,
      rec.summary_en,
      rec.ai_image_prompt
    ) ON CONFLICT (story_id) DO NOTHING;
    
    -- Insert into snapshots
    INSERT INTO snapshots (
      story_id, snapshot_date,
      view_count, like_count, comment_count,
      popularity_score, popularity_score_precise,
      image_url, image_status,
      reason, raw_view, growth_rate, platform_mentions,
      keywords, ai_opinion, score_details
    ) VALUES (
      new_story_id,
      COALESCE(rec.date, rec.created_at::DATE),
      rec.view_count,
      rec.like_count,
      rec.comment_count,
      rec.popularity_score,
      rec.popularity_score_precise,
      rec.ai_image_url,
      CASE 
        WHEN rec.ai_image_url IS NOT NULL THEN 'ready'
        ELSE 'pending'
      END,
      rec.reason,
      rec.raw_view,
      rec.growth_rate,
      rec.platform_mentions,
      rec.keywords,
      rec.ai_opinion,
      rec.score_details
    ) ON CONFLICT (story_id, snapshot_date, run_id) DO UPDATE SET
      view_count = EXCLUDED.view_count,
      popularity_score_precise = EXCLUDED.popularity_score_precise,
      image_url = EXCLUDED.image_url,
      updated_at = NOW();
    
    migrated_count := migrated_count + 1;
  END LOOP;
  
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Verification Queries
-- =============================================
/*
-- Check schema is created correctly
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('stories', 'snapshots', 'image_files')
ORDER BY table_name, ordinal_position;

-- Test story_id generation
SELECT generate_story_id('test_video_123', 'YouTube', NOW());

-- Check views
SELECT * FROM current_trending LIMIT 5;
SELECT * FROM top3_stories;

-- Count records after migration
SELECT 
  (SELECT COUNT(*) FROM stories) as stories_count,
  (SELECT COUNT(*) FROM snapshots) as snapshots_count,
  (SELECT COUNT(*) FROM image_files) as image_files_count;
*/
