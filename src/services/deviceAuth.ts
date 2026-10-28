import EncryptedStorage from 'react-native-encrypted-storage';
import DeviceInfo from 'react-native-device-info';

import {getSupabaseClient} from './auth';
import {appStorage} from './storage';
import {clearSecureSession, loadSecureSession, saveSecureSession} from './secureStorage';

export type DeviceAuthState = {
  status: 'checking' | 'authenticated' | 'unauthorized' | 'new-device';
  userId: string | null;
  authorizedDevice: boolean;
};

export type TrustedDevice = {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  platform: 'ios' | 'android' | 'web';
  app_version: string | null;
  os_version: string | null;
  last_seen_at: string;
  is_authorized: boolean;
  created_at: string;
  revoked_at: string | null;
};

const DEVICE_ID_KEY = 'athleo_device_id';
const AUTH_DEVICE_KEY = 'athleo_authorized_device_id';

const normalizeDeviceKey = (input: string): string => {
  if (!input) {
    return 'unknown-device';
  }

  return input.trim().toLowerCase();
};

export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const appId = DeviceInfo.getBundleId();
    // getManufacturerSync may throw on some devices; getModel/getSystemVersion are safe
    let manufacturer = 'unknown';
    try { manufacturer = DeviceInfo.getManufacturerSync(); } catch { /* ignore */ }
    const model = DeviceInfo.getModel();
    const systemVersion = DeviceInfo.getSystemVersion();
    // getUniqueId() is ASYNC in react-native-device-info v10+ — MUST be awaited
    let uniqueId = 'no-id';
    try {
      const uid = DeviceInfo.getUniqueId();
      // Handle both Promise (v10+) and string (v9 and below)
      uniqueId = uid instanceof Promise ? await uid : uid;
    } catch { /* ignore */ }

    const raw = [
      appId,
      manufacturer,
      model,
      systemVersion,
      uniqueId,
    ].filter(Boolean).join('|');

    return normalizeDeviceKey(raw || `athleo-${Date.now()}`);
  } catch (error) {
    console.warn('Fingerprint generation failed, using fallback device ID:', error);
    const fallback = `athleo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return normalizeDeviceKey(fallback);
  }
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await EncryptedStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = await getDeviceFingerprint();
  await EncryptedStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
};

export const getAuthorizedDeviceId = (): string | null => {
  return appStorage.getString(AUTH_DEVICE_KEY);
};

export const setAuthorizedDeviceId = (deviceId: string): void => {
  appStorage.setString(AUTH_DEVICE_KEY, deviceId);
};

export const clearAuthorizedDeviceId = (): void => {
  appStorage.delete(AUTH_DEVICE_KEY);
};

export const persistSessionSecurely = async (session: {access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; token_type?: string}): Promise<void> => {
  await saveSecureSession(session);
};

export const restoreSecureSession = async () => {
  return await loadSecureSession();
};

export const clearSecureSessionState = async (): Promise<void> => {
  await clearSecureSession();
  clearAuthorizedDeviceId();
  appStorage.delete('athleo_session_debug');
};

export const validateDeviceAuthorization = async (userId: string | null, deviceId: string): Promise<boolean> => {
  if (!userId || !deviceId) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any).rpc('is_device_authorized', {
      p_user_id: userId,
      p_device_id: deviceId,
    });

    if (error) {
      // Graceful fallback: if the RPC function doesn't exist yet (migration not run),
      // allow login instead of boot-looping the user to the login screen.
      const isRpcMissing =
        error.code === '42883' || // function does not exist
        error.code === 'PGRST202' || // Could not find the function
        error.message?.includes('does not exist') ||
        error.message?.includes('Could not find the function');

      if (isRpcMissing) {
        console.warn('[DeviceAuth] is_device_authorized RPC not found — run supabase/device_auth_setup.sql to enable device binding. Allowing login gracefully.');
        return true; // Fail open: let user in, log warning
      }

      console.warn('Device validation RPC failed:', error.message);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.warn('Device validation failed — allowing login gracefully:', error);
    return true; // Fail open on network errors to avoid locking users out
  }
};

export const hydrateDeviceBoundAuthState = async (): Promise<DeviceAuthState> => {
  const deviceId = await getOrCreateDeviceId();
  const secureSession = await restoreSecureSession();

  if (!secureSession?.access_token || !secureSession?.refresh_token) {
    return {
      status: 'unauthorized',
      userId: null,
      authorizedDevice: false,
    };
  }

  try {
    const supabase = getSupabaseClient();
    const {data: {session}, error} = await supabase.auth.setSession({
      access_token: secureSession.access_token,
      refresh_token: secureSession.refresh_token,
    });

    if (error || !session?.user) {
      await clearSecureSessionState();
      return {
        status: 'unauthorized',
        userId: null,
        authorizedDevice: false,
      };
    }

    const isAuthorized = await validateDeviceAuthorization(session.user.id, deviceId);
    const currentAuthorizedDevice = getAuthorizedDeviceId();
    const deviceMatches = currentAuthorizedDevice ? currentAuthorizedDevice === deviceId : isAuthorized;

    if (!deviceMatches || !isAuthorized) {
      await clearSecureSessionState();
      return {
        status: 'new-device',
        userId: session.user.id,
        authorizedDevice: false,
      };
    }

    setAuthorizedDeviceId(deviceId);
    return {
      status: 'authenticated',
      userId: session.user.id,
      authorizedDevice: true,
    };
  } catch (error) {
    console.warn('Hydration auth failed:', error);
    await clearSecureSessionState();
    return {
      status: 'unauthorized',
      userId: null,
      authorizedDevice: false,
    };
  }
};

export const registerTrustedDeviceForUser = async (userId: string): Promise<boolean> => {
  if (!userId) {
    return false;
  }

  const deviceId = await getOrCreateDeviceId();
  // Detect platform properly — supports cross-platform builds
  const Platform = require('react-native').Platform;
  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any).rpc('register_user_device', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_device_name: DeviceInfo.getModel(),
      p_platform: platform,
      p_app_version: DeviceInfo.getVersion(),
      p_os_version: DeviceInfo.getSystemVersion(),
    });

    if (error) {
      // If the RPC doesn't exist, mark device locally as authorized anyway
      const isRpcMissing =
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('Could not find the function');

      if (isRpcMissing) {
        console.warn('[DeviceAuth] register_user_device RPC not found — run supabase/device_auth_setup.sql. Marking device trusted locally.');
        setAuthorizedDeviceId(deviceId);
        return true;
      }

      console.warn('register_user_device RPC failed:', error.message);
      return false;
    }

    setAuthorizedDeviceId(deviceId);
    return Boolean(data);
  } catch (error) {
    console.warn('Trusted device registration failed — marking locally:', error);
    setAuthorizedDeviceId(deviceId);
    return true;
  }
};

export const forceReAuthOnNewDevice = async (): Promise<void> => {
  await clearSecureSessionState();
};

export const getTrustedDevices = async (): Promise<TrustedDevice[]> => {
  try {
    const supabase = getSupabaseClient();
    const {data: {user}, error: userError} = await supabase.auth.getUser();

    if (userError || !user) {
      return [];
    }

    const {data, error} = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', {ascending: false});

    if (error) {
      console.warn('Failed to fetch trusted devices:', error.message);
      return [];
    }

    return (data ?? []) as TrustedDevice[];
  } catch (error) {
    console.warn('Trusted device lookup failed:', error);
    return [];
  }
};

export const revokeTrustedDevice = async (deviceId: string): Promise<boolean> => {
  if (!deviceId) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const {data: {user}, error: userError} = await supabase.auth.getUser();

    if (userError || !user) {
      return false;
    }

    const {error} = await (supabase as any).rpc('revoke_user_device', {
      p_user_id: user.id,
      p_device_id: deviceId,
    });

    if (error) {
      console.warn('Revoke trusted device failed:', error.message);
      return false;
    }

    if (getAuthorizedDeviceId() === deviceId) {
      await clearSecureSessionState();
    }

    return true;
  } catch (error) {
    console.warn('Revoke trusted device error:', error);
    return false;
  }
};
