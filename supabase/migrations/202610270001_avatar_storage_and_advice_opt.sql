-- 1. Avatars Storage Bucket Setup
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. RLS Policies for Avatars Bucket
-- Allow public access to read avatars
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update/delete their own avatar
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Optimize get_user_advice RPC
-- Remove redundant refresh_user_insights call because the trigger on profiles already handles it.
-- Advice for activity will be refreshed periodically or on significant data changes, not on every read.
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

  -- Logic: We only refresh if data is older than 4 hours to avoid heavy recomputes on every app open.
  -- Most profile-based targets are already refreshed via trigger on 'profiles' table.
  if not exists (
    select 1 from public.profiles 
    where id = v_uid 
    and insights_updated_at > now() - interval '4 hours'
  ) then
    perform public.refresh_user_insights(v_uid);
  end if;

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
