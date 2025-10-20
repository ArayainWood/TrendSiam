-- Query to check exact database content for problematic items
-- Run this against your Supabase database

SELECT 
  rank,
  title,
  SUBSTRING(title, 1, 150) as title_preview,
  LENGTH(title) as title_length,
  video_id,
  channel,
  category,
  created_at
FROM weekly_snapshot_items
WHERE snapshot_id = 'a934aaad'
  AND rank IN (4, 6, 11, 16, 18, 19, 20)
ORDER BY rank;

-- Alternative: Get hex encoding to see exact bytes (PostgreSQL)
SELECT 
  rank,
  title,
  encode(title::bytea, 'hex') as title_hex,
  LENGTH(title) as char_count
FROM weekly_snapshot_items
WHERE snapshot_id = 'a934aaad'
  AND rank IN (16, 20)
ORDER BY rank;

-- Check for control characters in the data
SELECT 
  rank,
  title,
  CASE 
    WHEN title ~ '[\x00-\x1F\x7F-\x9F]' THEN 'HAS_CONTROL_CHARS'
    ELSE 'CLEAN'
  END as control_char_status
FROM weekly_snapshot_items
WHERE snapshot_id = 'a934aaad'
  AND rank IN (4, 6, 11, 16, 18, 19, 20)
ORDER BY rank;
