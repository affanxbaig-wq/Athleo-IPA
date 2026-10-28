# ATHLEO Backend Implementation Guide

This guide walks you through deploying the complete ATHLEO backend on Supabase with all required features and security controls.

## Overview

ATHLEO uses:
- **Database**: Postgres with 30+ tables covering profiles, workouts, nutrition, health, and social
- **Auth**: Supabase Auth with email/password and Google OAuth
- **Storage**: Buckets for profile avatars, progress photos, and workout content
- **Edge Functions**: 6 Deno functions for server-side business logic
- **RLS**: Row-level security on all user-data tables (default deny)
- **Triggers**: Automatic daily summaries, streak updates, XP awards

## Prerequisites

Before starting:
- [ ] Supabase CLI installed: `npm install -g @supabase/cli`
- [ ] Node.js 18+ installed
- [ ] A Supabase account at https://app.supabase.com
- [ ] Credentials for Google OAuth (optional but recommended)
- [ ] OpenAI API key (optional for AI coach feature)

## 1. Create Supabase Project

Visit https://app.supabase.com and create a new project.

**Save these credentials securely:**
```
Project Ref: abc123xyz
Project URL: https://abc123xyz.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT Secret: super-secret-jwt-key
```

## 2. Configure Local Environment

Create or update `.env` in the project root:

```bash
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com

# AI and External Services (optional)
OPENAI_API_KEY=sk-...
REVENUECAT_API_KEY=your-key
EDGE_FUNCTION_SECRET=super-secret-key
```

**IMPORTANT: Add `.env` to `.gitignore` - never commit secrets!**

## 3. Link Supabase CLI

```bash
cd d:\Athleo\ 6\Athleo
npx supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter your Supabase password or use access token.

Verify:
```bash
npx supabase status
```

## 4. Apply Database Migrations

The complete schema is in `supabase/migrations/202610060001_initial_schema.sql`.

Push to your project:
```bash
npx supabase db push
```

This creates:
- **Profiles & Settings**: User accounts, preferences, goals
- **Workouts**: Programs, sessions, exercises, sets, personal records
- **Nutrition**: Foods, meal plans, logs, daily macros
- **Health**: Steps, sleep, readiness scores, body measurements
- **Social**: Follows, posts, comments, challenges, groups
- **Gamification**: XP events, badges, streaks, leaderboards
- **Admin**: Audit logs, moderation queue, subscriptions, rate limits

Verify in Supabase dashboard SQL Editor:
```sql
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return ~30 tables.

## 5. Verify Row-Level Security

All tables have RLS enabled by default. Policies are restrictive:

```sql
-- Check that RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Count policies per table
SELECT tablename, COUNT(*) as policies 
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

**Key security rules:**
- `profiles`, `workout_sessions`, `food_logs`: Owner-only access
- `exercises`, `foods`, `badges`: Authenticated read-only
- `xp_events`, `subscriptions`, `audit_log`: Server-only (no client writes)

These prevent:
- User A seeing User B's private workout data ✅
- Client-side XP inflation attacks ✅
- Direct subscription status changes ✅
- Unauthorized moderation access ✅

## 6. Configure Authentication

### Email/Password Auth

In Supabase dashboard, **Settings > Authentication > Providers**:

1. Ensure **Email** is enabled
2. Set **Email Confirmations**: Auto-confirm OFF (users confirm via link)
3. Set **SMTP Settings** (optional, for custom emails)

### Google OAuth Setup

**Step 1: Get Google OAuth Credentials**

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials > Create OAuth 2.0 Client ID**
5. Select **Web application**
6. Add Authorized Redirect URIs:
   ```
   https://YOUR_PROJECT.supabase.co/auth/v1/callback
   exp://localhost:19000/--/auth-callback
   athleo://auth-callback
   ```
7. Copy **Client ID** and **Client Secret**

**Step 2: Configure in Supabase**

In dashboard, **Settings > Authentication > Providers**:

1. Click **Google**
2. Enable it
3. Paste **Client ID**
4. Paste **Client Secret**
5. Save

**Step 3: Update App Config**

Update `.env`:
```
GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```

Also update `src/config/google.ts` with the same values.

**Step 4: Test Google Login**

Run the app:
```bash
npm start
```

Click "Sign in with Google" on the Welcome screen. You should:
1. See Google login popup
2. Sign in with a Google account
3. Get redirected back to the app
4. Be logged in with profile created

## 7. Create Storage Buckets

In dashboard, **Storage > Buckets**:

Create these 4 private buckets:

1. **progress-photos**
   - Max file size: 10MB
   - Allowed types: image/* (JPEG, PNG)
   - RLS: Only owner can upload

2. **profile-avatars**
   - Max file size: 5MB
   - Allowed types: image/*
   - RLS: Only owner can upload

3. **meal-photos**
   - Max file size: 10MB
   - Allowed types: image/*
   - RLS: Only owner can upload

4. **workout-videos**
   - Max file size: 100MB
   - Allowed types: video/*
   - RLS: Only owner can upload

For each bucket, add RLS policies in the **Policies** tab:

```sql
-- Allow authenticated users to upload to their own folder
-- Pattern: foldername = auth.uid()

CREATE POLICY "users_can_upload_own_photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'progress-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## 8. Deploy Edge Functions

The app includes 6 server-side functions for privileged operations:

### 8.1 Award XP Function

Awards XP points when users complete workouts (cannot be called from client).

```bash
npx supabase functions deploy award-xp
```

Test:
```bash
curl -X POST http://localhost:54321/functions/v1/award-xp \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-id",
    "event_type": "workout_completed",
    "xp_awarded": 100
  }'
```

### 8.2 AI Coach Function

Provides AI-powered workout and nutrition recommendations.

```bash
npx supabase functions deploy coach
```

Requires `OPENAI_API_KEY` in Supabase project secrets:
```bash
supabase secrets set OPENAI_API_KEY="sk-..."
```

### 8.3 Weekly Macro Adjust Function

Adjusts nutrition targets based on progress.

```bash
npx supabase functions deploy weekly-macro-adjust
```

### 8.4 Moderate Content Function

Flags potentially inappropriate user posts.

```bash
npx supabase functions deploy moderate-content
```

### 8.5 Health Anomaly Check

Detects unusual health metrics (extreme heart rate, etc.).

```bash
npx supabase functions deploy health-anomaly-check
```

### 8.6 RevenueCat Webhook

Handles subscription events from RevenueCat (if using).

```bash
npx supabase functions deploy revenuecat-webhook
```

Requires `REVENUECAT_API_KEY`:
```bash
supabase secrets set REVENUECAT_API_KEY="your-key"
```

### 8.7 Deploy All

Deploy everything at once:
```bash
npm run functions:deploy
```

Verify deployment:
```bash
npx supabase functions list
```

Should show all 6 functions with their URLs.

## 9. Seed Reference Data

The app needs seed data for exercises, foods, badges, and programs.

### Option A: Seed on App Startup

The app seeds data in `src/data/exercises.ts` and `src/data/foods.ts` on first launch.

Data is inserted via:
```typescript
const { error } = await supabase.from('exercises').upsert(exercisesData);
```

### Option B: Seed Manually

Run this in Supabase SQL Editor:

```sql
-- Exercises are pre-seeded in the app
-- Foods are pre-seeded in the app
-- Badges can be seeded here:

INSERT INTO public.badges (code, name, description, icon, criteria_json)
VALUES
  ('first_workout', 'First Step', 'Complete your first workout', '🎯', '{"type":"workout_count","count":1}'),
  ('week_warrior', 'Week Warrior', 'Work out 7 days in a row', '💪', '{"type":"streak","days":7}'),
  ('calorie_counter', 'Calorie Counter', 'Log 100 meals', '📊', '{"type":"food_log_count","count":100}'),
  ('xp_collector', 'XP Collector', 'Earn 10,000 XP', '⭐', '{"type":"xp_total","xp":10000}')
ON CONFLICT (code) DO NOTHING;
```

## 10. Validate Runtime Features

Run the comprehensive test suite:

```bash
npm run backend:validate
```

This checks:
- ✅ Environment variables configured
- ✅ Supabase CLI linked
- ✅ Database migrated
- ✅ RLS policies active
- ✅ Edge functions deployed
- ✅ Auth providers active
- ✅ Storage buckets created

Or run feature tests:
```bash
npm run backend:test
```

This tests:
- ✅ Database connection
- ✅ Exercise catalog loads
- ✅ Food database loads
- ✅ Workout programs load
- ✅ RLS blocks unauthorized access
- ✅ Edge functions are accessible
- ✅ Auth is active
- ✅ Storage buckets exist

## 11. Update App Configuration

Make sure the app points to your Supabase project.

In `src/config/supabase.ts`:
```typescript
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
```

The app will load from `.env` file automatically.

## 12. Test End-to-End

```bash
npm start
```

Then:

1. **Sign Up**
   - Enter email and password
   - Confirm email via link
   - Profile created automatically

2. **Log In**
   - Use credentials from signup
   - Redirected to dashboard

3. **Google Sign-In** (test)
   - Click "Sign in with Google"
   - Sign in with a Google account
   - User profile created
   - Redirected to dashboard

4. **Start Workout**
   - Select a program from library
   - Start a workout session
   - Log exercises and sets
   - Complete session
   - Verify XP awarded

5. **Log Nutrition**
   - Log a meal
   - Enter food and calories
   - Verify in daily summary

6. **Check Profile**
   - View stats, streaks, XP
   - Check badges

7. **Test Offline** (optional)
   - Disconnect internet
   - Try to log data (should queue locally)
   - Reconnect
   - Verify data syncs to server

## 13. Production Security Checklist

Before shipping:

- [ ] All user passwords encrypted (Supabase Auth handles this)
- [ ] Service role key never in app or version control
- [ ] RLS policies block all unauthorized access (test per table)
- [ ] Edge functions verify JWTs before trusting user_id
- [ ] Rate limiting on coach and webhook functions
- [ ] Secrets set in Supabase: `supabase secrets list`
- [ ] Backups enabled: Supabase dashboard > Settings > Backups
- [ ] Monitoring/logging enabled for failed auth and errors
- [ ] Terms of Service and Privacy Policy ready
- [ ] App notarized and signed (iOS/Android)

## 14. Common Issues & Troubleshooting

### "SUPABASE_URL not configured"
- [ ] .env file exists with SUPABASE_URL
- [ ] Value is correct URL (https://project.supabase.co)
- [ ] Restart app after updating .env

### "Auth providers not enabled"
- [ ] Check Supabase dashboard Settings > Authentication > Providers
- [ ] Email/Password must be enabled
- [ ] Google must be configured with correct Client ID/Secret

### "RLS policy 403 error"
- [ ] User is logged in (check supabase.auth.getSession())
- [ ] User is the owner of the data (verify policy)
- [ ] No syntax errors in RLS policy (check Supabase SQL)

### "Edge function not found (404)"
- [ ] Run `supabase functions deploy [name]`
- [ ] Check function exists: `supabase functions list`
- [ ] Verify function name in request URL

### "Google login not working"
- [ ] Verify Google credentials in .env and src/config/google.ts
- [ ] Confirm redirect URL in Google Console includes https://YOUR_PROJECT.supabase.co/auth/v1/callback
- [ ] Test in dashboard first: Settings > Authentication > Providers > Google > Test

### Storage upload fails
- [ ] Verify bucket exists in Storage > Buckets
- [ ] Check file size limits
- [ ] Ensure RLS policy allows authenticated upload
- [ ] Verify user is logged in

## Next Steps

1. **Data Sync**: Implement offline sync strategy using Supabase Realtime
2. **Push Notifications**: Set up push notifications for milestones and social events
3. **Analytics**: Add analytics to track user engagement and feature usage
4. **A/B Testing**: Test different onboarding flows and UI variations
5. **Performance**: Monitor query performance and optimize hot paths
6. **Monetization**: Integrate RevenueCat for premium features

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Community**: https://discord.supabase.com
- **ATHLEO Docs**: See DEPLOYMENT_CHECKLIST.md
- **Status**: https://status.supabase.com

---

**Status**: Ready for Production
**Last Updated**: 2026-10-06
**Version**: 1.0.0
