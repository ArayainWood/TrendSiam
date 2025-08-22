# Quick Setup Commands for Restored AI Image System

## 🚀 Immediate Actions Required

### 1. Create Supabase Storage Bucket
```bash
# Go to Supabase Dashboard > Storage
# Create bucket: 'ai-images' (public read enabled)
```

### 2. Apply Database Policies
```sql
-- Run in Supabase SQL Editor:
-- Allow public read access on ai-images bucket
CREATE POLICY "Allow public read access on ai-images" ON storage.objects
FOR SELECT USING (bucket_id = 'ai-images');

-- Allow service role full access on ai-images bucket  
CREATE POLICY "Allow service role full access on ai-images" ON storage.objects
FOR ALL USING (bucket_id = 'ai-images');

-- Allow public read on ai_images table
CREATE POLICY "Allow public read on ai_images" ON ai_images
FOR SELECT USING (true);

-- Allow service role write on ai_images table
CREATE POLICY "Allow service role write on ai_images" ON ai_images
FOR ALL USING (true);

-- Enable RLS
ALTER TABLE ai_images ENABLE ROW LEVEL SECURITY;
```

### 3. Install Dependencies
```bash
pip install Pillow>=10.0.0
```

### 4. Test the System
```bash
# Test AI generation setup
python test_ai_image_generation.py

# Test pipeline (dry run)
python summarize_all_v2.py --limit 3 --verbose --dry-run --generate-images

# Test pipeline (live run - small batch)
python summarize_all_v2.py --limit 5 --verbose --generate-images --images-top-n=3
```

### 5. Verify Frontend
```bash
cd frontend
npm run build
npm run dev
# Check: localhost:3000 - Latest Stories should show AI images
```

## 🎯 Key Commands

### Generate AI Images for Top Stories
```bash
python summarize_all_v2.py --limit 20 --verbose --force-refresh-stats --generate-images --images-top-n=3
```

### Backfill Missing Images  
```bash
python summarize_all_v2.py --regenerate-missing-images --verbose
```

### Disable Image Generation (if needed)
```bash
python summarize_all_v2.py --limit 20 --verbose --generate-images=false
```

## ✅ Success Indicators

- ✅ Pipeline logs show: "🎨 AI-ONLY IMAGE GENERATION: Processing Top-N stories..."
- ✅ Pipeline logs show: "✅ Uploaded image to storage: filename.webp"  
- ✅ Frontend shows AI images with "🤖 AI-Generated" badges
- ✅ Network tab shows image requests to `*.supabase.co/storage/*`
- ✅ No 404 errors for image requests

## 🐛 Troubleshooting

### Images not showing:
1. Check Supabase bucket exists and is public
2. Verify RLS policies are applied
3. Ensure OPENAI_API_KEY is valid
4. Check pipeline logs for upload errors

### Permission errors:
1. Verify SUPABASE_SERVICE_ROLE_KEY (not anon key)
2. Check bucket policies allow service role access
3. Ensure ai_images table has proper RLS

### Generation failures:
1. Check OpenAI API key and credits
2. Verify internet connectivity for DALL-E API
3. Check Pillow library is installed for WebP conversion
