# AI Prompt Wiring Summary

## Changes Made (2025-09-26)

### 1. Updated AI Images View
Created `2025-09-26_fix_ai_images_latest_prompt.sql`:
- Added `ai_prompt` column to `public_v_ai_images_latest`
- Maintains definer semantics for security
- Returns: `news_id`, `image_url`, `ai_prompt`, `created_at`
- Only shows active images (latest per news_id)

### 2. Verified Home View Wiring
Created `2025-09-26_home_view_wire_ai_prompt.sql`:
- Home view already correctly joins with `public_v_ai_images_latest`
- Already has correct logic: prompts only for Top-3 items
- Non-Top-3 items correctly have NULL ai_prompt
- Uses COALESCE to prefer latest AI prompt over stored prompt

### 3. Data Flow
```
ai_images table → public_v_ai_images_latest → public_v_home_news
                  (definer view)               (definer view)
                  ↑                            ↑
                  anon can read                anon can read
```

### 4. Security Maintained
- Base table `ai_images` remains inaccessible to anon/authenticated
- Only public views are exposed
- Definer semantics ensure proper data access
- Plan-B security model fully preserved

## Testing Steps

1. Apply SQL migrations:
   ```sql
   -- 1. Update AI images view
   frontend/db/sql/fixes/2025-09-26_fix_ai_images_latest_prompt.sql
   
   -- 2. Verify wiring (diagnostic only)
   frontend/db/sql/fixes/2025-09-26_home_view_wire_ai_prompt.sql
   ```

2. Verify results:
   ```bash
   # Check diagnostics
   curl -s http://localhost:3000/api/home/diagnostics | jq
   
   # Check Top-3 items have prompts
   curl -s http://localhost:3000/api/home | jq '.data[] | select(.is_top3) | {title, ai_prompt}'
   
   # Verify non-Top-3 have null prompts
   curl -s http://localhost:3000/api/home | jq '.data[] | select(.is_top3 == false) | .ai_prompt' | grep -v null
   ```

3. UI verification:
   - "View AI Prompt" button appears only for Top-3 items
   - Clicking shows the actual generation prompt
   - No prompts shown for non-Top-3 items

## Column Contract
The 26-column contract remains intact:
- Column 11: `ai_prompt` (text, NULL except for Top-3)
