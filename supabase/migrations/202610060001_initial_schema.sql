create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.goal_type as enum ('weight_loss','muscle_gain','performance','general_fitness','maintenance');
create type public.measurement_type as enum ('weight','waist','hip','chest','arm','thigh','body_fat');
create type public.workout_status as enum ('in_progress','completed','abandoned');
create type public.meal_type as enum ('breakfast','lunch','dinner','snack','post_workout','pre_workout');
create type public.health_metric_type as enum ('steps','heart_rate','hrv','sleep','calories_burned','body_temp');
create type public.visibility as enum ('public','followers','private');
create type public.role as enum ('owner','admin','member');
create type public.notification_type as enum ('achievement','reminder','system','social','subscription','coach');
create type public.entity_target_type as enum ('post','comment','user','workout_session','challenge');
create type public.ai_role as enum ('user','assistant','tool');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  date_of_birth date,
  sex text check (sex in ('male','female','other','prefer_not_to_say')),
  height_cm numeric(5,2),
  language text default 'en',
  units_system text default 'metric' check (units_system in ('metric','imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  haptics_enabled boolean not null default true,
  reduce_motion boolean not null default false,
  notification_prefs jsonb not null default '{}'::jsonb,
  performance_mode boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_type public.goal_type not null,
  target_weight_kg numeric(5,2),
  target_date date,
  activity_level text,
  days_per_week integer check (days_per_week between 1 and 7),
  equipment_access text[] not null default '{}',
  dietary_prefs jsonb not null default '{}'::jsonb,
  allergies text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(5,2) not null,
  logged_at timestamptz not null default now(),
  note text
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measurement_type public.measurement_type not null,
  value_cm numeric(6,2) not null,
  logged_at timestamptz not null default now()
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  angle text not null check (angle in ('front','side','back')),
  taken_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  name text not null,
  name_urdu text,
  name_roman_urdu text,
  aliases text[] not null default '{}',
  category text,
  body_part text,
  equipment text,
  primary_muscle_group text,
  target_muscle text,
  secondary_muscle_groups text[] default '{}',
  movement_pattern text,
  description text,
  instructions jsonb not null default '[]'::jsonb,
  video_url text,
  image_url text,
  gif_url text,
  data_license text,
  media_status text,
  animation jsonb default '{}'::jsonb,
  source_dataset text default 'flow-exercise-dataset',
  is_global boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  goal text,
  level text,
  days_per_week integer not null default 4,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  day_index integer not null,
  name text not null,
  unique (program_id, day_index)
);

create table public.program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index integer not null,
  target_sets integer not null,
  target_rep_range text,
  unique (program_day_id, order_index)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_day_id uuid references public.program_days(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.workout_status not null default 'in_progress',
  total_volume_kg numeric(12,2) default 0,
  duration_seconds integer default 0,
  check (duration_seconds >= 0)
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index integer not null,
  notes text
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number integer not null,
  weight_kg numeric(8,2) not null default 0,
  reps integer not null default 0,
  rpe numeric(3,1),
  is_warmup boolean not null default false,
  completed_at timestamptz not null default now(),
  is_pr boolean not null default false,
  unique (session_exercise_id, set_number)
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  estimated_1rm numeric(8,2) not null,
  weight_kg numeric(8,2) not null,
  reps integer not null,
  achieved_at timestamptz not null default now(),
  unique (user_id, exercise_id, weight_kg, reps)
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_urdu text,
  name_roman_urdu text,
  aliases text[] not null default '{}',
  brand text,
  serving_size_g numeric(8,2),
  calories numeric(8,2),
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fiber_g numeric(8,2),
  sodium_mg numeric(8,2),
  sugar_g numeric(8,2),
  category text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  custom_food_name text,
  meal_type public.meal_type not null,
  quantity_grams numeric(8,2) not null,
  calories_snapshot numeric(8,2) not null,
  protein_snapshot numeric(8,2) not null,
  carbs_snapshot numeric(8,2) not null,
  fat_snapshot numeric(8,2) not null,
  logged_at timestamptz not null default now()
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0),
  logged_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null
);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index integer not null check (day_index between 0 and 6),
  meal_type public.meal_type not null,
  food_id uuid references public.foods(id) on delete set null,
  custom_food_name text,
  serving_grams numeric(8,2) not null default 0,
  unique (meal_plan_id, day_index, meal_type)
);

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.health_metric_type not null,
  value numeric(12,4) not null,
  unit text not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'device'
);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  total_minutes integer not null,
  deep_minutes integer,
  light_minutes integer,
  rem_minutes integer,
  sleep_score integer,
  start_time timestamptz,
  end_time timestamptz,
  unique (user_id, date)
);

create table public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  score integer not null,
  band text,
  hrv_value numeric(8,2),
  rhr_value numeric(8,2),
  computed_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  calories_consumed numeric(10,2) not null default 0,
  calories_target numeric(10,2) not null default 0,
  protein_g numeric(10,2) not null default 0,
  carbs_g numeric(10,2) not null default 0,
  fat_g numeric(10,2) not null default 0,
  steps integer not null default 0,
  water_ml integer not null default 0,
  active_minutes integer not null default 0,
  workout_completed boolean not null default false,
  unique (user_id, date)
);

create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  freeze_tokens_available integer not null default 3,
  freeze_tokens_used_this_week integer not null default 0
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  xp_awarded integer not null default 0,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, related_entity_id)
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  criteria_json jsonb not null default '{}'::jsonb
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_days integer not null,
  start_date date not null,
  end_date date not null,
  challenge_type text not null,
  is_group boolean not null default false
);

create table public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  current_progress numeric(12,2) not null default 0,
  completed_at timestamptz,
  unique (challenge_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_text text,
  media_urls text[] not null default '{}',
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  visibility public.visibility not null default 'public',
  created_at timestamptz not null default now()
);

create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_image text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.entity_target_type not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  revenuecat_customer_id text,
  entitlement text not null default 'free',
  status text not null default 'inactive' check (status in ('inactive','active','trialing','past_due','canceled')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role public.ai_role not null,
  content text not null,
  tool_calls jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  token_count integer default 0
);

create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  content text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','manual_review')),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  unique (user_id, route, window_start)
);

create index idx_weight_logs_user_recent on public.weight_logs (user_id, logged_at desc);
create index idx_food_logs_user_recent on public.food_logs (user_id, logged_at desc);
create index idx_sets_user_recent on public.sets (session_exercise_id, completed_at desc);
create index idx_daily_summaries_user_date on public.daily_summaries (user_id, date);
create index idx_challenge_leaderboard on public.challenge_participants (challenge_id, current_progress desc);
create index idx_follows_following on public.follows (following_id);
create index idx_posts_user_created on public.posts (user_id, created_at desc);
create index idx_notifications_user_unread on public.notifications (user_id, read_at, created_at desc);
create index idx_health_samples_recent on public.health_samples (user_id, recorded_at desc);

create or replace function public.food_search_document(food public.foods)
returns tsvector
language sql
immutable
as $$
  select to_tsvector(
    'english',
    coalesce(food.name, '') || ' ' ||
    coalesce(food.name_urdu, '') || ' ' ||
    coalesce(food.name_roman_urdu, '') || ' ' ||
    coalesce(array_to_string(food.aliases, ' '), '')
  );
$$;

create index idx_foods_trgm on public.foods using gin (public.food_search_document(foods));

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.goals enable row level security;
alter table public.weight_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_day_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.health_samples enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.streaks enable row level security;
alter table public.xp_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on public.profiles for delete using (id = auth.uid());

create policy "user_settings_select_own" on public.user_settings for select using (user_id = auth.uid());
create policy "user_settings_insert_own" on public.user_settings for insert with check (user_id = auth.uid());
create policy "user_settings_update_own" on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_settings_delete_own" on public.user_settings for delete using (user_id = auth.uid());

create policy "goals_select_own" on public.goals for select using (user_id = auth.uid());
create policy "goals_insert_own" on public.goals for insert with check (user_id = auth.uid());
create policy "goals_update_own" on public.goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete_own" on public.goals for delete using (user_id = auth.uid());

create policy "weight_logs_select_own" on public.weight_logs for select using (user_id = auth.uid());
create policy "weight_logs_insert_own" on public.weight_logs for insert with check (user_id = auth.uid());
create policy "weight_logs_update_own" on public.weight_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weight_logs_delete_own" on public.weight_logs for delete using (user_id = auth.uid());

create policy "body_measurements_select_own" on public.body_measurements for select using (user_id = auth.uid());
create policy "body_measurements_insert_own" on public.body_measurements for insert with check (user_id = auth.uid());
create policy "body_measurements_update_own" on public.body_measurements for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "body_measurements_delete_own" on public.body_measurements for delete using (user_id = auth.uid());

create policy "progress_photos_select_own" on public.progress_photos for select using (user_id = auth.uid());
create policy "progress_photos_insert_own" on public.progress_photos for insert with check (user_id = auth.uid());
create policy "progress_photos_update_own" on public.progress_photos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_photos_delete_own" on public.progress_photos for delete using (user_id = auth.uid());

create policy "exercises_select_public_library" on public.exercises for select using (true);
create policy "exercises_insert_authenticated" on public.exercises for insert with check (auth.role() = 'authenticated');
create policy "exercises_update_authenticated" on public.exercises for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "exercises_delete_authenticated" on public.exercises for delete using (auth.role() = 'authenticated');

create policy "foods_select_authenticated" on public.foods for select using (auth.role() = 'authenticated');
create policy "badges_select_authenticated" on public.badges for select using (auth.role() = 'authenticated');
create policy "challenges_select_authenticated" on public.challenges for select using (auth.role() = 'authenticated');

create policy "workout_programs_select_own" on public.workout_programs for select using (user_id is null or user_id = auth.uid());
create policy "workout_programs_insert_own" on public.workout_programs for insert with check (user_id = auth.uid() or user_id is null);
create policy "workout_programs_update_own" on public.workout_programs for update using (user_id = auth.uid() or user_id is null) with check (user_id = auth.uid() or user_id is null);
create policy "workout_programs_delete_own" on public.workout_programs for delete using (user_id = auth.uid() or user_id is null);

create policy "program_days_select_own" on public.program_days for select using (
  exists (
    select 1 from public.workout_programs wp where wp.id = program_days.program_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_days_insert_own" on public.program_days for insert with check (
  exists (
    select 1 from public.workout_programs wp where wp.id = program_days.program_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_days_update_own" on public.program_days for update using (
  exists (
    select 1 from public.workout_programs wp where wp.id = program_days.program_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.workout_programs wp where wp.id = program_days.program_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_days_delete_own" on public.program_days for delete using (
  exists (
    select 1 from public.workout_programs wp where wp.id = program_days.program_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);

create policy "program_day_exercises_select_own" on public.program_day_exercises for select using (
  exists (
    select 1 from public.program_days pd
    join public.workout_programs wp on wp.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_day_exercises_insert_own" on public.program_day_exercises for insert with check (
  exists (
    select 1 from public.program_days pd
    join public.workout_programs wp on wp.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_day_exercises_update_own" on public.program_day_exercises for update using (
  exists (
    select 1 from public.program_days pd
    join public.workout_programs wp on wp.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.program_days pd
    join public.workout_programs wp on wp.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);
create policy "program_day_exercises_delete_own" on public.program_day_exercises for delete using (
  exists (
    select 1 from public.program_days pd
    join public.workout_programs wp on wp.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id and (wp.user_id is null or wp.user_id = auth.uid())
  )
);

create policy "workout_sessions_select_own" on public.workout_sessions for select using (user_id = auth.uid());
create policy "workout_sessions_insert_own" on public.workout_sessions for insert with check (user_id = auth.uid());
create policy "workout_sessions_update_own" on public.workout_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_sessions_delete_own" on public.workout_sessions for delete using (user_id = auth.uid());

create policy "session_exercises_select_own" on public.session_exercises for select using (
  exists (select 1 from public.workout_sessions ws where ws.id = session_exercises.session_id and ws.user_id = auth.uid())
);
create policy "session_exercises_insert_own" on public.session_exercises for insert with check (
  exists (select 1 from public.workout_sessions ws where ws.id = session_exercises.session_id and ws.user_id = auth.uid())
);
create policy "session_exercises_update_own" on public.session_exercises for update using (
  exists (select 1 from public.workout_sessions ws where ws.id = session_exercises.session_id and ws.user_id = auth.uid())
) with check (
  exists (select 1 from public.workout_sessions ws where ws.id = session_exercises.session_id and ws.user_id = auth.uid())
);
create policy "session_exercises_delete_own" on public.session_exercises for delete using (
  exists (select 1 from public.workout_sessions ws where ws.id = session_exercises.session_id and ws.user_id = auth.uid())
);

create policy "sets_select_own" on public.sets for select using (
  exists (
    select 1 from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = auth.uid()
  )
);
create policy "sets_insert_own" on public.sets for insert with check (
  exists (
    select 1 from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = auth.uid()
  )
);
create policy "sets_update_own" on public.sets for update using (
  exists (
    select 1 from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = auth.uid()
  )
);
create policy "sets_delete_own" on public.sets for delete using (
  exists (
    select 1 from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = auth.uid()
  )
);

create policy "personal_records_select_own" on public.personal_records for select using (user_id = auth.uid());
create policy "personal_records_insert_own" on public.personal_records for insert with check (user_id = auth.uid());
create policy "personal_records_update_own" on public.personal_records for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "personal_records_delete_own" on public.personal_records for delete using (user_id = auth.uid());

create policy "food_logs_select_own" on public.food_logs for select using (user_id = auth.uid());
create policy "food_logs_insert_own" on public.food_logs for insert with check (user_id = auth.uid());
create policy "food_logs_update_own" on public.food_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "food_logs_delete_own" on public.food_logs for delete using (user_id = auth.uid());

create policy "water_logs_select_own" on public.water_logs for select using (user_id = auth.uid());
create policy "water_logs_insert_own" on public.water_logs for insert with check (user_id = auth.uid());
create policy "water_logs_update_own" on public.water_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "water_logs_delete_own" on public.water_logs for delete using (user_id = auth.uid());

create policy "meal_plans_select_own" on public.meal_plans for select using (user_id = auth.uid());
create policy "meal_plans_insert_own" on public.meal_plans for insert with check (user_id = auth.uid());
create policy "meal_plans_update_own" on public.meal_plans for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meal_plans_delete_own" on public.meal_plans for delete using (user_id = auth.uid());

create policy "health_samples_select_own" on public.health_samples for select using (user_id = auth.uid());
create policy "health_samples_insert_own" on public.health_samples for insert with check (user_id = auth.uid());
create policy "health_samples_update_own" on public.health_samples for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "health_samples_delete_own" on public.health_samples for delete using (user_id = auth.uid());

create policy "sleep_logs_select_own" on public.sleep_logs for select using (user_id = auth.uid());
create policy "sleep_logs_insert_own" on public.sleep_logs for insert with check (user_id = auth.uid());
create policy "sleep_logs_update_own" on public.sleep_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sleep_logs_delete_own" on public.sleep_logs for delete using (user_id = auth.uid());

create policy "readiness_scores_select_own" on public.readiness_scores for select using (user_id = auth.uid());
create policy "readiness_scores_insert_own" on public.readiness_scores for insert with check (user_id = auth.uid());
create policy "readiness_scores_update_own" on public.readiness_scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "readiness_scores_delete_own" on public.readiness_scores for delete using (user_id = auth.uid());

create policy "daily_summaries_select_own" on public.daily_summaries for select using (user_id = auth.uid());
create policy "daily_summaries_insert_own" on public.daily_summaries for insert with check (user_id = auth.uid());
create policy "daily_summaries_update_own" on public.daily_summaries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_summaries_delete_own" on public.daily_summaries for delete using (user_id = auth.uid());

create policy "streaks_select_own" on public.streaks for select using (user_id = auth.uid());
create policy "streaks_insert_own" on public.streaks for insert with check (user_id = auth.uid());
create policy "streaks_update_own" on public.streaks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "streaks_delete_own" on public.streaks for delete using (user_id = auth.uid());

create policy "xp_events_select_own" on public.xp_events for select using (user_id = auth.uid());
create policy "xp_events_block_client_write" on public.xp_events for insert with check (false);
create policy "xp_events_block_client_update" on public.xp_events for update using (false) with check (false);
create policy "xp_events_block_client_delete" on public.xp_events for delete using (false);

create policy "user_badges_select_own" on public.user_badges for select using (user_id = auth.uid());
create policy "user_badges_insert_own" on public.user_badges for insert with check (user_id = auth.uid());
create policy "user_badges_update_own" on public.user_badges for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_badges_delete_own" on public.user_badges for delete using (user_id = auth.uid());

create policy "challenge_participants_select_own" on public.challenge_participants for select using (user_id = auth.uid());
create policy "challenge_participants_insert_own" on public.challenge_participants for insert with check (user_id = auth.uid());
create policy "challenge_participants_update_own" on public.challenge_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "challenge_participants_delete_own" on public.challenge_participants for delete using (user_id = auth.uid());

create policy "posts_select_social" on public.posts for select using (
  user_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'followers' and exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.following_id = posts.user_id
  ))
);

create policy "posts_insert_own" on public.posts for insert with check (user_id = auth.uid());
create policy "posts_update_own" on public.posts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts_delete_own" on public.posts for delete using (user_id = auth.uid());

create policy "post_likes_select_own" on public.post_likes for select using (
  exists (select 1 from public.posts p where p.id = post_likes.post_id and (
    p.user_id = auth.uid() or p.visibility = 'public' or (p.visibility = 'followers' and exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id
    ))
  ))
);
create policy "post_likes_insert_own" on public.post_likes for insert with check (user_id = auth.uid());
create policy "post_likes_update_own" on public.post_likes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "post_likes_delete_own" on public.post_likes for delete using (user_id = auth.uid());

create policy "comments_select_social" on public.comments for select using (
  exists (select 1 from public.posts p where p.id = comments.post_id and (
    p.user_id = auth.uid() or p.visibility = 'public' or (p.visibility = 'followers' and exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id
    ))
  ))
);
create policy "comments_insert_own" on public.comments for insert with check (user_id = auth.uid());
create policy "comments_update_own" on public.comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments_delete_own" on public.comments for delete using (user_id = auth.uid());

create policy "follows_select_own" on public.follows for select using (follower_id = auth.uid() or following_id = auth.uid());
create policy "follows_insert_own" on public.follows for insert with check (follower_id = auth.uid());
create policy "follows_update_own" on public.follows for update using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "follows_delete_own" on public.follows for delete using (follower_id = auth.uid());

create policy "groups_select_authenticated" on public.groups for select using (auth.role() = 'authenticated');
create policy "group_members_select_authenticated" on public.group_members for select using (auth.role() = 'authenticated');
create policy "group_members_insert_own" on public.group_members for insert with check (user_id = auth.uid());
create policy "group_members_update_own" on public.group_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group_members_delete_own" on public.group_members for delete using (user_id = auth.uid());

create policy "reports_insert_own" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_select_own" on public.reports for select using (reporter_id = auth.uid());
create policy "reports_update_own" on public.reports for update using (reporter_id = auth.uid()) with check (reporter_id = auth.uid());

create policy "blocks_select_own" on public.blocks for select using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy "blocks_insert_own" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "blocks_update_own" on public.blocks for update using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "blocks_delete_own" on public.blocks for delete using (blocker_id = auth.uid());

create policy "notifications_select_own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications_insert_own" on public.notifications for insert with check (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications for delete using (user_id = auth.uid());

create policy "subscriptions_select_own" on public.subscriptions for select using (user_id = auth.uid());
create policy "subscriptions_block_client_write" on public.subscriptions for insert with check (false);
create policy "subscriptions_block_client_update" on public.subscriptions for update using (false) with check (false);
create policy "subscriptions_block_client_delete" on public.subscriptions for delete using (false);

create policy "ai_conversations_select_own" on public.ai_conversations for select using (user_id = auth.uid());
create policy "ai_conversations_insert_own" on public.ai_conversations for insert with check (user_id = auth.uid());
create policy "ai_conversations_update_own" on public.ai_conversations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_conversations_delete_own" on public.ai_conversations for delete using (user_id = auth.uid());

create policy "ai_messages_select_own" on public.ai_messages for select using (
  exists (select 1 from public.ai_conversations ac where ac.id = ai_messages.conversation_id and ac.user_id = auth.uid())
);
create policy "ai_messages_insert_own" on public.ai_messages for insert with check (
  exists (select 1 from public.ai_conversations ac where ac.id = ai_messages.conversation_id and ac.user_id = auth.uid())
);
create policy "ai_messages_update_own" on public.ai_messages for update using (
  exists (select 1 from public.ai_conversations ac where ac.id = ai_messages.conversation_id and ac.user_id = auth.uid())
) with check (
  exists (select 1 from public.ai_conversations ac where ac.id = ai_messages.conversation_id and ac.user_id = auth.uid())
);
create policy "ai_messages_delete_own" on public.ai_messages for delete using (
  exists (select 1 from public.ai_conversations ac where ac.id = ai_messages.conversation_id and ac.user_id = auth.uid())
);

create policy "moderation_queue_select_own_admin" on public.moderation_queue for select using (auth.role() = 'authenticated');
create policy "moderation_queue_insert_own_admin" on public.moderation_queue for insert with check (auth.role() = 'authenticated');
create policy "moderation_queue_update_own_admin" on public.moderation_queue for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "audit_log_select_admin" on public.audit_log for select using (auth.role() = 'authenticated');
create policy "audit_log_insert_admin" on public.audit_log for insert with check (auth.role() = 'authenticated');
create policy "audit_log_update_admin" on public.audit_log for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "rate_limits_select_own" on public.rate_limits for select using (user_id = auth.uid());
create policy "rate_limits_insert_own" on public.rate_limits for insert with check (user_id = auth.uid());
create policy "rate_limits_update_own" on public.rate_limits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rate_limits_delete_own" on public.rate_limits for delete using (user_id = auth.uid());

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create trigger foods_set_updated_at
before update on public.foods
for each row execute function public.set_updated_at();

create function public.get_user_total_xp(p_user_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(xp_awarded), 0)::integer from public.xp_events where user_id = p_user_id;
$$;

create function public.get_home_dashboard(p_user_id uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'daily_summary', (
      select jsonb_object_agg(date, row_to_json(d))
      from (
        select * from public.daily_summaries where user_id = p_user_id order by date desc limit 7
      ) d
    ),
    'streak', (
      select row_to_json(s) from public.streaks s where s.user_id = p_user_id
    ),
    'xp_total', public.get_user_total_xp(p_user_id),
    'subscription', (
      select row_to_json(subs) from public.subscriptions subs where subs.user_id = p_user_id
    )
  );
$$;

create or replace function public.refresh_daily_summary()
returns trigger
language plpgsql
as $$
declare
  target_date date;
begin
  if tg_table_name = 'food_logs' then
    target_date := date(NEW.logged_at);
    if tg_op = 'INSERT' then
      insert into public.daily_summaries(user_id, date, calories_consumed, protein_g, carbs_g, fat_g)
      values (NEW.user_id, target_date, NEW.calories_snapshot, NEW.protein_snapshot, NEW.carbs_snapshot, NEW.fat_snapshot)
      on conflict (user_id, date)
      do update set calories_consumed = daily_summaries.calories_consumed + EXCLUDED.calories_consumed,
                   protein_g = daily_summaries.protein_g + EXCLUDED.protein_snapshot,
                   carbs_g = daily_summaries.carbs_g + EXCLUDED.carbs_snapshot,
                   fat_g = daily_summaries.fat_g + EXCLUDED.fat_snapshot;
    elsif tg_op = 'UPDATE' then
      update public.daily_summaries
      set calories_consumed = calories_consumed - OLD.calories_snapshot + NEW.calories_snapshot,
          protein_g = protein_g - OLD.protein_snapshot + NEW.protein_snapshot,
          carbs_g = carbs_g - OLD.carbs_snapshot + NEW.carbs_snapshot,
          fat_g = fat_g - OLD.fat_snapshot + NEW.fat_snapshot
      where user_id = NEW.user_id and date = date(NEW.logged_at);
    elsif tg_op = 'DELETE' then
      update public.daily_summaries
      set calories_consumed = calories_consumed - OLD.calories_snapshot,
          protein_g = protein_g - OLD.protein_snapshot,
          carbs_g = carbs_g - OLD.carbs_snapshot,
          fat_g = fat_g - OLD.fat_snapshot
      where user_id = OLD.user_id and date = date(OLD.logged_at);
    end if;
  elsif tg_table_name = 'water_logs' then
    target_date := date(NEW.logged_at);
    if tg_op = 'INSERT' then
      insert into public.daily_summaries(user_id, date, water_ml)
      values (NEW.user_id, target_date, NEW.amount_ml)
      on conflict (user_id, date)
      do update set water_ml = daily_summaries.water_ml + EXCLUDED.water_ml;
    elsif tg_op = 'UPDATE' then
      update public.daily_summaries
      set water_ml = water_ml - OLD.amount_ml + NEW.amount_ml
      where user_id = NEW.user_id and date = date(NEW.logged_at);
    elsif tg_op = 'DELETE' then
      update public.daily_summaries
      set water_ml = water_ml - OLD.amount_ml
      where user_id = OLD.user_id and date = date(OLD.logged_at);
    end if;
  elsif tg_table_name = 'sets' then
    if tg_op = 'INSERT' then
      update public.daily_summaries ds
      set active_minutes = coalesce(active_minutes,0) + 1
      from public.session_exercises se
      join public.workout_sessions ws on ws.id = se.session_id
      where ds.user_id = ws.user_id and ds.date = date(ws.started_at) and se.id = NEW.session_exercise_id;
    end if;
  elsif tg_table_name = 'workout_sessions' then
    if NEW.status = 'completed' and (OLD is null or OLD.status <> 'completed') then
      update public.daily_summaries
      set workout_completed = true
      where user_id = NEW.user_id and date = date(NEW.completed_at);
    end if;
  elsif tg_table_name = 'health_samples' then
    if NEW.type = 'steps' then
      insert into public.daily_summaries(user_id, date, steps)
      values (NEW.user_id, date(NEW.recorded_at), floor(NEW.value))
      on conflict (user_id, date)
      do update set steps = daily_summaries.steps + floor(EXCLUDED.steps);
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create trigger food_logs_daily_summary
after insert or update of calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot or delete on public.food_logs
for each row execute function public.refresh_daily_summary();

create trigger water_logs_daily_summary
after insert or update of amount_ml or delete on public.water_logs
for each row execute function public.refresh_daily_summary();

create trigger sets_daily_summary
after insert or update or delete on public.sets
for each row execute function public.refresh_daily_summary();

create trigger workout_sessions_daily_summary
after insert or update of completed_at, status on public.workout_sessions
for each row execute function public.refresh_daily_summary();

create trigger health_samples_daily_summary
after insert or update of value or delete on public.health_samples
for each row execute function public.refresh_daily_summary();

create function public.evaluate_streak(p_user_id uuid)
returns void
language plpgsql
as $$
declare
  current_date_value date := current_date;
  last_day date;
  streak_record public.streaks;
  current_count integer := 0;
begin
  select * into streak_record from public.streaks where user_id = p_user_id;

  if streak_record is null then
    insert into public.streaks(user_id, current_streak, longest_streak, last_active_date)
    values (p_user_id, 1, 1, current_date_value);
    return;
  end if;

  last_day := streak_record.last_active_date;

  if last_day = current_date_value - 1 then
    current_count := streak_record.current_streak + 1;
  elsif last_day = current_date_value then
    current_count := streak_record.current_streak;
  else
    current_count := 1;
  end if;

  update public.streaks
  set current_streak = current_count,
      longest_streak = greatest(longest_streak, current_count),
      last_active_date = current_date_value
  where user_id = p_user_id;
end;
$$;

create function public.award_xp_event(p_user_id uuid, p_event_type text, p_related_entity_id uuid, p_xp_awarded integer)
returns void
language plpgsql
as $$
begin
  insert into public.xp_events(user_id, event_type, related_entity_id, xp_awarded)
  values (p_user_id, p_event_type, p_related_entity_id, p_xp_awarded)
  on conflict (user_id, event_type, related_entity_id)
  do nothing;
end;
$$;

create or replace function public.handle_workout_session_status_change()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'completed' and (OLD is null or OLD.status <> 'completed') then
    perform public.evaluate_streak(NEW.user_id);
    perform public.award_xp_event(NEW.user_id, 'workout_completed', NEW.id, 100);
  end if;

  return NEW;
end;
$$;

create trigger workout_session_status_trigger
after update of status on public.workout_sessions
for each row execute function public.handle_workout_session_status_change();

create function public.create_pr_record_if_needed()
returns trigger
language plpgsql
as $$
declare
  session_user uuid;
  estimated_1rm numeric(8,2);
begin
  select ws.user_id into session_user
  from public.session_exercises se
  join public.workout_sessions ws on ws.id = se.session_id
  where se.id = NEW.session_exercise_id;

  if session_user is null then
    return NEW;
  end if;

  estimated_1rm := (NEW.weight_kg * (1 + NEW.reps / 30.0));

  if exists (
    select 1 from public.personal_records pr
    where pr.user_id = session_user and pr.exercise_id = (
      select se.exercise_id from public.session_exercises se where se.id = NEW.session_exercise_id
    ) and pr.estimated_1rm >= estimated_1rm
  ) then
    return NEW;
  end if;

  insert into public.personal_records(user_id, exercise_id, estimated_1rm, weight_kg, reps)
  select session_user, se.exercise_id, estimated_1rm, NEW.weight_kg, NEW.reps
  from public.session_exercises se
  where se.id = NEW.session_exercise_id
  on conflict (user_id, exercise_id, weight_kg, reps) do nothing;

  perform public.award_xp_event(session_user, 'pr_broken', NEW.id, 250);

  insert into public.notifications(user_id, type, title, body, payload)
  values (
    session_user,
    'achievement',
    'New personal record',
    'You broke your strongest lift benchmark.',
    jsonb_build_object('kind', 'pr', 'set_id', NEW.id)
  );

  return NEW;
end;
$$;

create trigger set_pr_check
after insert on public.sets
for each row execute function public.create_pr_record_if_needed();

create materialized view public.leaderboard_weekly as
select
  xp.user_id,
  sum(xp.xp_awarded) as total_xp,
  row_number() over (order by sum(xp.xp_awarded) desc) as rank_position
from public.xp_events xp
group by xp.user_id;

create unique index leaderboard_weekly_user_idx on public.leaderboard_weekly(user_id);

create or replace function public.refresh_leaderboard_weekly()
returns void
language sql
as $$
  refresh materialized view concurrently public.leaderboard_weekly;
$$;

create table public.migration_lock (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  value text not null,
  updated_at timestamptz not null default now()
);

