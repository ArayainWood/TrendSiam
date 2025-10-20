-- Create optional demo seed table for QA testing
-- This table is ONLY used when real data sources are empty

-- Create the demo seed table
CREATE TABLE IF NOT EXISTS public.home_demo_seed (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text,
  summary_en text,
  category text,
  platform text,
  channel text,
  published_at timestamptz,
  source_url text,
  image_url text,
  ai_prompt text,
  popularity_score numeric,
  rank integer,
  is_top3 boolean,
  views bigint,
  likes bigint,
  comments bigint,
  growth_rate_value numeric,
  growth_rate_label text,
  ai_opinion text,
  score_details jsonb,
  video_id text,
  external_id text,
  platform_mentions integer,
  keywords text,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo data (3 rows for testing)
INSERT INTO public.home_demo_seed (
  id, title, summary, summary_en, category, platform, channel,
  published_at, source_url, image_url, ai_prompt, popularity_score,
  rank, is_top3, views, likes, comments, growth_rate_value,
  growth_rate_label, ai_opinion, score_details, video_id, external_id,
  platform_mentions, keywords, updated_at
) VALUES 
(
  'demo-001',
  'DEMO: แมวน้อยน่ารักเล่นกับลูกบอล',
  'วิดีโอสาธิตแสดงแมวน้อยน่ารักกำลังเล่นกับลูกบอลสีสันสดใส',
  'Demo video showing cute kitten playing with colorful ball',
  'Entertainment',
  'YouTube',
  'Demo Channel',
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  'https://www.youtube.com/watch?v=demo001',
  'https://via.placeholder.com/1280x720/FF6B6B/FFFFFF?text=Demo+Top+1',
  'A playful kitten with soft fur playing with a colorful ball in a sunny room',
  95.5,
  1,
  true,
  15000,
  1200,
  85,
  0.25,
  'Rising fast',
  'This heartwarming content showcases the playful nature of kittens',
  '{"engagement": "high", "sentiment": "positive", "trending": true}'::jsonb,
  'demo001',
  'demo001',
  3,
  'kitten,cat,pet,cute,playing',
  CURRENT_TIMESTAMP
),
(
  'demo-002',
  'DEMO: สอนทำอาหารไทยง่ายๆ - ผัดกะเพรา',
  'วิธีทำผัดกะเพราหมูสับแบบง่ายๆ ใช้เวลาไม่เกิน 15 นาที',
  'Easy Thai cooking tutorial - Pad Krapow in under 15 minutes',
  'Food',
  'YouTube',
  'Thai Cooking Demo',
  CURRENT_TIMESTAMP - INTERVAL '4 hours',
  'https://www.youtube.com/watch?v=demo002',
  'https://via.placeholder.com/1280x720/4ECDC4/FFFFFF?text=Demo+Top+2',
  'Delicious Thai basil stir-fry with minced pork, holy basil leaves, and steaming rice',
  88.2,
  2,
  true,
  8500,
  650,
  42,
  0.15,
  'Rising',
  'A perfect example of quick and delicious Thai street food',
  '{"engagement": "medium", "sentiment": "positive", "trending": true}'::jsonb,
  'demo002',
  'demo002',
  2,
  'cooking,thai food,pad krapow,recipe',
  CURRENT_TIMESTAMP
),
(
  'demo-003',
  'DEMO: รีวิวสมาร์ทโฟนรุ่นใหม่ 2025',
  'รีวิวฟีเจอร์ใหม่และประสิทธิภาพของสมาร์ทโฟนรุ่นล่าสุด',
  'Review of new smartphone features and performance in 2025',
  'Technology',
  'YouTube',
  'Tech Review Demo',
  CURRENT_TIMESTAMP - INTERVAL '6 hours',
  'https://www.youtube.com/watch?v=demo003',
  'https://via.placeholder.com/1280x720/95E1D3/FFFFFF?text=Demo+Top+3',
  'Sleek modern smartphone with edge-to-edge display showing colorful interface',
  82.7,
  3,
  true,
  5200,
  380,
  28,
  0.10,
  'Rising',
  'Comprehensive review covering all aspects of the latest flagship',
  '{"engagement": "medium", "sentiment": "neutral", "trending": false}'::jsonb,
  'demo003',
  'demo003',
  1,
  'smartphone,technology,review,gadget',
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

-- Grant permissions
GRANT SELECT ON public.home_demo_seed TO anon;
GRANT SELECT ON public.home_demo_seed TO authenticated;

-- Add comment
COMMENT ON TABLE public.home_demo_seed IS 'Demo seed data for QA testing. Only used when real data is unavailable. Contains 3 sample rows.';
