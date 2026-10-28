-- Daily activity rollup table used by the app's dailyTracker sync
-- (src/services/dailyTracker.ts upserts on conflict of user_id,date)

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  steps integer not null default 0,
  water_ml integer not null default 0,
  calories_burned numeric(10,2) not null default 0,
  calories_consumed numeric(10,2) not null default 0,
  workouts integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_activity_user_date
  on public.daily_activity (user_id, date desc);

alter table public.daily_activity enable row level security;

drop policy if exists "daily_activity_select_own" on public.daily_activity;
create policy "daily_activity_select_own"
  on public.daily_activity for select
  using (user_id = auth.uid());

drop policy if exists "daily_activity_insert_own" on public.daily_activity;
create policy "daily_activity_insert_own"
  on public.daily_activity for insert
  with check (user_id = auth.uid());

drop policy if exists "daily_activity_update_own" on public.daily_activity;
create policy "daily_activity_update_own"
  on public.daily_activity for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
