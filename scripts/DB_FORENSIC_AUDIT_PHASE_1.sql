-- ============================================================================
-- PHASE 1: SCHEMA & DATA DISCOVERY FORENSIC AUDIT
-- TrendSiam Weekly PDF Rendering Investigation
-- ============================================================================
-- 
-- Purpose: Comprehensive DB forensic audit to identify control characters,
--          normalization issues, and data integrity problems affecting PDF rendering
-- 
-- Safety: READ-ONLY queries first. Write operations require explicit confirmation.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: SCHEMA CONFIRMATION
-- -----------------------------------------------------------------------------

-- Verify actual table/view names (not assumptions)
SELECT 
  schemaname, 
  tablename as name, 
  'table' as type
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%weekly%' OR tablename LIKE '%snapshot%'
UNION ALL
SELECT 
  schemaname,
  viewname as name,
  'view' as type
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE '%weekly%' OR viewname LIKE '%snapshot%'
ORDER BY type, name;

-- -----------------------------------------------------------------------------
-- SECTION 2: SNAPSHOT DATA STRUCTURE INVESTIGATION
-- -----------------------------------------------------------------------------

-- Get the current/latest snapshot metadata
SELECT 
  snapshot_id,
  status,
  range_start,
  range_end,
  built_at,
  algo_version,
  data_version,
  created_at,
  jsonb_array_length(items) as item_count,
  pg_size_pretty(pg_column_size(items)) as items_size_pretty
FROM weekly_report_snapshots
WHERE status = 'ready'
ORDER BY built_at DESC
LIMIT 5;

-- -----------------------------------------------------------------------------
-- SECTION 3: EXTRACT PROBLEMATIC ITEMS (#4, #6, #16, #18, #19, #20)
-- -----------------------------------------------------------------------------

-- Extract items from the latest snapshot (snapshot_id from query above)
-- Replace 'a934aaad' with actual snapshot_id if different
WITH snapshot_items AS (
  SELECT 
    snapshot_id,
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
)
SELECT 
  snapshot_id,
  (item->>'rank')::int as rank,
  item->>'title' as title,
  length(item->>'title') as title_length,
  item->>'video_id' as video_id,
  item->>'channel' as channel,
  item->>'category' as category,
  item->>'popularity_score' as popularity_score
FROM snapshot_items
WHERE (item->>'rank')::int IN (4, 6, 11, 16, 18, 19, 20)
ORDER BY (item->>'rank')::int;

-- -----------------------------------------------------------------------------
-- SECTION 4: HEX DUMP & CONTROL CHARACTER DETECTION
-- -----------------------------------------------------------------------------

-- Forensic hex analysis of title field for items #16 and #20
WITH snapshot_items AS (
  SELECT 
    snapshot_id,
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
),
title_analysis AS (
  SELECT 
    (item->>'rank')::int as rank,
    item->>'title' as title,
    length(item->>'title') as char_count,
    octet_length(item->>'title') as byte_count,
    encode((item->>'title')::bytea, 'hex') as title_hex,
    -- Check for control characters (C0: 0x00-0x1F, C1: 0x7F-0x9F)
    (item->>'title') ~ '[\x00-\x1F\x7F-\x9F]' as has_control_chars,
    -- Check for zero-width characters
    (item->>'title') ~ '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]' as has_zero_width,
    -- Check for specific problematic chars
    position(E'\x0F' in item->>'title') > 0 as has_0x0F,
    position(E'\x80' in item->>'title') > 0 as has_0x80,
    -- Check for special symbols
    position('₽' in item->>'title') > 0 as has_ruble,
    position('℘' in item->>'title') > 0 as has_weierstrass,
    position('~' in item->>'title') > 0 as has_tilde,
    position('{' in item->>'title') > 0 as has_left_brace,
    position('@' in item->>'title') > 0 as has_at_sign
  FROM snapshot_items
  WHERE (item->>'rank')::int IN (16, 20)
)
SELECT 
  rank,
  title,
  char_count,
  byte_count,
  SUBSTRING(title_hex, 1, 200) as title_hex_first_100_chars,
  has_control_chars,
  has_zero_width,
  has_0x0F,
  has_0x80,
  has_ruble,
  has_weierstrass,
  has_tilde,
  has_left_brace,
  has_at_sign
FROM title_analysis
ORDER BY rank;

-- -----------------------------------------------------------------------------
-- SECTION 5: UNICODE NORMALIZATION CHECK
-- -----------------------------------------------------------------------------

-- Check if titles are in NFC normalization form
WITH snapshot_items AS (
  SELECT 
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
)
SELECT 
  (item->>'rank')::int as rank,
  item->>'title' as original_title,
  normalize(item->>'title', NFC) as nfc_normalized,
  CASE 
    WHEN item->>'title' = normalize(item->>'title', NFC) THEN 'NFC ✓'
    WHEN item->>'title' = normalize(item->>'title', NFD) THEN 'NFD'
    WHEN item->>'title' = normalize(item->>'title', NFKC) THEN 'NFKC'
    WHEN item->>'title' = normalize(item->>'title', NFKD) THEN 'NFKD'
    ELSE 'MIXED/OTHER'
  END as normalization_form,
  (item->>'title' != normalize(item->>'title', NFC)) as needs_normalization
FROM snapshot_items
WHERE (item->>'rank')::int IN (4, 6, 11, 16, 18, 19, 20)
ORDER BY (item->>'rank')::int;

-- -----------------------------------------------------------------------------
-- SECTION 6: COMPREHENSIVE CORRUPTION STATISTICS (ALL ITEMS)
-- -----------------------------------------------------------------------------

-- Get corruption stats across ALL items in the snapshot
WITH snapshot_items AS (
  SELECT 
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
),
corruption_stats AS (
  SELECT 
    (item->>'rank')::int as rank,
    (item->>'title') ~ '[\x00-\x1F\x7F-\x9F]' as has_control,
    (item->>'title') ~ '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]' as has_zero_width,
    (item->>'title' != normalize(item->>'title', NFC)) as needs_nfc
  FROM snapshot_items
)
SELECT 
  COUNT(*) as total_items,
  SUM(CASE WHEN has_control THEN 1 ELSE 0 END) as items_with_control_chars,
  SUM(CASE WHEN has_zero_width THEN 1 ELSE 0 END) as items_with_zero_width,
  SUM(CASE WHEN needs_nfc THEN 1 ELSE 0 END) as items_needing_nfc_normalization,
  ROUND(100.0 * SUM(CASE WHEN has_control THEN 1 ELSE 0 END) / COUNT(*), 2) as pct_with_control,
  ROUND(100.0 * SUM(CASE WHEN has_zero_width THEN 1 ELSE 0 END) / COUNT(*), 2) as pct_with_zero_width,
  ROUND(100.0 * SUM(CASE WHEN needs_nfc THEN 1 ELSE 0 END) / COUNT(*), 2) as pct_needing_nfc
FROM corruption_stats;

-- -----------------------------------------------------------------------------
-- SECTION 7: CHARACTER FREQUENCY ANALYSIS
-- -----------------------------------------------------------------------------

-- Find all unique control characters present in titles
WITH snapshot_items AS (
  SELECT 
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
),
titles_with_control AS (
  SELECT 
    (item->>'rank')::int as rank,
    item->>'title' as title
  FROM snapshot_items
  WHERE (item->>'title') ~ '[\x00-\x1F\x7F-\x9F]'
)
SELECT 
  rank,
  SUBSTRING(title, 1, 80) as title_preview,
  regexp_matches(encode(title::bytea, 'hex'), '(0[0-9a-f]|1[0-9a-f]|7f|[89][0-9a-f])', 'g') as control_char_hex
FROM titles_with_control
ORDER BY rank;

-- -----------------------------------------------------------------------------
-- SECTION 8: COMPARE WITH news_trends SOURCE (IF AVAILABLE)
-- -----------------------------------------------------------------------------

-- Check if corruption exists in source table or only in snapshots
-- This helps identify if the issue is in ETL or source data
WITH snapshot_items AS (
  SELECT 
    jsonb_array_elements(items) as item
  FROM weekly_report_snapshots
  WHERE snapshot_id = 'a934aaad' -- UPDATE THIS
    AND status = 'ready'
)
SELECT 
  si.rank,
  si.title as snapshot_title,
  nt.title as news_trends_title,
  (si.title = nt.title) as titles_match,
  (si.title ~ '[\x00-\x1F\x7F-\x9F]') as snapshot_has_control,
  (nt.title ~ '[\x00-\x1F\x7F-\x9F]') as source_has_control
FROM (
  SELECT 
    (item->>'rank')::int as rank,
    item->>'title' as title,
    item->>'video_id' as video_id
  FROM snapshot_items
  WHERE (item->>'rank')::int IN (4, 6, 11, 16, 18, 19, 20)
) si
LEFT JOIN news_trends nt ON (
  nt.video_id = si.video_id
  OR nt.external_id = si.video_id
)
ORDER BY si.rank;

-- ============================================================================
-- END OF READ-ONLY FORENSIC QUERIES
-- ============================================================================

-- NEXT STEPS (WRITE OPERATIONS - NOT YET EXECUTED):
-- 1. Create backup of current snapshot
-- 2. Clean control characters from items JSONB
-- 3. Normalize all titles to NFC
-- 4. Update snapshot with cleaned data
-- 5. Verify PDF generation with cleaned data

-- To execute write operations, run PHASE 2 script (DB_REMEDIATION_PHASE_2.sql)
