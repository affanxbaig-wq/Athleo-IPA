-- Device-bound auth setup
-- Run this after the base migration is already present.

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  os_version text,
  last_seen_at timestamptz not null default now(),
  is_authorized boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists idx_user_devices_user_id
  on public.user_devices (user_id);

create index if not exists idx_user_devices_authorized
  on public.user_devices (is_authorized, user_id);

alter table public.user_devices enable row level security;

drop policy if exists "user_devices_select_own" on public.user_devices;
create policy "user_devices_select_own"
  on public.user_devices for select
  using (user_id = auth.uid());

drop policy if exists "user_devices_insert_own" on public.user_devices;
create policy "user_devices_insert_own"
  on public.user_devices for insert
  with check (user_id = auth.uid());

drop policy if exists "user_devices_update_own" on public.user_devices;
create policy "user_devices_update_own"
  on public.user_devices for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.is_device_authorized(p_user_id uuid, p_device_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_devices d
    where d.user_id = p_user_id
      and d.device_id = p_device_id
      and d.is_authorized = true
      and d.revoked_at is null
  );
$$;

create or replace function public.register_user_device(
  p_user_id uuid,
  p_device_id text,
  p_device_name text,
  p_platform text,
  p_app_version text,
  p_os_version text
)
returns boolean
language plpgsql
as $$
begin
  insert into public.user_devices (
    user_id,
    device_id,
    device_name,
    platform,
    app_version,
    os_version,
    is_authorized,
    last_seen_at
  ) values (
    p_user_id,
    p_device_id,
    p_device_name,
    p_platform,
    p_app_version,
    p_os_version,
    true,
    now()
  )
  on conflict (user_id, device_id)
  do update set
    device_name = excluded.device_name,
    platform = excluded.platform,
    app_version = excluded.app_version,
    os_version = excluded.os_version,
    is_authorized = true,
    revoked_at = null,
    last_seen_at = now();

  return true;
end;
$$;

create or replace function public.revoke_user_device(p_user_id uuid, p_device_id text)
returns boolean
language plpgsql
as $$
begin
  update public.user_devices
  set revoked_at = now(),
      is_authorized = false,
      last_seen_at = now()
  where user_id = p_user_id and device_id = p_device_id;

  return true;
end;
$$;

create or replace function public.revoke_all_user_devices(p_user_id uuid)
returns boolean
language plpgsql
as $$
begin
  update public.user_devices
  set revoked_at = now(),
      is_authorized = false,
      last_seen_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

select 'device_auth_setup_complete' as status;
