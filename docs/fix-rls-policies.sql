-- Fix RLS policies for news_trends table
-- This allows the frontend (using anon key) to read data

-- First, check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'news_trends';

-- Drop any existing SELECT policies that might be conflicting
DROP POLICY IF EXISTS "Allow public read access" ON news_trends;
DROP POLICY IF EXISTS "Enable read access for all users" ON news_trends;

-- Create a new policy that allows anyone to SELECT (read) data
CREATE POLICY "Enable read access for all users" 
ON news_trends 
FOR SELECT 
USING (true);

-- Verify the policy was created
-- SELECT * FROM pg_policies WHERE tablename = 'news_trends';

-- Test the policy (run as anon user)
-- SET ROLE anon;
-- SELECT COUNT(*) FROM news_trends;
-- RESET ROLE;

-- Additional helpful queries:
-- Check if RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'news_trends';
-- List all policies: SELECT * FROM pg_policies WHERE tablename = 'news_trends';
