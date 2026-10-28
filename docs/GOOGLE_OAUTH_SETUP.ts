/**
 * Google OAuth Setup Guide for ATHLEO
 *
 * This guide walks through setting up Google Sign-In for web and mobile.
 */

// STEP 1: Create Google OAuth credentials
// =========================================
//
// 1. Go to https://console.cloud.google.com
// 2. Create a new project or select existing
// 3. Enable Google+ API
// 4. Go to Credentials > Create OAuth 2.0 Client ID
//
// For Web (React Native Expo/Android):
//   - Application type: Web application
//   - Authorized redirect URIs:
//       https://YOUR_PROJECT.supabase.co/auth/v1/callback
//   - Copy: Client ID (ends with .apps.googleusercontent.com)
//   - Copy: Client Secret
//
// For iOS (React Native iOS):
//   - Application type: iOS
//   - Bundle ID: com.athleo (or your app bundle)
//   - Copy: Client ID
//
// STEP 2: Configure Supabase Google Provider
// =============================================
//
// 1. Go to https://app.supabase.com > Your Project
// 2. Settings > Authentication > Providers
// 3. Enable "Google"
// 4. Paste your Google OAuth Client ID and Client Secret
// 5. Set Authorized redirect URLs:
//    https://YOUR_PROJECT.supabase.co/auth/v1/callback
//    exp://localhost:19000/--/auth-callback (for Expo)
//    athleo://auth-callback (for native)
//
// STEP 3: Update ATHLEO .env
// ===========================
//
// GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
// GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
//
// STEP 4: Test Google Login
// ===========================
//
// Use Supabase dashboard or run test code:
//
// const { data, error } = await supabase.auth.signInWithOAuth({
//   provider: 'google',
//   options: {
//     redirectTo: 'athleo://auth-callback',
//   },
// });
//
// STEP 5: Verify in App
// ======================
//
// Run: npm start
// Try: Click "Sign in with Google" on the Welcome screen
// Expected: Google login popup appears
// After: User should be logged in to ATHLEO

export const GOOGLE_OAUTH_SETUP = {
  webClientId:
    process.env.GOOGLE_WEB_CLIENT_ID ||
    'your-google-web-client-id.apps.googleusercontent.com',
  iosClientId:
    process.env.GOOGLE_IOS_CLIENT_ID ||
    'your-google-ios-client-id.apps.googleusercontent.com',
  redirectUrl: 'athleo://auth-callback',
  scopes: ['profile', 'email'],
};
