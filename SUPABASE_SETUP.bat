@echo off
REM Supabase Project Linking Script for ATHLEO (Windows PowerShell)

setlocal enabledelayedexpansion

echo ATHLEO Supabase Linking
echo =======================
echo.
echo Step 1: Gather your Supabase project credentials
echo   1. Go to https://app.supabase.com
echo   2. Select your project
echo   3. Go to Settings ^> General
echo   4. Copy: Project Ref (e.g., abc123xyz)
echo   5. Go to Settings ^> API
echo   6. Copy: Project URL (e.g., https://abc123xyz.supabase.co)
echo   7. Copy: anon public key
echo   8. Copy: service_role secret key
echo.
echo Step 2: Create or update .env with real values
echo   (Template created, fill in your real values)
echo.
echo Step 3: Link local Supabase CLI to project
echo   Run: npx supabase link --project-ref YOUR_PROJECT_REF
echo.
echo Step 4: Apply migrations
echo   Run: npx supabase db push
echo.
echo Step 5: Deploy edge functions
echo   Run: npx supabase functions deploy award-xp
echo   Run: npx supabase functions deploy coach
echo   Run: npx supabase functions deploy weekly-macro-adjust
echo   Run: npx supabase functions deploy moderate-content
echo   Run: npx supabase functions deploy health-anomaly-check
echo   Run: npx supabase functions deploy revenuecat-webhook
echo.
echo Step 6: Configure Google OAuth in Supabase dashboard
echo   Settings ^> Authentication ^> Providers ^> Google
echo   Add your Google OAuth credentials
echo.
echo Step 7: Test the app
echo   Use the same SUPABASE_URL and SUPABASE_ANON_KEY in src/config/supabase.ts
echo   Run: npm start
echo.
