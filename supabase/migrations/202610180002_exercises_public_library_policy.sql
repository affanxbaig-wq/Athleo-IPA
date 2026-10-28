drop policy if exists "exercises_select_authenticated" on public.exercises;

drop policy if exists "exercises_select_public_library" on public.exercises;

drop policy if exists "exercises_insert_authenticated" on public.exercises;
drop policy if exists "exercises_update_authenticated" on public.exercises;
drop policy if exists "exercises_delete_authenticated" on public.exercises;

create policy "exercises_select_public_library" on public.exercises
  for select using (true);

create policy "exercises_insert_authenticated" on public.exercises
  for insert with check (auth.role() = 'authenticated');

create policy "exercises_update_authenticated" on public.exercises
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "exercises_delete_authenticated" on public.exercises
  for delete using (auth.role() = 'authenticated');
