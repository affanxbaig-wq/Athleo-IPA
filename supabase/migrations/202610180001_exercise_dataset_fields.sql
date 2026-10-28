alter table public.exercises
  add column if not exists source_id text,
  add column if not exists body_part text,
  add column if not exists target_muscle text,
  add column if not exists image_url text,
  add column if not exists gif_url text,
  add column if not exists data_license text,
  add column if not exists media_status text,
  add column if not exists animation jsonb default '{}'::jsonb,
  add column if not exists source_dataset text default 'flow-exercise-dataset';

create unique index if not exists exercises_source_id_unique
  on public.exercises(source_id)
  where source_id is not null;

create index if not exists exercises_body_part_idx
  on public.exercises(body_part);

create index if not exists exercises_target_muscle_idx
  on public.exercises(target_muscle);
