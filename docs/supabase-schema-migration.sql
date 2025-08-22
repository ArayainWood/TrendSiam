-- =============================================
-- TrendSiam Database Schema Migration
-- =============================================
-- Migration to add missing metadata fields to existing news_trends table
-- Run this if you already have a news_trends table with basic fields
-- =============================================

-- Add missing core fields
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS summary_en TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS popularity_score_precise NUMERIC;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS ai_image_url TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT;

-- Add original metadata fields
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS video_id TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS view_count TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS published_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS like_count TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS comment_count TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add view details metadata fields
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS raw_view TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS growth_rate TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS platform_mentions TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS ai_opinion TEXT;
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS score_details TEXT;

-- Add additional indexes for new fields
CREATE INDEX IF NOT EXISTS idx_news_trends_video_id ON news_trends(video_id);
CREATE INDEX IF NOT EXISTS idx_news_trends_channel ON news_trends(channel);
CREATE INDEX IF NOT EXISTS idx_news_trends_category ON news_trends(category);
CREATE INDEX IF NOT EXISTS idx_news_trends_published_date ON news_trends(published_date DESC);

-- Add unique constraint on video_id to prevent duplicates
ALTER TABLE news_trends ADD CONSTRAINT unique_video_id UNIQUE (video_id);

-- Update the updated_at trigger to work with new schema
DROP TRIGGER IF EXISTS update_news_trends_updated_at ON news_trends;
CREATE TRIGGER update_news_trends_updated_at 
  BEFORE UPDATE ON news_trends 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'news_trends' 
ORDER BY ordinal_position;
