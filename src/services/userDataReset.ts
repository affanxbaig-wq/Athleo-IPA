/**
 * userDataReset.ts
 *
 * Wipes the locally stored fitness data so a brand-new account starts from a
 * clean slate instead of inheriting the previous user's / demo account data.
 *
 * Everything the user generates by using the app (profile answers, progress
 * history, daily totals, step counters, joined challenges, badges, settings)
 * is removed. Only device/auth plumbing survives so the device stays trusted
 * and the freshly signed-in session is not disturbed.
 */

import {appStorage} from './storage';
import {clearUserProfile} from './userProfile';
import {resetDailyStore} from './dailyCalories';

const PRESERVED_KEYS = new Set([
  'athleo_device_id',
  'athleo_authorized_device_id',
  'athleo_welcome_seen',
  'athleo_gemini_api_key',
]);

/**
 * Clears every user-scoped key plus the in-memory caches that back them.
 * Also resets XP to 0 so new accounts start at Level 1 instead of inheriting
 * the previous user's XP and level.
 * Safe to call on a fresh install (no-op when nothing is stored yet).
 */
export function resetUserDataForNewUser(): void {
  try {
    appStorage.getAllKeys().forEach(key => {
      if (!PRESERVED_KEYS.has(key)) {
        appStorage.delete(key);
      }
    });
  } catch (e) {
    console.warn('Failed to clear stored user data:', e);
  }

  // Reset the in-memory singletons so running screens stop showing old values.
  clearUserProfile();
  resetDailyStore();

  // Reset XP so every new account starts at Level 1 with 0 XP.
  // Lazy import avoids circular dependency (ProfileXPPanel → storage only).
  try {
    appStorage.setString('athleo_user_xp', '0');
  } catch { /* non-critical */ }
}
