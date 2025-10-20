# Home View Verification Fix Summary

## Changes Made

### 1. Updated verify_home_view.sql
- Fixed the system_meta query to only select existing columns: `key`, `value`, `updated_at`
- Removed reference to non-existent `description` column
- Added comprehensive column contract verification for all 26 expected columns
- Added view existence check
- Added type assertions for growth_rate fields

### 2. Updated memory-bank/13_testing_acceptance_criteria.mb
- Added "Home View Verification" section with expected outcomes
- Documented all verification checks and their expected results

## Manual Verification Steps

1. **Run the SQL verification script in Supabase:**
   ```sql
   -- Copy and run the contents of:
   -- frontend/db/sql/fixes/verify_home_view.sql
   ```

   Expected results:
   - Check 0: `view_exists = true`
   - Check 1: `total_rows >= 1` (or 0 if pipeline hasn't run)
   - Check 2: Shows top 5 items with ranking
   - Check 3: Shows system_meta values (if configured)
   - Check 4: No rows returned (no missing/unexpected columns)
   - Check 5: Both type assertions = true

2. **Test the API endpoints:**
   ```bash
   # If using bash/WSL:
   curl -s "http://localhost:3000/api/home" | jq '.data | length'
   curl -s "http://localhost:3000/api/home/diagnostics" | jq '.missingColumns'
   curl -s "http://localhost:3000/api/home/ping" | jq
   
   # Or open in browser:
   # http://localhost:3000/api/home
   # http://localhost:3000/api/home/diagnostics
   # http://localhost:3000/api/home/ping
   ```

3. **Check the Home page UI:**
   - Visit http://localhost:3000
   - Verify news cards render
   - Verify Top-3 items show images + "View AI Prompt" button
   - Verify non-Top-3 items have no images

## Column Contract (26 columns)

The view expects these exact columns:
1. id
2. title
3. summary
4. summary_en
5. category
6. platform
7. channel
8. published_at
9. source_url
10. image_url
11. ai_prompt
12. popularity_score
13. rank
14. is_top3
15. views
16. likes
17. comments
18. growth_rate_value
19. growth_rate_label
20. ai_opinion
21. score_details
22. external_id
23. keywords
24. updated_at
25. video_id
26. platform_mentions

## Troubleshooting

If the verification fails:
1. Check if the view exists: `SELECT to_regclass('public.public_v_home_news');`
2. Check actual columns: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='public_v_home_news' ORDER BY ordinal_position;`
3. Ensure the migration was applied: `frontend/db/sql/fixes/2025-09-17_repair_public_v_home_news.sql`
