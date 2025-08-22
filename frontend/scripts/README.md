# TrendSiam Import Scripts

## Import to Supabase Script

This directory contains scripts for importing data into your Supabase database.

### `importToSupabase.ts`

Imports news data from `public/data/thailand_trending_summary.json` into the Supabase `news_trends` table.

#### Prerequisites

1. **Environment Configuration**: Make sure your `.env.local` file contains:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

2. **Database Setup**: Run the SQL schema from `docs/supabase-database-setup.sql` in your Supabase project.

3. **Data File**: Ensure `public/data/thailand_trending_summary.json` exists and contains valid news data.

#### Usage

```bash
# Method 1: Using npm script (recommended)
npm run import-to-supabase

# Method 2: Using tsx directly
npx tsx scripts/importToSupabase.ts

# Method 3: From the scripts directory
cd scripts
npx tsx importToSupabase.ts
```

#### What the script does:

1. **Validates Environment**: Checks for required Supabase credentials
2. **Tests Connection**: Verifies connection to Supabase database
3. **Reads JSON Data**: Loads news data from the JSON file
4. **Data Transformation**: Maps JSON fields to Supabase schema:
   - `title` → `title`
   - `summary` (or `summary_en`) → `summary`
   - `auto_category` → `category`
   - `popularity_score_precise` → `popularity_score`
   - `channel` → `platform`
   - `published_date` → `date`
   - `ai_image_url` → `ai_image_url`
5. **Batch Import**: Inserts all records with error handling
6. **Progress Reporting**: Shows real-time import progress

#### Expected Output

```
🚀 Starting TrendSiam data import to Supabase...
📊 Supabase URL: https://your-project.supabase.co
🔑 Using anon key: eyJhbGciOi...

🔍 Testing Supabase connection...
✅ Supabase connection successful

📖 Reading data from: /path/to/public/data/thailand_trending_summary.json
✅ Successfully loaded 25 news items from JSON

📥 Starting data import...
============================================================
✅ Inserted [1/25]: The Deliverer Trailer - "Trailblazer" | Honkai: Star Rail
✅ Inserted [2/25]: [Official Trailer] REVAMP THE UNDEAD STORY
✅ Inserted [3/25]: Another news title...
...
============================================================
📊 Import Summary:
✅ Successfully imported: 25 items
❌ Failed imports: 0 items
📈 Success rate: 100.0%

🎉 All items imported successfully!
```

#### Error Handling

The script includes comprehensive error handling for:

- **Missing environment variables**
- **Supabase connection failures**
- **Missing or invalid JSON file**
- **Individual record insertion failures**
- **Database constraint violations**

#### Troubleshooting

**Connection Issues:**
- Verify your Supabase URL and anon key are correct
- Check that the `news_trends` table exists in your database
- Ensure Row Level Security policies allow INSERT operations

**Data Issues:**
- Verify the JSON file exists at `public/data/thailand_trending_summary.json`
- Check that the JSON structure matches expected format
- Look for data validation errors in the console output

**Environment Issues:**
- Make sure `.env.local` file exists in the frontend directory
- Verify environment variables are correctly formatted
- Check that there are no extra spaces or quotes around values

#### Rate Limiting

The script includes a 100ms delay between insertions to avoid rate limiting. For large datasets, you may need to adjust this delay.

#### Data Mapping

| JSON Field | Supabase Field | Type | Notes |
|------------|----------------|------|-------|
| `title` | `title` | TEXT | Required |
| `summary` or `summary_en` | `summary` | TEXT | Uses Thai summary first, falls back to English |
| `auto_category` | `category` | TEXT | Defaults to "Uncategorized" |
| `popularity_score_precise` or `popularity_score` | `popularity_score` | NUMERIC | Uses precise score if available |
| `channel` | `platform` | TEXT | Defaults to "Unknown" |
| `published_date` | `date` | DATE | Converts to ISO date format |
| `ai_image_url` | `ai_image_url` | TEXT | Nullable field |

---

**Note**: This script is designed for initial data import. For ongoing data synchronization, consider implementing an upsert mechanism to handle duplicate records.
