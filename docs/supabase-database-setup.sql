-- =============================================
-- TrendSiam Supabase Database Setup
-- =============================================
-- This file contains all the SQL commands needed to set up
-- the TrendSiam database schema in Supabase
-- =============================================

-- Step 1: Create the news_trends table
-- =============================================
CREATE TABLE IF NOT EXISTS news_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  summary_en TEXT,
  platform TEXT,
  popularity_score NUMERIC,
  popularity_score_precise NUMERIC,
  date DATE DEFAULT CURRENT_DATE,
  category TEXT,
  ai_image_url TEXT,
  ai_image_prompt TEXT,
  
  -- Original metadata fields
  video_id TEXT,
  channel TEXT,
  view_count TEXT,
  published_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  duration TEXT,
  like_count TEXT,
  comment_count TEXT,
  reason TEXT,
  
  -- View details metadata
  raw_view TEXT,
  growth_rate TEXT,
  platform_mentions TEXT,
  keywords TEXT,
  ai_opinion TEXT,
  score_details TEXT,
  
  -- System fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes for better performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_news_trends_created_at ON news_trends(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_trends_popularity_score ON news_trends(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_trends_platform ON news_trends(platform);
CREATE INDEX IF NOT EXISTS idx_news_trends_date ON news_trends(date DESC);

-- Step 3: Enable Row Level Security (RLS)
-- =============================================
ALTER TABLE news_trends ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
-- =============================================

-- Policy 1: Public read access for all users
-- This allows anyone to read news trends (safe for public data)
CREATE POLICY "Public read access" ON news_trends
  FOR SELECT
  USING (true);

-- Policy 2: Insert policy (if you want to allow public submissions)
-- Uncomment this if you want to allow users to submit news trends
-- CREATE POLICY "Public insert access" ON news_trends
--   FOR INSERT
--   WITH CHECK (true);

-- Policy 3: Admin-only update policy (requires authentication)
-- Only authenticated users can update records
-- CREATE POLICY "Admin update access" ON news_trends
--   FOR UPDATE
--   USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');

-- Policy 4: Admin-only delete policy (requires authentication)
-- Only authenticated users can delete records
-- CREATE POLICY "Admin delete access" ON news_trends
--   FOR DELETE
--   USING (auth.role() = 'authenticated');

-- Step 5: Create an updated_at trigger function
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 6: Create the trigger
-- =============================================
CREATE TRIGGER update_news_trends_updated_at 
  BEFORE UPDATE ON news_trends 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Insert sample data (optional)
-- =============================================
-- Uncomment and run this to insert some sample data for testing

/*
INSERT INTO news_trends (title, summary, platform, popularity_score, date) VALUES
  (
    'Breaking: Thai Tech Startup Raises $50M in Series B Funding',
    'A Bangkok-based fintech company secured major funding to expand across Southeast Asia.',
    'TechCrunch Thailand',
    85.5,
    CURRENT_DATE
  ),
  (
    'Thailand Tourism Recovery: Record Visitors Expected This Year',
    'Tourism Authority of Thailand announces optimistic projections for international arrivals.',
    'Bangkok Post',
    78.2,
    CURRENT_DATE - INTERVAL '1 day'
  ),
  (
    'New EV Manufacturing Plant Opens in Eastern Economic Corridor',
    'International automaker invests $2B in Thailand electric vehicle production facility.',
    'The Nation',
    92.1,
    CURRENT_DATE - INTERVAL '2 days'
  ),
  (
    'Thai Cuisine Wins UNESCO Creative City of Gastronomy Recognition',
    'Phuket receives prestigious international recognition for culinary excellence.',
    'Thai PBS',
    68.9,
    CURRENT_DATE - INTERVAL '3 days'
  ),
  (
    'Digital Wallet Adoption Surges 300% in Thailand',
    'Central bank reports massive growth in digital payment usage across all demographics.',
    'Reuters Thailand',
    81.7,
    CURRENT_DATE - INTERVAL '4 days'
  );
*/

-- Step 8: Create a view for trending stories (optional)
-- =============================================
CREATE OR REPLACE VIEW trending_stories AS
SELECT 
  id,
  title,
  summary,
  platform,
  popularity_score,
  date,
  created_at,
  ROW_NUMBER() OVER (ORDER BY popularity_score DESC, created_at DESC) as rank
FROM news_trends
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY popularity_score DESC, created_at DESC;

-- Step 9: Grant permissions (if using service role)
-- =============================================
-- If you're using a service role for backend operations, grant necessary permissions
-- GRANT ALL ON news_trends TO service_role;
-- GRANT SELECT ON trending_stories TO anon, authenticated;

-- =============================================
-- Verification Queries
-- =============================================
-- Run these queries to verify your setup:

-- Check if table exists and has correct structure
-- SELECT * FROM information_schema.tables WHERE table_name = 'news_trends';

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'news_trends';

-- Check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'news_trends';

-- Test the view
-- SELECT * FROM trending_stories LIMIT 5;

-- Count total records
-- SELECT COUNT(*) as total_records FROM news_trends;

-- =============================================
-- Security Notes
-- =============================================
/*
1. ANON KEY SAFETY: The anon key is safe for frontend use ONLY with proper RLS policies
2. SERVICE ROLE: Never expose service_role key to frontend - use only in backend services  
3. RLS POLICIES: Always test your policies thoroughly before going to production
4. DATA VALIDATION: Implement proper validation in your application layer
5. RATE LIMITING: Consider implementing rate limiting for public endpoints
*/

