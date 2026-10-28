-- Migration: 202610220001_pedometer_stats_and_daily_activity_fix.sql
-- Adds missing lifetime pedometer stats on profiles and metrics on daily_activity

alter table public.profiles
  add column if not exists total_calories_burned numeric(10,2) not null default 0,
  add column if not exists total_steps integer not null default 0,
  add column if not exists total_distance_km numeric(10,2) not null default 0;

alter table public.daily_activity
  add column if not exists distance_km numeric(10,2) not null default 0,
  add column if not exists speed_avg_kmh numeric(10,2) not null default 0;
