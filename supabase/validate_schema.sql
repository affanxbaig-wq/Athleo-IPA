-- ATHLEO Backend Schema Validation
-- Run these queries in Supabase SQL Editor to verify your backend is correctly deployed

-- 1. Verify core tables exist
-- ===========================
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Check RLS is enabled on all tables
-- =======================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Count RLS policies by table
-- ================================
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 4. Verify indexes exist for performance
-- =========================================
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Check auth providers are configured
-- ========================================
SELECT 
  * 
FROM auth.flow_state
LIMIT 1;
-- (If this returns results, auth is active)

-- 6. Verify custom functions exist
-- ==================================
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname LIKE '%xp%' OR proname LIKE '%streak%' OR proname LIKE '%pr%'
ORDER BY proname;

-- 7. Test RLS: Create a test user context
-- =========================================
-- Uncomment and run to test RLS policies:
-- CREATE TEMP TABLE temp_user_context AS SELECT gen_random_uuid() as test_user_id;

-- SELECT * FROM profiles WHERE id = (SELECT test_user_id FROM temp_user_context);
-- -- This should only work if you're the authenticated user

-- 8. Verify triggers are active
-- ================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 9. Check daily_summaries table status
-- =======================================
SELECT 
  COUNT(*) as total_summaries,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(date) as latest_summary
FROM public.daily_summaries;

-- 10. Verify xp_events accumulation
-- ====================================
SELECT 
  event_type,
  COUNT(*) as count,
  SUM(xp_awarded) as total_xp
FROM public.xp_events
GROUP BY event_type
ORDER BY total_xp DESC;
