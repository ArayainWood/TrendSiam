# Supabase Storage Policy for AI Images

## Bucket Configuration

The AI images are stored in the `ai-images` bucket in Supabase Storage. This bucket must be configured for public access to allow the frontend to display images.

## Required Configuration

### 1. Bucket Settings
- **Bucket Name**: `ai-images`
- **Public Access**: `true`
- **File Size Limit**: 50MB (sufficient for WebP images)
- **Allowed MIME Types**: `image/webp`, `image/png`, `image/jpeg`

### 2. RLS Policies

For public read access, the bucket should have the following policy:

```sql
-- Allow public read access to all files in the ai-images bucket
CREATE POLICY "Public read access for ai-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ai-images');
```

### 3. Public URL Format

Public URLs for images in this bucket follow the format:
```
https://{project_ref}.supabase.co/storage/v1/object/public/ai-images/{filename}
```

## Verification

To verify the bucket is properly configured:

1. Check bucket exists:
```sql
SELECT * FROM storage.buckets WHERE name = 'ai-images';
```

2. Check public access:
```sql
SELECT name, public FROM storage.buckets WHERE name = 'ai-images';
-- Should return: public = true
```

3. Test public URL access:
- Generate a test URL for any existing image
- Access it in a browser without authentication
- Should return HTTP 200 status

## Troubleshooting

### If images return 403 Forbidden:
1. Check if bucket is set to public
2. Verify RLS policies allow SELECT
3. Check if URL format is correct

### If images return 404 Not Found:
1. Verify the file exists in storage
2. Check the filename is correct
3. Ensure the path doesn't have double slashes

## Migration Script

If the bucket needs to be made public, run this SQL:

```sql
-- Make bucket public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'ai-images';

-- Create public read policy if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public read access for ai-images'
  ) THEN
    CREATE POLICY "Public read access for ai-images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'ai-images');
  END IF;
END $$;
```
