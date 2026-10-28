# ATHLEO Supabase Backend

This project already contains an initial Postgres schema and Deno edge-function scaffolding. The backend must be deployed in this strict order:

1. Environment and secrets
2. Database schema and migrations
3. RLS policies
4. Storage buckets and policies
5. Seed data and reference lookups
6. Exercise, nutrition, and health logic
7. Edge functions
8. Realtime, sync, and offline workflow
9. Gamification and anti-cheat
10. Subscription and billing
11. Observability and security review

## 1) Environment and secrets

Use a local `.env` file for app development and set the same values in the Supabase project secrets for edge functions.

Required values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (only for coach or AI features)
- `REVENUECAT_API_KEY` (if revenuecat is enabled)
- `EDGE_FUNCTION_SECRET`

Rules:
- Never ship client-side secrets.
- Never put real keys in the app source tree.
- Keep personal or production credentials only in `.env` locally and in Supabase project secrets for deployed functions.

Verification:
- `supabase status`
- `supabase secrets list`
- `supabase functions list`

## 2) Database schema and migrations

The base schema under `supabase/migrations/202610060001_initial_schema.sql` is the foundation. It includes:
- user profiles and settings
- goals and body metrics
- workouts, exercise catalog, sessions, sets, PRs
- foods, nutrition logs, meal plans, water intake
- health data, streaks, summaries, badge logic
- social, challenges, subscriptions, moderation, AI messages

Required migration validation:
- `supabase db reset`
- `supabase db diff --schema public`
- `supabase db push`

Key security requirements:
- all tables must be protected by default deny access unless explicitly allowed
- user data should only be readable by the owner or allowed social context
- sensitive system tables such as `xp_events`, `subscriptions`, `audit_log`, and `rate_limits` must be restricted to service-role or admin contexts
- row-level security must be enabled for every user-owned table

## 3) RLS policies

Policies must be explicit and minimal. The app should not rely on client-side guards for privileged business logic.

Examples:
- `profiles`: owner-only access
- `workout_sessions`, `food_logs`, `health_samples`: owner-only access
- `foods`, `exercises`, `badges`: authenticated user access only
- `xp_events`: client-write blocked; service role only
- `subscriptions`: client-write blocked; server/edge only

Validation:
- Use Supabase SQL editor or local tests to confirm:
  - user A cannot read user B profile data
  - user A cannot update another user’s workout records
  - user A cannot insert `xp_events` directly from the client
  - user A cannot change subscription status from the app

## 4) Storage buckets and policies

Create buckets with least-privilege access:
- `progress-photos`
- `profile-avatars`
- `meal-photos`
- `workout-videos`

Rules:
- authenticated users may upload only to their own folders
- public read only for approved content
- service role can perform moderation cleanup and archival tasks
- never allow public writes

Validation:
- `supabase storage ls`
- `supabase storage inspect` or equivalent bucket policy checks in the dashboard

## 5) Seed data and reference tables

Seed the tables that should be loaded for all users:
- `exercises` master library
- `foods` master list
- `badges`
- `challenges` starter events
- `workout_programs` default templates

Validation:
- verify lookup tables are queryable without user-specific filters
- verify each seed row has required metadata like `name`, `calories`, `category`, and `is_verified`

## 6) Fitness and health logic

The database logic must enforce the rules that the app depends on:
- daily summaries should aggregate food logs, water logs, steps, and workouts
- `evaluate_streak` should update streak state correctly for consecutive activity
- `handle_workout_session_status_change` should award xp on completion
- `create_pr_record_if_needed` should store personal records only when valid
- `get_home_dashboard` should return a compact summary object for the dashboard screen

Validation examples:
- create workout session with `status = 'completed'` and verify xp row inserted
- insert multiple food rows and ensure summary totals are correct
- complete a workout and confirm streak logic runs only once per completion

## 7) Edge functions

Current scaffold exists under `supabase/functions`:
- `award-xp`
- `coach`
- `weekly-macro-adjust`
- `moderate-content`
- `health-anomaly-check`
- `revenuecat-webhook`

Rules:
- use service role only for privileged writes
- validate body payloads with Zod
- verify bearer JWT before trusting the caller
- never trust client-supplied `user_id` values without an authenticated session
- rate-limit or quota-limit AI and webhook routes
- sign and verify external webhook payloads before acting on them

Deployment verification:
- `supabase functions deploy award-xp`
- `supabase functions deploy coach`
- `supabase functions serve`
- `curl -X POST http://localhost:54321/functions/v1/award-xp ...`

## 8) Realtime, sync, and offline workflow

Use Supabase Realtime for:
- live notifications
- progress feed updates
- workout completion events
- group/challenge updates

Rules:
- only publish user-owned data to the user’s channel
- never expose raw private data over public channels
- handle offline sync by storing pending local writes and replaying when online

Validation:
- test that one user receives only their channel events
- confirm offline queue entry is replayed after reconnect

## 9) Gamification and anti-cheat

Protect XP, badges, and challenge systems from client-side abuse:
- `xp_events` should be server-generated and write-blocked at the client
- badge unlocks should be computed on the server
- challenge progress should be validated server-side
- repeated event spam should be prevented by unique constraints and rate limiting

Validation:
- repeated `workout_completed` triggers must not create duplicate XP rows
- a user cannot artificially inflate challenge progress by sending direct inserts

## 10) Subscription and billing

The app uses subscription state and should rely on Stripe or RevenueCat webhooks.

Rules:
- do not allow client writes to `subscriptions`
- store only billing metadata and entitlement state in server-controlled tables
- verify webhook signatures before updating entitlements
- map local app features to server-authoritative status

Validation:
- webhook request with invalid signature must be rejected
- valid webhook must update the user entitlement and current period end

## 11) Security review and observability

Final checks before production:
- verify all tables have RLS enabled
- verify default deny is enforced for new tables
- verify `service_role` keys remain server-only
- monitor failed auth requests, moderation queue actions, and webhook anomalies
- add audit log entries for privileged operations
- set row-level policies for moderation and admin actions separately from normal user flows

Required commands:
- `supabase db lint`
- `supabase db diff`
- `supabase functions logs list`
- `supabase logs` or dashboard log inspection

## Deployment checklist

Use this exact order in production:

1. Create Supabase project
2. Set env and secrets
3. Apply migrations
4. Enable Auth providers
5. Configure Storage buckets
6. Create edge functions
7. Deploy functions
8. Verify RLS
9. Seed data
10. Validate app login flows
11. Test workout, nutrition, and challenge flows
12. Turn on monitoring and alerts

This keeps the backend safe, auditable, and aligned with the ATHLEO product model.
