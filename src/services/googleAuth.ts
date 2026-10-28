let GoogleSignin: any = null;
let statusCodes: any = {};

try {
  const googleModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleModule.GoogleSignin;
  statusCodes = googleModule.statusCodes ?? {};
} catch {
  GoogleSignin = null;
  statusCodes = {};
}

import {GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, isGoogleAuthConfigured} from '../config/google';
import {getSupabaseClient} from './auth';
import {isSupabaseConfigured} from '../config/supabase';

export const configureGoogleSignin = async () => {
  if (!isGoogleAuthConfigured()) {
    return {enabled: false as const, reason: 'Google client IDs are not configured yet.'};
  }

  if (!GoogleSignin) {
    return {enabled: false as const, reason: 'Google Sign-In native module is not available in this build.'};
  }

  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });

    return {enabled: true as const};
  } catch (error) {
    return {enabled: false as const, reason: error instanceof Error ? error.message : 'Google configuration failed.'};
  }
};

export const signInWithGoogle = async (): Promise<any> => {
  const config = await configureGoogleSignin();

  if (!config.enabled) {
    throw new Error(config.reason ?? 'Google sign-in is not configured yet.');
  }

  try {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

    // Google Play Services remembers the last account this app signed in with
    // and hands it straight back, so the chooser never appears — the user only
    // ever sees that one account and can never pick (or create) another one.
    // Dropping the cached Google session first makes Play Services present the
    // device's full account list again, including "Add another account".
    await signOutGoogle();

    const result = await GoogleSignin.signIn();

    const idToken = result?.data?.idToken ?? result?.idToken ?? result?.user?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In succeeded but no ID token was returned.');
    }

    // Exchange Google ID token for a Supabase session
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const {data: supabaseData, error: supabaseError} = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (supabaseError) {
        console.error('Supabase Google token exchange failed:', supabaseError.message);
        throw new Error(supabaseError.message ?? 'Failed to authenticate with Supabase.');
      }
      // Return combined result including supabase session data
      return {
        ...result,
        idToken,
        supabaseSession: supabaseData?.session ?? null,
        data: {
          ...(result?.data ?? {}),
          user: supabaseData?.user ?? result?.data?.user ?? null,
        },
      };
    }

    // Supabase not configured — return raw Google result (demo/dev mode)
    return {...result, idToken};
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Google sign-in was cancelled.');
    }

    if (error?.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google sign-in is already in progress.');
    }

    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is not available on this device.');
    }

    throw error;
  }
};

export const signOutGoogle = async () => {
  try {
    if (!GoogleSignin) {
      return;
    }
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('Google sign-out failed', error);
  }
};

export const getGoogleErrorMessage = (error: any) => {
  if (!error) {
    return 'Google sign-in failed. Please try again.';
  }

  if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
    return 'Google sign-in was cancelled.';
  }

  if (error?.code === statusCodes.IN_PROGRESS) {
    return 'Google sign-in is already in progress.';
  }

  if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services is not available on this device.';
  }

  if (typeof error === 'string' && error.toLowerCase().includes('native module')) {
    return 'Google Sign-In is unavailable in this build.';
  }

  if (typeof error?.message === 'string' && error.message.toLowerCase().includes('status code 10')) {
    return 'Google sign-in failed because the Android package name / SHA-1 does not match the Google Console configuration.';
  }

  return error?.message ?? 'Google sign-in failed. Please try again.';
};
