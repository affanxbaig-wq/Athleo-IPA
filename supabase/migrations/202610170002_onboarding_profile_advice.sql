-- ─────────────────────────────────────────────────────────────────────────────
-- 202610170002_onboarding_profile_advice.sql
--
-- Closes the onboarding → profile → personalised targets → coaching loop.
--
--   1. `profiles` gains the columns the app has been writing since day one but
--      which were never migrated (`display_name`, `email`, `onboarding_complete`),
--      plus the body-metric / preference fields collected during onboarding and
--      a raw `onboarding_answers` jsonb bag so no answer is ever lost.
--   2. `user_targets`    — one row per user: calorie / macro / water / step
--                          targets derived from the onboarding answers.
--   3. `fitness_advice`  — personalised, data-driven coaching cards generated
--                          from the profile + the last 7 days of activity.
--   4. The derivation lives in SQL (Mifflin-St Jeor BMR → TDEE → targets) and is
--      wired to `profiles` with a trigger, so ANY client that writes a profile
--      automatically gets targets + advice recomputed for it.
--   5. `public.get_user_advice()` — the single RPC the app calls to read
--      targets + today's numbers + advice in one round trip.
--
-- Idempotent: every statement is `if not exists` / `create or replace`, and all
-- policies are dropped before being recreated.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. profiles: onboarding answers + body metrics ──────────────────────────

alter table public.profiles
  add column if not exists display_name        text,
  add column if not exists email               text,
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists weight_kg           numeric(5,2),
  add column if not exists target_weight_kg    numeric(5,2),
  add column if not exists primary_goal        text,
  add column if not exists activity_level      text,
  add column if not exists fitness_level       text,
  add column if not exists workout_frequency   integer,
  add column if not exists daily_activity      integer,
  add column if not exists onboarding_answers  jsonb not null default '{}'::jsonb,
  add column if not exists insights_updated_at timestamptz;

-- Backfill: existing rows written before this migration only ever had full_name.
update public.profiles
set display_name = full_name
where display_name is null and full_name is not null;

-- ─── 2. user_targets ─────────────────────────────────────────────────────────

create table if not exists public.user_targets (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  calorie_target       integer not null default 2200,
  protein_target_g     integer not null default 120,
  carb_target_g        integer not null default 250,
  fat_target_g         integer not null default 70,
  water_target_ml      integer not null default 2500,
  steps_target         integer not null default 10000,
  active_energy_target integer not null default 500,
  bmr                  integer,
  tdee                 integer,
  bmi                  numeric(5,2),
  computed_at          timestamptz not null default now()
);

alter table public.user_targets enable row level security;

drop policy if exists "user_targets_select_own" on public.user_targets;
create policy "user_targets_select_own"
  on public.user_targets for select using (user_id = auth.uid());

drop policy if exists "user_targets_insert_own" on public.user_targets;
create policy "user_targets_insert_own"
  on public.user_targets for insert with check (user_id = auth.uid());

drop policy if exists "user_targets_update_own" on public.user_targets;
create policy "user_targets_update_own"
  on public.user_targets for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── 3. fitness_advice ───────────────────────────────────────────────────────

create table if not exists public.fitness_advice (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null check (category in (
               'steps','calories','nutrition','training','recovery','hydration','consistency'
             )),
  title      text not null,
  body       text not null,
  priority   integer not null default 1,
  metric     text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_fitness_advice_user
  on public.fitness_advice (user_id, priority desc, created_at desc);

alter table public.fitness_advice enable row level security;

drop policy if exists "fitness_advice_select_own" on public.fitness_advice;
create policy "fitness_advice_select_own"
  on public.fitness_advice for select using (user_id = auth.uid());

drop policy if exists "fitness_advice_insert_own" on public.fitness_advice;
create policy "fitness_advice_insert_own"
  on public.fitness_advice for insert with check (user_id = auth.uid());

drop policy if exists "fitness_advice_update_own" on public.fitness_advice;
create policy "fitness_advice_update_own"
  on public.fitness_advice for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "fitness_advice_delete_own" on public.fitness_advice;
create policy "fitness_advice_delete_own"
  on public.fitness_advice for delete using (user_id = auth.uid());

-- ─── 4. Derivation helpers ───────────────────────────────────────────────────

-- Maps the onboarding "how active are you day to day" slider (0-100) onto the
-- five activity bands used by the targets engine.
create or replace function public.derive_activity_level(p_daily integer)
returns text
language sql
immutable
as $$
  select case
    when p_daily is null then 'moderate'
    when p_daily < 25  then 'sedentary'
    when p_daily < 45  then 'light'
    when p_daily < 65  then 'moderate'
    when p_daily < 85  then 'active'
    else 'athlete'
  end;
$$;

create or replace function public.activity_multiplier(p_level text)
returns numeric
language sql
immutable
as $$
  select case coalesce(p_level, 'moderate')
    when 'sedentary' then 1.200
    when 'light'     then 1.375
    when 'active'    then 1.725
    when 'athlete'   then 1.900
    else 1.550
  end::numeric;
$$;

-- Step goal implied by the activity band, nudged up when the goal is fat loss.
create or replace function public.step_target_for(p_level text, p_goal text)
returns integer
language sql
immutable
as $$
  select (
    case coalesce(p_level, 'moderate')
      when 'sedentary' then 6000
      when 'light'     then 8000
      when 'active'    then 12000
      when 'athlete'   then 14000
      else 10000
    end
    + case when p_goal = 'weight_loss' then 2000 else 0 end
  );
$$;

-- ─── 5. recompute_user_targets ───────────────────────────────────────────────
-- Mifflin-St Jeor BMR → TDEE (activity multiplier) → goal-adjusted calories →
-- macro split → water + step targets. Everything is clamped to sane ranges so a
-- half-filled profile can never produce a dangerous number.

create or replace function public.recompute_user_targets(p_user_id uuid)
returns public.user_targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles;
  v_age      integer;
  v_sex      text;
  v_weight   numeric;
  v_height   numeric;
  v_bmr      numeric;
  v_tdee     numeric;
  v_goal     text;
  v_level    text;
  v_adjust   numeric;
  v_kcal     numeric;
  v_protein  numeric;
  v_fat_g    numeric;
  v_carb_g   numeric;
  v_water    integer;
  v_steps    integer;
  v_result   public.user_targets;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return null;
  end if;

  v_sex    := case when v_profile.sex in ('male','female') then v_profile.sex else 'other' end;
  v_weight := coalesce(nullif(v_profile.weight_kg, 0), 72);
  v_height := coalesce(nullif(v_profile.height_cm, 0), 176);
  v_age    := case
                when v_profile.date_of_birth is not null
                  then greatest(14, least(90, extract(year from age(v_profile.date_of_birth))::int))
                else 30
              end;
  v_goal   := coalesce(v_profile.primary_goal, 'general_fitness');
  v_level  := coalesce(v_profile.activity_level, public.derive_activity_level(v_profile.daily_activity));

  -- Mifflin-St Jeor
  v_bmr := (10 * v_weight) + (6.25 * v_height) - (5 * v_age)
           + case v_sex when 'male' then 5 when 'female' then -161 else -78 end;

  v_tdee := v_bmr * public.activity_multiplier(v_level);

  v_adjust := case v_goal
                when 'weight_loss'     then -400
                when 'muscle_gain'     then  250
                when 'performance'     then  150
                else 0
              end;

  v_kcal := greatest(1200, round(v_tdee + v_adjust));

  -- Protein scales with body weight and goal; fat is 25% of energy; carbs fill
  -- whatever is left. Clamped so the three macros always add up sensibly.
  v_protein := round(
    v_weight * case v_goal
                 when 'weight_loss' then 2.0
                 when 'muscle_gain' then 1.8
                 when 'performance' then 1.6
                 else 1.2
               end
  );
  v_fat_g   := greatest(35, round(v_kcal * 0.25 / 9));
  v_carb_g  := greatest(60, round((v_kcal - (v_protein * 4) - (v_fat_g * 9)) / 4));

  v_water := greatest(1500, (round(v_weight * 35 / 100) * 100)::int);
  v_steps := public.step_target_for(v_level, v_goal);

  insert into public.user_targets (
    user_id, calorie_target, protein_target_g, carb_target_g, fat_target_g,
    water_target_ml, steps_target, active_energy_target, bmr, tdee, bmi, computed_at
  )
  values (
    p_user_id, v_kcal::int, v_protein::int, v_carb_g::int, v_fat_g::int,
    v_water, v_steps, round(v_steps * v_weight * 0.00055)::int,
    round(v_bmr)::int, round(v_tdee)::int,
    round((v_weight / greatest(1, power(v_height / 100.0, 2)))::numeric, 2),
    now()
  )
  on conflict (user_id) do update set
    calorie_target       = excluded.calorie_target,
    protein_target_g     = excluded.protein_target_g,
    carb_target_g        = excluded.carb_target_g,
    fat_target_g         = excluded.fat_target_g,
    water_target_ml      = excluded.water_target_ml,
    steps_target         = excluded.steps_target,
    active_energy_target = excluded.active_energy_target,
    bmr                  = excluded.bmr,
    tdee                 = excluded.tdee,
    bmi                  = excluded.bmi,
    computed_at          = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- ─── 6. generate_user_advice ─────────────────────────────────────────────────
-- Rebuilds the user's advice cards from their targets plus the last 7 days of
-- activity / nutrition / sleep / streak data.

create or replace function public.generate_user_advice(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile      public.profiles;
  v_targets      public.user_targets;
  v_days         integer := 0;
  v_avg_steps    numeric := 0;
  v_avg_water    numeric := 0;
  v_avg_kcal     numeric := 0;
  v_avg_protein  numeric := 0;
  v_avg_sleep_h  numeric := 0;
  v_streak       integer := 0;
  v_goal         text;
  v_level        text;
  v_freq         integer;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  select * into v_targets from public.user_targets where user_id = p_user_id;

  select count(*)::int,
         coalesce(avg(steps), 0),
         coalesce(avg(water_ml), 0),
         coalesce(avg(calories_consumed), 0)
    into v_days, v_avg_steps, v_avg_water, v_avg_kcal
  from public.daily_activity
  where user_id = p_user_id and date >= current_date - 6;

  select coalesce(avg(protein_g), 0)
    into v_avg_protein
  from public.daily_summaries
  where user_id = p_user_id and date >= current_date - 6;

  select coalesce(avg(total_minutes), 0) / 60.0
    into v_avg_sleep_h
  from public.sleep_logs
  where user_id = p_user_id and date >= current_date - 6;

  select coalesce(current_streak, 0) into v_streak
  from public.streaks where user_id = p_user_id;

  v_goal  := coalesce(v_profile.primary_goal, 'general_fitness');
  v_level := coalesce(v_profile.activity_level, public.derive_activity_level(v_profile.daily_activity));
  v_freq  := coalesce(v_profile.workout_frequency, 3);

  delete from public.fitness_advice where user_id = p_user_id;

  -- ── steps ────────────────────────────────────────────────────────────────
  if v_days = 0 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'steps', 'Start counting your steps',
      format('Your daily step target is %s. Keep the pedometer running so the sensor can count automatically — even with the app in the background.',
             coalesce(v_targets.steps_target, 10000)),
      3, 'steps'
    );
  elsif v_avg_steps >= coalesce(v_targets.steps_target, 10000) then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'steps', 'You are beating your step goal',
      format('You are averaging %s steps a day against a %s target. Hold this rhythm and add one extra 15-minute walk to keep progressing.',
             round(v_avg_steps), coalesce(v_targets.steps_target, 10000)),
      3, 'steps'
    );
  else
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'steps', 'Close the step gap',
      format('You are averaging %s steps a day, about %s short of your %s target. Two 10-minute walks — one after lunch, one after dinner — close most of that gap.',
             round(v_avg_steps),
             greatest(0, coalesce(v_targets.steps_target, 10000) - round(v_avg_steps)),
             coalesce(v_targets.steps_target, 10000)),
      4, 'steps'
    );
  end if;

  -- ── calories ─────────────────────────────────────────────────────────────
  if v_days = 0 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'calories', 'Your daily energy budget',
      format('Based on your body data your daily calorie target is %s kcal.', coalesce(v_targets.calorie_target, 2200)),
      3, 'calories'
    );
  elsif v_goal = 'weight_loss' and v_avg_kcal > coalesce(v_targets.calorie_target, 2200) + 150 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'calories', 'You are eating above your fat-loss budget',
      format('Your 7-day average is %s kcal against a %s kcal target. Trimming roughly %s kcal a day — one sugary drink or a late snack — puts you back in a deficit.',
             round(v_avg_kcal), coalesce(v_targets.calorie_target, 2200),
             round(v_avg_kcal - coalesce(v_targets.calorie_target, 2200))),
      5, 'calories'
    );
  elsif v_goal = 'muscle_gain' and v_avg_kcal < coalesce(v_targets.calorie_target, 2200) - 200 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'calories', 'Eat enough to build muscle',
      format('Your 7-day average is %s kcal — about %s below the %s kcal you need to gain. Add a protein-rich meal or shake around training.',
             round(v_avg_kcal), round(coalesce(v_targets.calorie_target, 2200) - v_avg_kcal),
             coalesce(v_targets.calorie_target, 2200)),
      5, 'calories'
    );
  else
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'calories', 'Energy intake is on target',
      format('Your 7-day average of %s kcal sits well against your %s kcal target. Consistency here is what drives results.',
             round(v_avg_kcal), coalesce(v_targets.calorie_target, 2200)),
      2, 'calories'
    );
  end if;

  -- ── nutrition (protein) ──────────────────────────────────────────────────
  if coalesce(v_targets.protein_target_g, 0) > 0 then
    if v_avg_protein > 0 and v_avg_protein < v_targets.protein_target_g * 0.8 then
      insert into public.fitness_advice(user_id, category, title, body, priority, metric)
      values (
        p_user_id, 'nutrition', 'Protein is your weak link',
        format('You are averaging %s g of protein against a %s g target. Add a palm-sized serving of chicken, fish, eggs, daal or yoghurt to each main meal.',
               round(v_avg_protein), v_targets.protein_target_g),
        5, 'protein_g'
      );
    else
      insert into public.fitness_advice(user_id, category, title, body, priority, metric)
      values (
        p_user_id, 'nutrition', 'Protein target: %s g a day',
        format('Spread %s g of protein evenly across 3-4 meals — roughly %s g per meal — to support recovery and keep hunger stable.',
               v_targets.protein_target_g, round(v_targets.protein_target_g / 4.0)),
        2, 'protein_g'
      );
    end if;
  end if;

  -- ── hydration ────────────────────────────────────────────────────────────
  if v_days > 0 and v_avg_water > 0 and v_avg_water < coalesce(v_targets.water_target_ml, 2500) * 0.8 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'hydration', 'Drink more water',
      format('You are averaging %s ml a day against a %s ml target. Keep a bottle within reach and finish one before every meal.',
             round(v_avg_water), coalesce(v_targets.water_target_ml, 2500)),
      4, 'water_ml'
    );
  else
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'hydration', 'Hydration goal: %s ml a day',
      format('Aim for %s ml of water daily%s.',
             coalesce(v_targets.water_target_ml, 2500),
             case when v_goal = 'weight_loss' then ', plus 500 ml on training days' else '' end),
      1, 'water_ml'
    );
  end if;

  -- ── training ─────────────────────────────────────────────────────────────
  insert into public.fitness_advice(user_id, category, title, body, priority, metric)
  values (
    p_user_id, 'training',
    case v_goal
      when 'muscle_gain' then format('Train for muscle, %s days a week', v_freq)
      when 'weight_loss' then 'Protect muscle while losing fat'
      when 'performance' then 'Build your engine'
      else 'Keep training consistently'
    end,
    case v_goal
      when 'muscle_gain' then format('Hit the gym %s days a week with 3-4 sets of 6-12 reps on the big lifts, keeping 1-2 reps in reserve. Progressive overload beats more volume.', v_freq)
      when 'weight_loss' then format('Lift %s days a week to preserve muscle while you lose fat. Pair it with your %s step target and keep cardio low-impact on recovery days.', v_freq, coalesce(v_targets.steps_target, 10000))
      when 'performance' then format('Structure %s sessions a week: two interval days and one longer steady effort. Your calorie target of %s kcal already covers the extra work.', v_freq, coalesce(v_targets.calorie_target, 2200))
      when 'general_fitness' then format('%s sessions a week is a strong base. Mix two strength days with one mobility or cardio day and keep the habit unbroken.', v_freq)
      else format('Train %s days a week, mixing strength, mobility and easy cardio. As a %s, your fastest wins come from showing up every week.', v_freq, v_level)
    end,
    2, 'workouts'
  );

  -- ── recovery ─────────────────────────────────────────────────────────────
  if v_avg_sleep_h > 0 then
    if v_avg_sleep_h < 7 then
      insert into public.fitness_advice(user_id, category, title, body, priority, metric)
      values (
        p_user_id, 'recovery', 'Sleep is limiting your results',
        format('You are averaging %s hours a night. Move your bedtime 30 minutes earlier this week — recovery is where the training adaptation actually happens.',
               round(v_avg_sleep_h * 10) / 10.0),
        4, 'sleep_hours'
      );
    else
      insert into public.fitness_advice(user_id, category, title, body, priority, metric)
      values (
        p_user_id, 'recovery', 'Recovery is dialled in',
        format('Averaging %s hours of sleep a night is exactly what your %s training load needs. Keep it there.',
               round(v_avg_sleep_h * 10) / 10.0, v_level),
        1, 'sleep_hours'
      );
    end if;
  else
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'recovery', 'Log your sleep',
      format('Aim for 7-9 hours a night. %s-level training only pays off when recovery keeps up, so log sleep for a week to get a read on it.', v_level),
      1, 'sleep_hours'
    );
  end if;

  -- ── consistency ──────────────────────────────────────────────────────────
  if v_streak >= 7 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'consistency', format('%s-day streak — keep it alive', v_streak),
      'Long streaks are the single strongest predictor of results. Even a short session counts on a busy day.',
      3, 'streak'
    );
  elsif v_streak > 0 then
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'consistency', format('You are on a %s-day streak', v_streak),
      'Hit seven days in a row and the habit starts to lock in. Log at least one action today — a walk counts.',
      3, 'streak'
    );
  else
    insert into public.fitness_advice(user_id, category, title, body, priority, metric)
    values (
      p_user_id, 'consistency', 'Build your first streak',
      "Log any activity today to start a streak. The goal isn't perfection — it's never missing twice in a row.",
      3, 'streak'
    );
  end if;
end;
$$;

-- ─── 7. refresh_user_insights ────────────────────────────────────────────────

create or replace function public.refresh_user_insights(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  perform public.recompute_user_targets(p_user_id);
  perform public.generate_user_advice(p_user_id);

  update public.profiles
  set insights_updated_at = now()
  where id = p_user_id;
end;
$$;

-- ─── 8. Trigger: recompute whenever the profile inputs change ────────────────

create or replace function public.profiles_refresh_insights()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only worth recomputing when an input the engine actually reads has changed.
  if tg_op = 'INSERT' then
    perform public.refresh_user_insights(NEW.id);
    return NEW;
  end if;

  if NEW.weight_kg         is distinct from OLD.weight_kg
     or NEW.height_cm        is distinct from OLD.height_cm
     or NEW.date_of_birth    is distinct from OLD.date_of_birth
     or NEW.sex              is distinct from OLD.sex
     or NEW.primary_goal     is distinct from OLD.primary_goal
     or NEW.activity_level   is distinct from OLD.activity_level
     or NEW.daily_activity   is distinct from OLD.daily_activity
     or NEW.fitness_level    is distinct from OLD.fitness_level
     or NEW.workout_frequency is distinct from OLD.workout_frequency
     or NEW.target_weight_kg is distinct from OLD.target_weight_kg
  then
    perform public.refresh_user_insights(NEW.id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_refresh_insights on public.profiles;
create trigger profiles_refresh_insights
after insert or update on public.profiles
for each row execute function public.profiles_refresh_insights();

-- ─── 9. get_user_advice() — the app-facing RPC ───────────────────────────────
-- Reads the caller's own targets, today's rollup and advice in a single call,
-- refreshing the derived data first so the answer is never stale.

create or replace function public.get_user_advice()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_targets public.user_targets;
  v_today   public.daily_activity;
  v_advice  jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  perform public.refresh_user_insights(v_uid);

  select * into v_targets from public.user_targets where user_id = v_uid;
  select * into v_today from public.daily_activity where user_id = v_uid and date = current_date;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.priority desc, a.created_at), '[]'::jsonb)
    into v_advice
  from public.fitness_advice a
  where a.user_id = v_uid and a.is_active;

  return jsonb_build_object(
    'ok',           true,
    'targets',      case when v_targets is null then '{}'::jsonb else to_jsonb(v_targets) end,
    'today',        case when v_today   is null then '{}'::jsonb else to_jsonb(v_today)   end,
    'advice',       v_advice,
    'generated_at', now()
  );
end;
$$;

grant execute on function public.get_user_advice() to authenticated;

-- ─── 10. Backfill targets + advice for existing profiles ─────────────────────

do $$
declare
  r record;
begin
  for r in
    select id from public.profiles
    where weight_kg is not null and height_cm is not null
  loop
    perform public.refresh_user_insights(r.id);
  end loop;
end $$;
