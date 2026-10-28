# Athleo Supabase Auth + Passkey Setup

## 1. Required Supabase Auth settings

In the Supabase Dashboard:

- Go to Authentication > URL Configuration
- Set site URL to your live app URL or local web origin
- Add redirect URLs such as:
  - `athleo://auth-callback`
  - `exp://localhost:19000`
  - `http://localhost:3000`

For native Android/iOS builds, the app deep link must be registered and match the redirect URI used in the client.

## 2. Database migration

Apply the migration files in this order:

1. `supabase/migrations/202610060001_initial_schema.sql`
2. `supabase/migrations/202610060002_passkey_security.sql`

Then run:

- `supabase db push`
- `supabase db lint`

## 3. Passkey / WebAuthn requirements

Passkeys require:

- WebAuthn enabled in Supabase Auth
- A valid domain or deep link for the app's origin
- Mobile/desktop browser support for WebAuthn
- A secure session before passkey registration or sign-in

Notes:

- In native mobile apps, this usually works through a session-based auth flow with the Supabase client and a valid redirect URL.
- If the backend rejects the request, the most common issue is that the Supabase Auth project has not enabled or configured WebAuthn/passkeys correctly.

## 4. SQL validation

Run the following after migration:

```sql
select * from public.user_security limit 10;
select * from pg_policies where schemaname='public';
```

## 5. App-side behavior

The app now calls the following Supabase flows when supported:

- `supabase.auth.signInWithPasskey({ options })`
- `supabase.auth.registerPasskey({ options })`

If passkey support is not available on the device or backend, the app falls back to biometric login and email/password login.
