-- ATHLEO passkey backend setup
-- Run this in the Supabase SQL editor after applying the main migration.

-- 1) Ensure the profile security record exists for current users.
insert into public.user_security(user_id, passkey_enabled, biometric_login_enabled, security_level)
select p.id, false, true, 'standard'
from public.profiles p
on conflict (user_id) do nothing;

-- 2) Enable passkey-friendly redirect configuration if you use deep linking
-- Add in Supabase Auth settings:
--   - site_url: https://app.athleo.fit
--   - additional_redirect_urls:
--       athleo://auth-callback
--       exp://localhost:19000
--       http://localhost:3000

-- 3) Recommended allowlist / validation pattern
-- Keep all passkey registration and login flows inside Auth session context.
-- Do not allow client-side inserts into privileged auth tables.

-- 4) Verify the security table is available
select user_id, passkey_enabled, biometric_login_enabled, security_level, updated_at
from public.user_security
limit 20;

-- 5) Optional admin check to confirm passkey-enabled users
select p.id, p.full_name, us.passkey_enabled, us.last_passkey_registered_at
from public.profiles p
left join public.user_security us on us.user_id = p.id
order by p.created_at desc
limit 50;
