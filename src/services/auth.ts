import {createClient, type Session, type User} from '@supabase/supabase-js';

import {SUPABASE_ANON_KEY, SUPABASE_URL, getSupabaseConfigError, isSupabaseConfigured} from '../config/supabase';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

import {appStorage} from './storage';
import {clearSecureSessionState, persistSessionSecurely} from './deviceAuth';

const supabaseStorage = {
  getItem: (key: string): string | null => {
    return appStorage.getString(key);
  },
  setItem: (key: string, value: string): void => {
    appStorage.setString(key, value);
  },
  removeItem: (key: string): void => {
    appStorage.delete(key);
  },
};

let client: ReturnType<typeof createClient> | null = null;

const persistSecureSessionIfPresent = async (session: Session | null) => {
  if (!session) {
    return;
  }

  await persistSessionSecurely({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  });
};

export const getSupabaseClient = () => {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new Error(getSupabaseConfigError());
    }

    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: supabaseStorage,
      },
    });
  }

  return client;
};

export const getSession = async () => {
  const supabase = getSupabaseClient();
  const {data: {session}, error} = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName?: string,
  autoLogin: boolean = false,
) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? {data: {full_name: fullName}} : undefined,
  });

  if (error) {
    throw error;
  }

  if (autoLogin) {
    await persistSecureSessionIfPresent(data.session);
  } else {
    // Creating an account redirects the user to the login screen to enter credentials manually
    if (data.session) {
      try {
        await supabase.auth.signOut();
      } catch {}
      await clearSecureSessionState();
    }
  }

  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signInWithPassword({email, password});

  if (error) {
    throw error;
  }

  await persistSecureSessionIfPresent(data.session);
  return data;
};

export const resetPasswordForEmail = async (email: string) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'athleo://reset-password',
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signInWithOtp = async (email: string) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // only existing users can reset
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

export const verifyOtp = async (email: string, token: string) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    throw error;
  }

  await persistSecureSessionIfPresent(data.session);
  return data;
};

export const signOut = async () => {
  const supabase = getSupabaseClient();
  const {error} = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  await clearSecureSessionState();
};

export const getCurrentUser = async () => {
  const supabase = getSupabaseClient();
  const {data: {user}, error} = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
};

export const signInWithGoogle = async (redirectTo?: string) => {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || 'athleo://auth-callback',
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signInWithGoogleNative = async (idToken: string) => {
  /**
   * For native mobile, use the Google Sign-In SDK to get an ID token,
   * then exchange it for a Supabase session.
   * This requires the Google OAuth credentials to be configured in Supabase.
   */
  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    throw error;
  }

  await persistSecureSessionIfPresent(data.session);
  return data;
};

export const deleteUserAccount = async () => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('Backend sign out error during account deletion:', err);
  } finally {
    appStorage.clearAll();
    await clearSecureSessionState();
  }
};

export const isPasskeySupported = () => {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : undefined;
  if (!globalScope) {
    return false;
  }

  const hasPublicKeyCredential = 'PublicKeyCredential' in globalScope;
  const hasCrypto = !!(globalScope as any).crypto && typeof (globalScope as any).crypto.subtle !== 'undefined';
  return hasPublicKeyCredential && hasCrypto;
};

export const signInWithPasskey = async (options?: {captchaToken?: string; signal?: AbortSignal; mediation?: 'silent' | 'optional' | 'preferred' | 'required'}) => {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device. Use biometric login or email login instead.');
  }

  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.signInWithPasskey({options});

  if (error) {
    throw error;
  }

  await persistSecureSessionIfPresent(data.session);
  return data;
};

export const registerPasskey = async (options?: {signal?: AbortSignal}) => {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }

  const supabase = getSupabaseClient();
  const {data, error} = await supabase.auth.registerPasskey({options});

  if (error) {
    throw error;
  }

  return data;
};
