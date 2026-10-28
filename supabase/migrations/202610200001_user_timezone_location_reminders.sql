-- ─────────────────────────────────────────────────────────────────────────────
-- 202610200001_user_timezone_location_reminders.sql
--
-- Backend Architecture for Location, Timezone, Workout Schedule &
-- Personalized Goal Reminders in Supabase:
--
-- 1. Profiles location & timezone extension:
--    - timezone, country, country_code, region, city, lat, lng, permission
-- 2. user_workout_schedules:
--    - workout_time, workout_days, selected_exercises (jsonb), reminder_enabled,
--      timezone, country, region, city
-- 3. workout_reminders:
--    - Stores generated personalized notifications with goal snapshot,
--      app suggestions (calories/macros/coaching), selected exercises,
--      scheduled local time & timezone, delivery status.
-- 4. Automatic logic & triggers:
--    - Whenever user updates body fitness metrics, goal, or workout schedule,
--      `public.generate_workout_goal_reminder(user_id)` automatically generates
--      the tailored reminder payload.
-- 5. RPCs for mobile client:
--    - `public.sync_user_location_and_timezone(...)`
--    - `public.save_workout_schedule_and_exercises(...)`
--    - `public.get_user_workout_schedule()`
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Extend profiles with Location & Timezone fields ───────────────────────

alter table public.profiles
  add column if not exists timezone            text not null default 'UTC',
  add column if not exists country             text,
  add column if not exists country_code        text,
  add column if not exists region              text,
  add column if not exists city                text,
  add column if not exists latitude            numeric(9,6),
  add column if not exists longitude           numeric(9,6),
  add column if not exists location_permission text default 'unknown',
  add column if not exists location_updated_at timestamptz;

-- ─── 2. user_workout_schedules table ─────────────────────────────────────────

create table if not exists public.user_workout_schedules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.profiles(id) on delete cascade,
  workout_time       text not null default '07:00 AM',
  workout_days       text[] not null default array['Monday','Wednesday','Friday'],
  selected_exercises jsonb not null default '[]'::jsonb,
  reminder_enabled   boolean not null default true,
  timezone           text not null default 'UTC',
  country            text,
  country_code       text,
  region             text,
  city               text,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_user_workout_schedules_user
  on public.user_workout_schedules(user_id);

create index if not exists idx_user_workout_schedules_tz
  on public.user_workout_schedules(timezone, workout_time);

alter table public.user_workout_schedules enable row level security;

drop policy if exists "user_workout_schedules_select_own" on public.user_workout_schedules;
create policy "user_workout_schedules_select_own"
  on public.user_workout_schedules for select using (user_id = auth.uid());

drop policy if exists "user_workout_schedules_insert_own" on public.user_workout_schedules;
create policy "user_workout_schedules_insert_own"
  on public.user_workout_schedules for insert with check (user_id = auth.uid());

drop policy if exists "user_workout_schedules_update_own" on public.user_workout_schedules;
create policy "user_workout_schedules_update_own"
  on public.user_workout_schedules for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_workout_schedules_delete_own" on public.user_workout_schedules;
create policy "user_workout_schedules_delete_own"
  on public.user_workout_schedules for delete using (user_id = auth.uid());

-- ─── 3. workout_reminders table ──────────────────────────────────────────────

create table if not exists public.workout_reminders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  notification_type    text not null default 'workout_goal_reminder',
  title                text not null,
  body                 text not null,
  goal_snapshot        text not null,
  suggestion_snapshot  text not null,
  exercises_snapshot   jsonb not null default '[]'::jsonb,
  scheduled_time       text not null,
  scheduled_for        timestamptz,
  timezone             text not null default 'UTC',
  country              text,
  region               text,
  city                 text,
  status               text not null default 'scheduled' check (status in ('scheduled','sent','delivered','dismissed')),
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_workout_reminders_user_status
  on public.workout_reminders(user_id, status, created_at desc);

create index if not exists idx_workout_reminders_schedule
  on public.workout_reminders(scheduled_for, status);

alter table public.workout_reminders enable row level security;

drop policy if exists "workout_reminders_select_own" on public.workout_reminders;
create policy "workout_reminders_select_own"
  on public.workout_reminders for select using (user_id = auth.uid());

drop policy if exists "workout_reminders_insert_own" on public.workout_reminders;
create policy "workout_reminders_insert_own"
  on public.workout_reminders for insert with check (user_id = auth.uid());

drop policy if exists "workout_reminders_update_own" on public.workout_reminders;
create policy "workout_reminders_update_own"
  on public.workout_reminders for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── 4. Reminder Generation Logic ────────────────────────────────────────────

create or replace function public.generate_workout_goal_reminder(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   public.profiles;
  v_targets   public.user_targets;
  v_schedule  public.user_workout_schedules;
  v_goal_name text;
  v_goal_str  text;
  v_sugg_str  text;
  v_ex_names  text := '';
  v_ex_count  integer := 0;
  v_title     text;
  v_body      text;
  v_tz        text;
  v_time      text;
  v_time_clean text;
  v_hour      integer := 7;
  v_min       integer := 0;
  v_is_pm     boolean := false;
  v_parts     text[];
  v_hm        text[];
  v_rem_id    uuid;
  v_result    jsonb;
begin
  if p_user_id is null then
    return null;
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return null;
  end if;

  select * into v_targets from public.user_targets where user_id = p_user_id;
  select * into v_schedule from public.user_workout_schedules where user_id = p_user_id;

  -- Timezone resolution: prefer schedule, then profile, then fallback
  v_tz := coalesce(nullif(v_schedule.timezone, ''), nullif(v_profile.timezone, ''), 'UTC');
  v_time := coalesce(nullif(v_schedule.workout_time, ''), '07:00 AM');

  -- Parse Goal
  case coalesce(v_profile.primary_goal, 'general_fitness')
    when 'weight_loss'   then v_goal_name := 'Fat Loss & Conditioning';
    when 'muscle_gain'   then v_goal_name := 'Muscle Hypertrophy & Strength';
    when 'performance'   then v_goal_name := 'Athletic Endurance & Performance';
    when 'general_fitness' then v_goal_name := 'Full Body Health & Mobility';
    else v_goal_name := initcap(replace(v_profile.primary_goal, '_', ' '));
  end case;

  if v_profile.weight_kg is not null and v_profile.target_weight_kg is not null then
    v_goal_str := format('Goal: %s (Current: %s kg → Target: %s kg)', v_goal_name, v_profile.weight_kg, v_profile.target_weight_kg);
  elsif v_profile.weight_kg is not null then
    v_goal_str := format('Goal: %s (Body Weight: %s kg)', v_goal_name, v_profile.weight_kg);
  else
    v_goal_str := format('Goal: %s', v_goal_name);
  end if;

  -- App Suggestions from Targets + Coach derivation
  if v_targets is not null then
    v_sugg_str := format('App Recommendation: Daily budget %s kcal, %s g protein. Hydrate with %s ml water and aim for %s steps.',
      v_targets.calorie_target, v_targets.protein_target_g, v_targets.water_target_ml, v_targets.steps_target);
  else
    v_sugg_str := 'App Recommendation: Fuel consistently with lean protein, maintain progressive resistance, and prioritize active recovery.';
  end if;

  -- Selected Exercises formatting
  if v_schedule is not null and v_schedule.selected_exercises is not null and jsonb_array_length(v_schedule.selected_exercises) > 0 then
    v_ex_count := jsonb_array_length(v_schedule.selected_exercises);
    select string_agg(elem->>'name', ', ')
      into v_ex_names
    from (
      select elem
      from jsonb_array_elements(v_schedule.selected_exercises) elem
      limit 3
    ) sub;

    if v_ex_count > 3 then
      v_ex_names := v_ex_names || format(' +%s more', v_ex_count - 3);
    end if;
  else
    v_ex_names := 'Personalized Daily Workout Protocol';
  end if;

  -- Notification Title & Body
  v_title := format('🏋️ Time to Train (%s) — %s', v_time, v_goal_name);
  v_body  := format('%s. Today''s Routine: %s. %s', v_goal_str, v_ex_names, v_sugg_str);

  -- Upsert reminder into workout_reminders (mark previous scheduled as updated)
  update public.workout_reminders
  set status = 'dismissed', updated_at = now()
  where user_id = p_user_id and status = 'scheduled';

  insert into public.workout_reminders (
    user_id,
    notification_type,
    title,
    body,
    goal_snapshot,
    suggestion_snapshot,
    exercises_snapshot,
    scheduled_time,
    scheduled_for,
    timezone,
    country,
    region,
    city,
    status
  ) values (
    p_user_id,
    'workout_goal_reminder',
    v_title,
    v_body,
    v_goal_str,
    v_sugg_str,
    coalesce(v_schedule.selected_exercises, '[]'::jsonb),
    v_time,
    now() + interval '1 day', -- initial anchor
    v_tz,
    coalesce(v_schedule.country, v_profile.country),
    coalesce(v_schedule.region, v_profile.region),
    coalesce(v_schedule.city, v_profile.city),
    'scheduled'
  )
  returning id into v_rem_id;

  v_result := jsonb_build_object(
    'ok', true,
    'reminder_id', v_rem_id,
    'title', v_title,
    'body', v_body,
    'goal', v_goal_str,
    'suggestion', v_sugg_str,
    'exercises', coalesce(v_schedule.selected_exercises, '[]'::jsonb),
    'workout_time', v_time,
    'timezone', v_tz,
    'country', coalesce(v_schedule.country, v_profile.country),
    'region', coalesce(v_schedule.region, v_profile.region),
    'city', coalesce(v_schedule.city, v_profile.city)
  );

  return v_result;
end;
$$;

-- ─── 5. Client RPC: sync_user_location_and_timezone ──────────────────────────

create or replace function public.sync_user_location_and_timezone(
  p_timezone            text,
  p_country             text default null,
  p_country_code        text default null,
  p_region              text default null,
  p_city                text default null,
  p_lat                 numeric default null,
  p_lng                 numeric default null,
  p_permission          text default 'granted'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_tz text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_clean_tz := coalesce(nullif(p_timezone, ''), 'UTC');

  -- Update profiles
  update public.profiles
  set
    timezone            = v_clean_tz,
    country             = coalesce(p_country, country),
    country_code        = coalesce(p_country_code, country_code),
    region              = coalesce(p_region, region),
    city                = coalesce(p_city, city),
    latitude            = coalesce(p_lat, latitude),
    longitude           = coalesce(p_lng, longitude),
    location_permission = coalesce(p_permission, location_permission),
    location_updated_at = now(),
    updated_at          = now()
  where id = v_uid;

  -- Mirror onto user_workout_schedules if exists
  update public.user_workout_schedules
  set
    timezone     = v_clean_tz,
    country      = coalesce(p_country, country),
    country_code = coalesce(p_country_code, country_code),
    region       = coalesce(p_region, region),
    city         = coalesce(p_city, city),
    latitude     = coalesce(p_lat, latitude),
    longitude    = coalesce(p_lng, longitude),
    updated_at   = now()
  where user_id = v_uid;

  -- Re-derive tailored reminder with fresh location/timezone context
  perform public.generate_workout_goal_reminder(v_uid);

  return jsonb_build_object(
    'ok', true,
    'timezone', v_clean_tz,
    'country', p_country,
    'region', p_region,
    'city', p_city,
    'synced_at', now()
  );
end;
$$;

grant execute on function public.sync_user_location_and_timezone(text, text, text, text, text, numeric, numeric, text) to authenticated;

-- ─── 6. Client RPC: save_workout_schedule_and_exercises ──────────────────────

create or replace function public.save_workout_schedule_and_exercises(
  p_workout_time       text,
  p_workout_days       text[],
  p_selected_exercises jsonb default '[]'::jsonb,
  p_reminder_enabled   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles;
  v_tz       text;
  v_reminder jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  v_tz := coalesce(nullif(v_profile.timezone, ''), 'UTC');

  insert into public.user_workout_schedules (
    user_id,
    workout_time,
    workout_days,
    selected_exercises,
    reminder_enabled,
    timezone,
    country,
    country_code,
    region,
    city,
    latitude,
    longitude,
    updated_at
  ) values (
    v_uid,
    coalesce(nullif(p_workout_time, ''), '07:00 AM'),
    coalesce(p_workout_days, array['Monday','Wednesday','Friday']),
    coalesce(p_selected_exercises, '[]'::jsonb),
    coalesce(p_reminder_enabled, true),
    v_tz,
    v_profile.country,
    v_profile.country_code,
    v_profile.region,
    v_profile.city,
    v_profile.latitude,
    v_profile.longitude,
    now()
  )
  on conflict (user_id) do update set
    workout_time       = excluded.workout_time,
    workout_days       = excluded.workout_days,
    selected_exercises = excluded.selected_exercises,
    reminder_enabled   = excluded.reminder_enabled,
    timezone           = coalesce(excluded.timezone, user_workout_schedules.timezone),
    country            = coalesce(excluded.country, user_workout_schedules.country),
    country_code       = coalesce(excluded.country_code, user_workout_schedules.country_code),
    region             = coalesce(excluded.region, user_workout_schedules.region),
    city               = coalesce(excluded.city, user_workout_schedules.city),
    latitude           = coalesce(excluded.latitude, user_workout_schedules.latitude),
    longitude          = coalesce(excluded.longitude, user_workout_schedules.longitude),
    updated_at         = now();

  -- Auto-generate updated goal & workout reminder notification
  v_reminder := public.generate_workout_goal_reminder(v_uid);

  return jsonb_build_object(
    'ok', true,
    'schedule', jsonb_build_object(
      'workout_time', coalesce(nullif(p_workout_time, ''), '07:00 AM'),
      'workout_days', coalesce(p_workout_days, array['Monday','Wednesday','Friday']),
      'selected_exercises', coalesce(p_selected_exercises, '[]'::jsonb),
      'reminder_enabled', coalesce(p_reminder_enabled, true),
      'timezone', v_tz
    ),
    'reminder', v_reminder
  );
end;
$$;

grant execute on function public.save_workout_schedule_and_exercises(text, text[], jsonb, boolean) to authenticated;

-- ─── 7. Client RPC: get_user_workout_schedule ────────────────────────────────

create or replace function public.get_user_workout_schedule()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles;
  v_schedule  public.user_workout_schedules;
  v_reminder  public.workout_reminders;
  v_targets   public.user_targets;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  select * into v_schedule from public.user_workout_schedules where user_id = v_uid;
  select * into v_targets from public.user_targets where user_id = v_uid;
  select * into v_reminder from public.workout_reminders
    where user_id = v_uid and status = 'scheduled'
    order by created_at desc limit 1;

  -- If reminder doesn't exist yet, generate it now
  if v_reminder is null then
    perform public.generate_workout_goal_reminder(v_uid);
    select * into v_reminder from public.workout_reminders
      where user_id = v_uid and status = 'scheduled'
      order by created_at desc limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'location', jsonb_build_object(
      'timezone', coalesce(v_schedule.timezone, v_profile.timezone, 'UTC'),
      'country', coalesce(v_schedule.country, v_profile.country),
      'country_code', coalesce(v_schedule.country_code, v_profile.country_code),
      'region', coalesce(v_schedule.region, v_profile.region),
      'city', coalesce(v_schedule.city, v_profile.city),
      'latitude', coalesce(v_schedule.latitude, v_profile.latitude),
      'longitude', coalesce(v_schedule.longitude, v_profile.longitude),
      'permission', coalesce(v_profile.location_permission, 'unknown')
    ),
    'schedule', case
      when v_schedule is null then jsonb_build_object(
        'workout_time', '07:00 AM',
        'workout_days', array['Monday','Wednesday','Friday'],
        'selected_exercises', '[]'::jsonb,
        'reminder_enabled', true
      )
      else jsonb_build_object(
        'workout_time', v_schedule.workout_time,
        'workout_days', v_schedule.workout_days,
        'selected_exercises', v_schedule.selected_exercises,
        'reminder_enabled', v_schedule.reminder_enabled
      )
    end,
    'targets', case when v_targets is null then '{}'::jsonb else to_jsonb(v_targets) end,
    'reminder', case when v_reminder is null then '{}'::jsonb else to_jsonb(v_reminder) end
  );
end;
$$;

grant execute on function public.get_user_workout_schedule() to authenticated;

-- ─── 8. Trigger: Auto-recompute reminder when body metrics change ────────────

create or replace function public.on_profile_fitness_change_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (NEW.weight_kg is distinct from OLD.weight_kg)
     or (NEW.height_cm is distinct from OLD.height_cm)
     or (NEW.primary_goal is distinct from OLD.primary_goal)
     or (NEW.target_weight_kg is distinct from OLD.target_weight_kg)
     or (NEW.timezone is distinct from OLD.timezone)
  then
    perform public.generate_workout_goal_reminder(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_profile_fitness_change_reminder on public.profiles;
create trigger trg_profile_fitness_change_reminder
after update on public.profiles
for each row execute function public.on_profile_fitness_change_reminder();
