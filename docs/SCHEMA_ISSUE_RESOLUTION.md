# 🔧 Schema Issue Resolution Guide

## ❌ **Current Issue: `updated_at` Field Missing**

The import script is failing with the error:
```
record "new" has no field "updated_at"
```

This indicates a mismatch between the data being sent and the database schema.

## 🛠️ **Solution Options**

### **Option 1: Update Database Schema (Recommended)**

Run this SQL in your Supabase SQL Editor to ensure all required fields exist:

```sql
-- =============================================
-- Complete TrendSiam Schema Setup
-- =============================================

-- Create updated_at column if it doesn't exist
ALTER TABLE news_trends ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create the update function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_news_trends_updated_at ON news_trends;
CREATE TRIGGER update_news_trends_updated_at 
  BEFORE UPDATE ON news_trends 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify all required columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'news_trends' 
ORDER BY ordinal_position;
```

### **Option 2: Remove System Fields from Import**

If you don't want automatic timestamp fields, you can modify the database schema:

```sql
-- Remove the updated_at field entirely
ALTER TABLE news_trends DROP COLUMN IF EXISTS updated_at;

-- Remove the trigger
DROP TRIGGER IF EXISTS update_news_trends_updated_at ON news_trends;
```

### **Option 3: Quick Test with Minimal Schema**

For immediate testing, create a simple table:

```sql
-- Drop and recreate with minimal schema
DROP TABLE IF EXISTS news_trends;

CREATE TABLE news_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  platform TEXT,
  popularity_score NUMERIC,
  date DATE DEFAULT CURRENT_DATE,
  video_id TEXT UNIQUE,
  view_count TEXT,
  like_count TEXT,
  comment_count TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE news_trends ENABLE ROW LEVEL SECURITY;

-- Create read policy
CREATE POLICY "Public read access" ON news_trends
  FOR SELECT
  USING (true);
```

## 🎯 **Recommended Action**

1. **Run Option 1 SQL** in your Supabase SQL Editor
2. **Test the import** with `npm run import-test`
3. **If successful**, run full import with `npm run import-to-supabase`

## 🔍 **Debugging Commands**

```bash
# Test with minimal data
npm run import-test

# Test including incomplete items  
npm run import-with-incomplete

# Check TypeScript compilation
npm run type-check
```

## ✅ **Expected Success Output**

After fixing the schema, you should see:

```bash
✅ UPDATED [1/2]: The Deliverer Trailer - "Trailblazer"...
   🗃️  Database ID: 12345 | Operation: UPDATED
✅ UPDATED [2/2]: [Official Trailer] REVAMP THE UNDEAD STORY
   🗃️  Database ID: 12346 | Operation: UPDATED

🎉 ALL ITEMS IMPORTED SUCCESSFULLY!
```

The duplicate prevention features are fully implemented and ready - this is just a schema compatibility issue.
