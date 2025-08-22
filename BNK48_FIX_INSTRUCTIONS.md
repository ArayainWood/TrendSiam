# BNK48 Story Fix Instructions

## Prerequisites

1. Find the BNK48 video_id by running this SQL in Supabase:
```sql
SELECT video_id, title 
FROM public.news_trends
WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok'
  AND title ILIKE '%BNK48%'
LIMIT 1;
```

2. Note the video_id (e.g., `ABC123xyz`)

## Option 1: Using Main Pipeline (Recommended)

```bash
# Process only the BNK48 video with enrichment
python summarize_all_v2.py --verbose --only-video-id ABC123xyz --recompute-summaries

# If you also want to regenerate the AI opinion
python summarize_all_v2.py --verbose --only-video-id ABC123xyz --recompute-summaries --force-all-summaries
```

## Option 2: Using Standalone Script

```bash
# Quick fix for auxiliary fields only
python scripts/fix_single_video_enrichment.py ABC123xyz
```

## Option 3: Manual SQL Update (Emergency Only)

If the scripts fail, you can manually update in Supabase SQL editor:

```sql
UPDATE public.news_trends
SET 
  growth_rate = 'Medium (>1K/day)',
  platform_mentions = 'Primary platform only',
  keywords = 'MV, full, 11, Gatsu, Anklet, กำไลข้อเท้าแห่งความทรงจำ, BNK48',
  ai_opinion = 'J-pop idol group content with dedicated fanbase engagement',
  score_details = 'Good traction • 100K+ views',
  updated_at = NOW()
WHERE video_id = 'ABC123xyz'
  AND date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok';
```

## Verification

### Check Database
```sql
SELECT 
  video_id,
  title,
  growth_rate,
  platform_mentions,
  keywords,
  ai_opinion,
  score_details
FROM public.news_trends
WHERE video_id = 'ABC123xyz';
```

### Check UI
1. Open the app
2. Click on the BNK48 story (#3) to open detail modal
3. Verify "Detailed Analytics" section shows:
   - Growth Rate: Not "N/A"
   - Platforms: Shows value
   - Keywords: Shows Japanese/Thai terms
   - AI Opinion: Shows J-pop insight

## Expected Log Output

When running with `--verbose --only-video-id`:

```
🎯 [TARGETED-FIX] Loading single video: ABC123xyz
✅ Found video in today's batch: 【MV full】11-Gatsu no Anklet...
🔧 Enriching 1 videos with auxiliary fields...
[ENRICH] #1 ABC123xyz... growth=Medium (>1K/day), platforms=Primary platform only..., keywords=5, opinion=Y, score_details=Good traction • 100K+ views...
```

## Troubleshooting

1. **"Video not found"**: Make sure you're using today's video_id and the video is in today's batch
2. **"Supabase required"**: Ensure .env has valid Supabase credentials
3. **Keywords still missing**: Check if title has special Unicode characters that need escaping

## What Was Fixed

1. **Keyword extraction** now handles Japanese characters (Hiragana, Katakana, Kanji)
2. **Platform detection** checks both title and description
3. **AI opinion** recognizes J-pop idol groups specifically
4. **Growth rate** has better error handling for date parsing
5. **Score details** provides more descriptive information

The fix is idempotent - running it multiple times is safe and won't overwrite existing good data.
