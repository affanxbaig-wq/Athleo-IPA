-- Migration: 202610220002_challenge_participants_table_fix.sql
-- Fixes the challenge_participants table to include score if missing

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='challenge_participants' and column_name='score') then
    alter table public.challenge_participants add column score integer not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name='challenge_participants' and column_name='display_name') then
    alter table public.challenge_participants add column display_name text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='challenge_participants' and column_name='score_label') then
    alter table public.challenge_participants add column score_label text;
  end if;
end $$;

create index if not exists idx_challenge_participants_score
  on public.challenge_participants (challenge_id, score desc);

alter table public.challenge_participants enable row level security;

drop policy if exists "challenge_participants_select" on public.challenge_participants;
create policy "challenge_participants_select"
  on public.challenge_participants for select using (true);

drop policy if exists "challenge_participants_upsert_own" on public.challenge_participants;
create policy "challenge_participants_upsert_own"
  on public.challenge_participants for all using (user_id = auth.uid()) with check (user_id = auth.uid());
