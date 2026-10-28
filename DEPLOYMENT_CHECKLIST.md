# ATHLEO Backend Deployment Checklist

Use this checklist to deploy ATHLEO to production with Supabase. **Follow this order exactly.**

## Phase 1: Project Setup (5-10 minutes)

### 1.1 Create Supabase Project
- [ ] Go to https://app.supabase.com
- [ ] Click "New Project"
- [ ] Enter project name: `athleo-prod` or similar
- [ ] Choose region closest to your users
- [ ] Set database password (save securely)
- [ ] Click "Create new project" and wait for initialization

### 1.2 Gather Credentials
Once project is created, go to **Settings > API**:
- [ ] Copy **Project URL** (e.g., `https://abc123xyz.supabase.co`)
- [ ] Copy **anon public key**
- [ ] Copy **service_role secret key**
- [ ] Copy **JWT Secret** from **Settings > General**

### 1.3 Configure Local Environment
```bash
# In d:\Athleo 6\Athleo\.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-jwt-secret
```
- [ ] .env file created with all values
- [ ] .env is in .gitignore (never commit secrets)
- [ ] Test: `supabase status` returns project info

## Phase 2: Database Schema (10-15 minutes)

### 2.1 Link Local CLI to Project
```bash
cd d:\Athleo 6\Athleo
npx supabase link --project-ref YOUR_PROJECT_REF
```
- [ ] CLI linked successfully
- [ ] `supabase status` shows connected

### 2.2 Push Database Migrations
```bash
npx supabase db push
```
- [ ] Migration completes without errors
- [ ] All tables created in Supabase dashboard

### 2.3 Verify Schema
Run in Supabase SQL Editor:
```sql
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname = 'public' ORDER BY tablename;
```
- [ ] All tables listed (profiles, goals, workout_sessions, foods, etc.)
- [ ] Run `supabase/validate_schema.sql` for full validation

## Phase 3: Authentication Setup (10-15 minutes)

### 3.1 Enable Email/Password Auth
In **Settings > Authentication > Providers**:
- [ ] Email enabled
- [ ] Confirm email enabled
- [ ] Auto confirm disabled (users must confirm email)

### 3.2 Set Email Templates
In **Settings > Authentication > Email Templates**:
- [ ] Confirm email template customized (optional)
- [ ] Password reset template customized (optional)

### 3.3 Configure Redirect URLs
In **Settings > Authentication > URL Configuration**:
- [ ] Site URL: `athleo://` or your app's deep link
- [ ] Redirect URLs:
  - [ ] `athleo://auth-callback`
  - [ ] `exp://localhost:19000/--/auth-callback` (for Expo dev)
  - [ ] `athleo://reset-password`

### 3.4 Set Up Google OAuth

**Get Google Credentials:**
1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials > Create OAuth 2.0 Client ID**
   - [ ] For Web: Authorized redirect URIs:
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
   - [ ] Copy **Client ID** and **Client Secret**

**Configure in Supabase:**
1. Settings > Authentication > Providers > Google
   - [ ] Enable Google
   - [ ] Paste Client ID
   - [ ] Paste Client Secret
   - [ ] Save

**Update App Config:**
In `.env`:
```
GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```
- [ ] Google credentials added to .env
- [ ] Credentials also in `src/config/google.ts` for reference

## Phase 4: Storage Setup (5 minutes)

### 4.1 Create Storage Buckets
In **Storage > Buckets > New Bucket**:
- [ ] Create `progress-photos` (private)
- [ ] Create `profile-avatars` (private)
- [ ] Create `meal-photos` (private)
- [ ] Create `workout-videos` (private)

### 4.2 Set Bucket Policies
For each bucket, go to **Policies**:
```
-- Allow authenticated users to upload to their own folder
-- Allow storage.foldername = auth.uid()
```
- [ ] All buckets configured with owner-only upload
- [ ] Public read access only for approved content (optional)

## Phase 5: Edge Functions (10-15 minutes)

### 5.1 Deploy Edge Functions
```bash
npx supabase functions deploy award-xp
npx supabase functions deploy coach
npx supabase functions deploy weekly-macro-adjust
npx supabase functions deploy moderate-content
npx supabase functions deploy health-anomaly-check
npx supabase functions deploy revenuecat-webhook
```
- [ ] All 6 functions deployed successfully
- [ ] No deployment errors
- [ ] Run `supabase functions list` to verify

### 5.2 Test Edge Function
```bash
curl -X POST http://localhost:54321/functions/v1/award-xp \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","event_type":"test","xp_awarded":10}'
```
- [ ] Functions return 200 OK (or expected auth error)
- [ ] No 404 errors

### 5.3 Set Function Secrets
For each function that needs API keys (coach, revenuecat-webhook):
```bash
supabase secrets set OPENAI_API_KEY="your-key"
supabase secrets set REVENUECAT_API_KEY="your-key"
supabase secrets set EDGE_FUNCTION_SECRET="your-secret"
```
- [ ] Secrets set in Supabase project
- [ ] Functions can access via `Deno.env.get('KEY')`

## Phase 6: Seed Data (5 minutes)

### 6.1 Populate Reference Tables
Run seeds via Supabase SQL Editor or app startup:
- [ ] `exercises` table populated (300+ rows)
- [ ] `foods` table populated (1000+ rows)
- [ ] `badges` table populated (20+ badges)
- [ ] `workout_programs` table populated (system templates)
- [ ] `challenges` table populated (starter challenges)

Verify in dashboard:
```sql
SELECT COUNT(*) FROM exercises;
SELECT COUNT(*) FROM foods;
SELECT COUNT(*) FROM badges;
```

## Phase 7: Runtime Feature Verification (10 minutes)

### 7.1 Run Backend Tests
```bash
npm run test-backend
```
- [ ] All tests pass
- [ ] Database connection OK
- [ ] RLS policies working
- [ ] Edge functions accessible
- [ ] Auth endpoints active

### 7.2 Run Validation Script
```bash
npx supabase db lint
```
- [ ] No schema warnings
- [ ] All constraints in place
- [ ] Indexes created for performance

### 7.3 Manual App Test
```bash
npm start
```
- [ ] App starts without errors
- [ ] Supabase config is detected
- [ ] Welcome/Login screen appears
- [ ] Email/password signup works
- [ ] Email/password login works
- [ ] Google login button appears and works
- [ ] Redirect back to app after auth
- [ ] User profile created in `profiles` table

### 7.4 Test Core Workflows
**Workout:**
- [ ] Select a workout program
- [ ] Start a session
- [ ] Log exercises and sets
- [ ] Complete session
- [ ] Verify `xp_events` row created
- [ ] Verify streak updated

**Nutrition:**
- [ ] Log a meal
- [ ] Verify `food_logs` entry created
- [ ] Verify `daily_summaries` updated with calories

**Health:**
- [ ] Log steps or activity
- [ ] Verify `health_samples` entry
- [ ] Verify `daily_summaries` updated

**Profile:**
- [ ] Update profile info
- [ ] Verify `profiles` updated
- [ ] View user dashboard
- [ ] Check XP and badges

## Phase 8: Production Hardening (15 minutes)

### 8.1 Enable Backups
In **Settings > Backups**:
- [ ] Enable automatic backups
- [ ] Set backup frequency (daily recommended)
- [ ] Enable backup restoration (if available)

### 8.2 Configure Monitoring
In **Settings > Monitoring** (if available):
- [ ] Enable error logging
- [ ] Enable request logging
- [ ] Set up alerts for failures

### 8.3 Review RLS Policies
In **SQL Editor**, run validation:
```sql
SELECT tablename, COUNT(*) as policy_count 
FROM pg_policies 
GROUP BY tablename;
```
- [ ] All user-data tables have 4+ policies
- [ ] Sensitive tables (xp_events, subscriptions) block client writes
- [ ] System tables allow authenticated read only

### 8.4 Verify Secrets
```bash
supabase secrets list
```
- [ ] All required secrets are set
- [ ] No placeholder values
- [ ] Service role key is NOT in .env file (only in project secrets)

### 8.5 Test Rate Limiting
Ensure edge functions have rate limiting:
- [ ] `award-xp` blocks repeated calls per user
- [ ] `coach` has quota limits
- [ ] `revenuecat-webhook` verifies signatures

## Phase 9: App Configuration (5 minutes)

### 9.1 Update App Environment
In `src/config/supabase.ts`:
- [ ] SUPABASE_URL points to production project
- [ ] SUPABASE_ANON_KEY is production anon key
- [ ] Both are loaded from .env or environment variables

In `src/config/google.ts`:
- [ ] GOOGLE_WEB_CLIENT_ID matches production credentials
- [ ] GOOGLE_IOS_CLIENT_ID set for iOS builds

### 9.2 Build App
```bash
npm run build
# or
eas build  # if using Expo
```
- [ ] Build succeeds with no errors
- [ ] All configs resolved correctly

## Phase 10: Final Verification (5 minutes)

### 10.1 End-to-End Test
- [ ] Start app from fresh install
- [ ] Sign up with email
- [ ] Confirm email via link
- [ ] Log in
- [ ] Complete workout
- [ ] Log nutrition
- [ ] View dashboard
- [ ] Check streaks and XP

### 10.2 Error Handling
- [ ] Invalid credentials show clear error
- [ ] Network errors handled gracefully
- [ ] Offline mode doesn't crash app
- [ ] Session refresh works

### 10.3 Performance Checks
- [ ] App startup under 3 seconds
- [ ] Dashboard loads under 1 second
- [ ] Exercise search completes under 500ms
- [ ] Navigation is smooth

## Rollback Plan

If something goes wrong:
1. Restore from backup in Supabase dashboard
2. Revert app to previous version
3. Check error logs: `supabase logs`
4. Contact Supabase support if database corruption

## Post-Deployment

- [ ] Monitor error logs daily for first week
- [ ] Set up user feedback channel
- [ ] Plan feature releases
- [ ] Schedule security audits quarterly
- [ ] Update documentation as needed

---

**Status:** ✅ Ready for deployment
**Date:** 2026-10-06
**Version:** 1.0
