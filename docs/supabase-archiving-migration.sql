-- =============================================
-- TrendSiam Long-term Archiving Migration
-- =============================================
-- This migration adds support for long-term news archiving
-- with daily filtering and proper date-based organization
-- =============================================

-- Step 1: Add summary_date field to news_trends table
-- =============================================
ALTER TABLE news_trends 
ADD COLUMN IF NOT EXISTS summary_date DATE DEFAULT CURRENT_DATE;

-- Step 2: Add index for efficient date-based queries
-- =============================================
CREATE INDEX IF NOT EXISTS idx_news_trends_summary_date ON news_trends(summary_date DESC);

-- Step 3: Update existing records to have summary_date
-- =============================================
-- Set summary_date to created_at date for existing records
UPDATE news_trends 
SET summary_date = DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')
WHERE summary_date IS NULL;

-- Step 4: Add comment for documentation
-- =============================================
COMMENT ON COLUMN news_trends.summary_date IS 'Date when this news item was generated/summarized (Thailand timezone)';

-- Step 5: Create view for today''s trending stories (Thailand timezone)
-- =============================================
CREATE OR REPLACE VIEW todays_trending_stories AS
SELECT 
  *,
  ROW_NUMBER() OVER (ORDER BY popularity_score_precise DESC, popularity_score DESC, created_at DESC) as rank
FROM news_trends
WHERE summary_date = CURRENT_DATE
ORDER BY popularity_score_precise DESC, popularity_score DESC, created_at DESC;

-- Step 6: Create function to get Thailand current date
-- =============================================
CREATE OR REPLACE FUNCTION thailand_current_date()
RETURNS DATE AS $$
BEGIN
    RETURN DATE(NOW() AT TIME ZONE 'Asia/Bangkok');
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create view for today''s stories using Thailand timezone
-- =============================================
CREATE OR REPLACE VIEW thailand_todays_stories AS
SELECT 
  *,
  ROW_NUMBER() OVER (ORDER BY popularity_score_precise DESC, popularity_score DESC, created_at DESC) as rank
FROM news_trends
WHERE summary_date = thailand_current_date()
ORDER BY popularity_score_precise DESC, popularity_score DESC, created_at DESC;

-- Step 8: Create system_config table for storing runtime configuration
-- =============================================
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 9: Add trigger for system_config updated_at
-- =============================================
CREATE TRIGGER update_system_config_updated_at 
  BEFORE UPDATE ON system_config 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Insert default configuration values
-- =============================================
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('news_limit', '20', 'Number of news items to display on homepage (set by --limit parameter)'),
  ('last_summary_date', '', 'Date of the last news summary generation'),
  ('system_version', '1.0.0', 'TrendSiam system version')
ON CONFLICT (config_key) DO NOTHING;

-- Step 11: Create function to get current news limit
-- =============================================
CREATE OR REPLACE FUNCTION get_news_limit()
RETURNS INTEGER AS $$
DECLARE
    limit_value INTEGER;
BEGIN
    SELECT CAST(config_value AS INTEGER) INTO limit_value
    FROM system_config 
    WHERE config_key = 'news_limit';
    
    -- Default to 20 if not found
    RETURN COALESCE(limit_value, 20);
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create function to update news limit
-- =============================================
CREATE OR REPLACE FUNCTION set_news_limit(new_limit INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO system_config (config_key, config_value, description)
    VALUES ('news_limit', new_limit::TEXT, 'Number of news items to display on homepage (set by --limit parameter)')
    ON CONFLICT (config_key) 
    DO UPDATE SET 
        config_value = new_limit::TEXT,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Verification Queries
-- =============================================
-- Run these to verify the migration:

-- Check if summary_date column exists
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'news_trends' AND column_name = 'summary_date';

-- Check summary_date distribution
-- SELECT summary_date, COUNT(*) as count
-- FROM news_trends 
-- GROUP BY summary_date 
-- ORDER BY summary_date DESC;

-- Test Thailand timezone function
-- SELECT thailand_current_date() as thailand_date, CURRENT_DATE as utc_date;

-- Test today's stories view
-- SELECT id, title, summary_date, rank FROM thailand_todays_stories LIMIT 5;

-- Count stories by date
-- SELECT summary_date, COUNT(*) as stories_count
-- FROM news_trends 
-- GROUP BY summary_date 
-- ORDER BY summary_date DESC 
-- LIMIT 10;

-- =============================================
-- Usage Examples
-- =============================================

-- Get today's trending stories (Thailand timezone)
-- SELECT * FROM thailand_todays_stories ORDER BY rank LIMIT 20;

-- Get stories for a specific date
-- SELECT * FROM news_trends WHERE summary_date = '2024-01-15' ORDER BY popularity_score_precise DESC;

-- Archive old stories (example: delete stories older than 30 days)
-- DELETE FROM news_trends WHERE summary_date < CURRENT_DATE - INTERVAL '30 days';

-- Get date range analytics
-- SELECT 
--   summary_date,
--   COUNT(*) as total_stories,
--   AVG(popularity_score_precise) as avg_score,
--   MAX(popularity_score_precise) as max_score
-- FROM news_trends 
-- WHERE summary_date >= CURRENT_DATE - INTERVAL '7 days'
-- GROUP BY summary_date 
-- ORDER BY summary_date DESC;
