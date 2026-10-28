-- Passkey + biometric security support for Athleo
-- This adds a user-owned security record, keeps passkey state in the database,
-- and enables the app to record secure authentication state on the backend.

create table if not exists public.user_security (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  passkey_enabled boolean not null default false,
  biometric_login_enabled boolean not null default true,
  last_passkey_registered_at timestamptz,
  security_level text not null default 'standard' check (security_level in ('standard','enhanced','premium')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_security_passkey_enabled
  on public.user_security (passkey_enabled, user_id);

alter table public.user_security enable row level security;

create policy "user_security_select_own"
  on public.user_security for select
  using (user_id = auth.uid());

create policy "user_security_insert_own"
  on public.user_security for insert
  with check (user_id = auth.uid());

create policy "user_security_update_own"
  on public.user_security for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.handle_new_profile_security()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_security(user_id, passkey_enabled, biometric_login_enabled, security_level)
  values (new.id, false, true, 'standard')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger profiles_create_security_record
after insert on public.profiles
for each row execute function public.handle_new_profile_security();

create or replace function public.mark_passkey_registered(p_user_id uuid)
returns void
language sql
as $$
  update public.user_security
  set passkey_enabled = true,
      security_level = 'enhanced',
      last_passkey_registered_at = now(),
      updated_at = now()
  where user_id = p_user_id;
$$;

create or replace function public.mark_passkey_removed(p_user_id uuid)
returns void
language sql
as $$
  update public.user_security
  set passkey_enabled = false,
      security_level = case
        when biometric_login_enabled then 'standard'
        else 'standard'
      end,
      updated_at = now()
  where user_id = p_user_id;
$$;

create or replace function public.update_security_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_security_set_updated_at
before update on public.user_security
for each row execute function public.update_security_updated_at();

-- Notes for Supabase Dashboard configuration:
-- 1. Enable WebAuthn / Passkeys in Authentication > Providers.
-- 2. Set site URL to your app's deep link host, e.g. athleo://auth-callback.
-- 3. Ensure the app uses the same auth redirect URLs configured in config.toml.
-- 4. For native Android/iOS builds, keep the auth callback and deep link domains aligned.
