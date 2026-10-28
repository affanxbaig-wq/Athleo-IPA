-- ─────────────────────────────────────────────────────────────────────────────
-- 202610200002_pedometer_activity_metrics.sql
--
-- Adds support for real-time 1ms pedometer tracking metrics:
--   1. distance_km and speed_avg_kmh in daily_activity
--   2. total_steps, total_calories_burned, total_distance_km, and step_goal in profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend public.daily_activity
alter table public.daily_activity
  add column if not exists distance_km numeric(10,2) not null default 0,
  add column if not exists speed_avg_kmh numeric(10,2) not null default 0;

-- 2. Extend public.profiles
alter table public.profiles
  add column if not exists total_steps bigint not null default 0,
  add column if not exists total_calories_burned numeric(10,2) not null default 0,
  add column if not exists total_distance_km numeric(10,2) not null default 0,
  add column if not exists step_goal integer not null default 10000;

-- 3. RLS policies already cover daily_activity and profiles.
