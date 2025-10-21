-- Check columns in public_v_ai_images_latest view
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'public_v_ai_images_latest'
ORDER BY ordinal_position;

