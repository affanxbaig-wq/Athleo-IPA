/**
 * locationTimezoneService.ts
 *
 * Automatically detects the user's timezone and country/region using:
 * 1. Native IANA timezone (Intl.DateTimeFormat)
 * 2. Device location coordinates (@react-native-community/geolocation)
 * 3. Reverse geocoding for Country, Region, and City
 * 4. Automatic sync to Supabase (profiles + user_workout_schedules)
 */

import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import {getSupabaseClient} from './auth';
import {isSupabaseConfigured} from '../config/supabase';
import {appStorage} from './storage';

export interface UserLocationProfile {
  timezone: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'fallback_device';
  updatedAt: string;
}

const STORAGE_KEY_LOCATION = 'athleo_user_location_profile';

// Common timezone to country/city fallback mapping for offline/immediate resolution
const TIMEZONE_FALLBACKS: Record<string, {country: string; countryCode: string; region: string; city: string}> = {
  'Asia/Karachi': {country: 'Pakistan', countryCode: 'PK', region: 'Sindh', city: 'Karachi'},
  'Asia/Lahore': {country: 'Pakistan', countryCode: 'PK', region: 'Punjab', city: 'Lahore'},
  'Asia/Islamabad': {country: 'Pakistan', countryCode: 'PK', region: 'Federal Capital', city: 'Islamabad'},
  'Asia/Dubai': {country: 'United Arab Emirates', countryCode: 'AE', region: 'Dubai', city: 'Dubai'},
  'Asia/Riyadh': {country: 'Saudi Arabia', countryCode: 'SA', region: 'Riyadh', city: 'Riyadh'},
  'America/New_York': {country: 'United States', countryCode: 'US', region: 'New York', city: 'New York'},
  'America/Chicago': {country: 'United States', countryCode: 'US', region: 'Illinois', city: 'Chicago'},
  'America/Los_Angeles': {country: 'United States', countryCode: 'US', region: 'California', city: 'Los Angeles'},
  'Europe/London': {country: 'United Kingdom', countryCode: 'GB', region: 'England', city: 'London'},
  'Europe/Berlin': {country: 'Germany', countryCode: 'DE', region: 'Berlin', city: 'Berlin'},
  'Europe/Paris': {country: 'France', countryCode: 'FR', region: 'Île-de-France', city: 'Paris'},
  'Asia/Kolkata': {country: 'India', countryCode: 'IN', region: 'Delhi', city: 'New Delhi'},
  'Asia/Dhaka': {country: 'Bangladesh', countryCode: 'BD', region: 'Dhaka', city: 'Dhaka'},
  'Asia/Singapore': {country: 'Singapore', countryCode: 'SG', region: 'Singapore', city: 'Singapore'},
  'Australia/Sydney': {country: 'Australia', countryCode: 'AU', region: 'New South Wales', city: 'Sydney'},
  'America/Toronto': {country: 'Canada', countryCode: 'CA', region: 'Ontario', city: 'Toronto'},
};

let cachedProfile: UserLocationProfile | null = null;
const listeners = new Set<(profile: UserLocationProfile) => void>();

export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string' && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch (e) {
    console.warn('[locationTimezone] Failed to resolve IANA timezone via Intl:', e);
  }
  return 'Asia/Karachi'; // Sensible default for app demographic
}

export function getCachedLocationProfile(): UserLocationProfile {
  if (cachedProfile) {
    return cachedProfile;
  }
  const saved = appStorage.getObject<UserLocationProfile>(STORAGE_KEY_LOCATION);
  if (saved) {
    cachedProfile = saved;
    return saved;
  }

  const defaultTz = getDeviceTimezone();
  const fallback = TIMEZONE_FALLBACKS[defaultTz] ?? {
    country: 'Pakistan',
    countryCode: 'PK',
    region: 'Punjab',
    city: 'Lahore',
  };

  const initial: UserLocationProfile = {
    timezone: defaultTz,
    country: fallback.country,
    countryCode: fallback.countryCode,
    region: fallback.region,
    city: fallback.city,
    latitude: null,
    longitude: null,
    permissionStatus: 'fallback_device',
    updatedAt: new Date().toISOString(),
  };

  cachedProfile = initial;
  return initial;
}

export function subscribeLocationProfile(cb: (profile: UserLocationProfile) => void): () => void {
  listeners.add(cb);
  cb(getCachedLocationProfile());
  return () => listeners.delete(cb);
}

function broadcast(profile: UserLocationProfile): void {
  cachedProfile = profile;
  appStorage.setObject(STORAGE_KEY_LOCATION, profile);
  listeners.forEach(cb => cb(profile));
}

/**
 * Requests location permission on Android & iOS
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const fineGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location & Timezone Permission',
          message: 'Athleo uses your location to automatically synchronize your workout reminders and schedule to your exact country, region, and local timezone.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        },
      );
      return fineGranted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn('[locationTimezone] Android permission request failed:', e);
      return false;
    }
  }

  // iOS Geolocation handles permission dialog automatically when requesting position
  return true;
}

/**
 * Reverse geocodes latitude/longitude into country, region, and city.
 * Uses a lightweight, zero-key reverse geocode API with strict 3-second timeout,
 * and falls back to timezone heuristics if offline.
 */
async function reverseGeocodeCoords(lat: number, lng: number): Promise<{
  country: string;
  countryCode: string;
  region: string;
  city: string;
}> {
  const defaultTz = getDeviceTimezone();
  const fallback = TIMEZONE_FALLBACKS[defaultTz] ?? {
    country: 'Pakistan',
    countryCode: 'PK',
    region: 'Punjab',
    city: 'Lahore',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      {signal: controller.signal},
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        country: data.countryName || fallback.country,
        countryCode: data.countryCode || fallback.countryCode,
        region: data.principalSubdivision || data.locality || fallback.region,
        city: data.city || data.locality || fallback.city,
      };
    }
  } catch (err) {
    console.log('[locationTimezone] Reverse geocode network fallback used:', err);
  }

  return fallback;
}

/**
 * Synchronizes detected location & timezone to Supabase backend
 */
export async function syncLocationToSupabase(profile: UserLocationProfile): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any).rpc('sync_user_location_and_timezone', {
      p_timezone: profile.timezone,
      p_country: profile.country,
      p_country_code: profile.countryCode,
      p_region: profile.region,
      p_city: profile.city,
      p_lat: profile.latitude,
      p_lng: profile.longitude,
      p_permission: profile.permissionStatus,
    });

    if (error) {
      console.warn('[locationTimezone] sync_user_location_and_timezone RPC error:', error.message);
      return false;
    }

    return Boolean(data?.ok);
  } catch (err) {
    console.warn('[locationTimezone] syncLocationToSupabase threw:', err);
    return false;
  }
}

/**
 * Main routine: Requests location permission, detects GPS coordinates & timezone,
 * reverse geocodes country/region, and synchronizes to Supabase.
 */
export async function detectAndSyncLocation(): Promise<UserLocationProfile> {
  const tz = getDeviceTimezone();
  const current = getCachedLocationProfile();

  const hasPerm = await requestLocationPermission();
  if (!hasPerm) {
    const fallbackData = TIMEZONE_FALLBACKS[tz] ?? {
      country: current.country || 'Pakistan',
      countryCode: current.countryCode || 'PK',
      region: current.region || 'Punjab',
      city: current.city || 'Lahore',
    };

    const updated: UserLocationProfile = {
      ...current,
      timezone: tz,
      country: fallbackData.country,
      countryCode: fallbackData.countryCode,
      region: fallbackData.region,
      city: fallbackData.city,
      permissionStatus: 'denied',
      updatedAt: new Date().toISOString(),
    };
    broadcast(updated);
    await syncLocationToSupabase(updated);
    return updated;
  }

  return new Promise<UserLocationProfile>(resolve => {
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const geo = await reverseGeocodeCoords(latitude, longitude);

        const updated: UserLocationProfile = {
          timezone: tz,
          country: geo.country,
          countryCode: geo.countryCode,
          region: geo.region,
          city: geo.city,
          latitude,
          longitude,
          permissionStatus: 'granted',
          updatedAt: new Date().toISOString(),
        };

        broadcast(updated);
        await syncLocationToSupabase(updated);
        resolve(updated);
      },
      async error => {
        console.warn('[locationTimezone] Geolocation error, using timezone heuristics:', error);
        const fallbackData = TIMEZONE_FALLBACKS[tz] ?? {
          country: current.country || 'Pakistan',
          countryCode: current.countryCode || 'PK',
          region: current.region || 'Punjab',
          city: current.city || 'Lahore',
        };

        const updated: UserLocationProfile = {
          ...current,
          timezone: tz,
          country: fallbackData.country,
          countryCode: fallbackData.countryCode,
          region: fallbackData.region,
          city: fallbackData.city,
          permissionStatus: 'fallback_device',
          updatedAt: new Date().toISOString(),
        };

        broadcast(updated);
        await syncLocationToSupabase(updated);
        resolve(updated);
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  });
}
