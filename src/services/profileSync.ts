/**
 * profileSync.ts
 * Upserts and fetches the authenticated user's profile in the Supabase `profiles` table.
 * All calls are wrapped in try/catch and gracefully no-op if Supabase is not configured.
 */

import {getSupabaseClient, getCurrentUser} from './auth';
import {isSupabaseConfigured} from '../config/supabase';
import {appStorage} from './storage';

export type DBProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  onboarding_complete: boolean;
  created_at?: string;
  updated_at?: string;
};

/**
 * Everything the onboarding flow collects. Stored verbatim in
 * `profiles.onboarding_answers` (jsonb) so no answer is ever lost, while the
 * typed fields are mirrored into dedicated columns the SQL layer can reason
 * about when it derives calorie/step targets and coaching advice.
 */
export type OnboardingAnswersPayload = {
  displayName?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  birthYear?: number | null;
  goal?: string | null;
  activityLevel?: string | null;
  fitnessLevel?: string | null;
  workoutFrequency?: number | null;
  dailyActivity?: number | null;
  /** Raw onboarding answers — persisted as-is for full traceability. */
  answers?: Record<string, any>;
};

const DISPLAY_NAME_KEY = 'user_display_name';
const AVATAR_URL_KEY = 'user_avatar_url';
const ONBOARDING_DONE_KEY = 'user_onboarding_complete';

/**
 * Cache authenticated user metadata locally so the app can display
 * name/avatar even in offline mode.
 */
export function cacheUserLocally(params: {
  displayName?: string | null;
  avatarUrl?: string | null;
  onboardingComplete?: boolean;
}) {
  if (params.displayName != null) {
    appStorage.setString(DISPLAY_NAME_KEY, params.displayName);
  }
  if (params.avatarUrl != null) {
    appStorage.setString(AVATAR_URL_KEY, params.avatarUrl);
  }
  if (params.onboardingComplete != null) {
    appStorage.setString(ONBOARDING_DONE_KEY, params.onboardingComplete ? 'true' : 'false');
  }
}

export function getCachedDisplayName(): string {
  return appStorage.getString(DISPLAY_NAME_KEY) || 'Athlete';
}

export function getCachedAvatarUrl(): string | null {
  return appStorage.getString(AVATAR_URL_KEY) || null;
}

export function getCachedOnboardingComplete(): boolean {
  return appStorage.getString(ONBOARDING_DONE_KEY) === 'true';
}

/**
 * Upserts the user's profile row in the Supabase `profiles` table.
 * Called after every successful auth event (Google Sign-In, email login, session restore).
 */
export async function upsertUserProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
}): Promise<DBProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Athlete';

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    const {data, error} = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: displayName,
          avatar_url: avatarUrl,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (error) {
      // 42P01 = table doesn't exist yet — silently skip
      if (!error.code?.includes('42P01')) {
        console.warn('[profileSync] upsertUserProfile error:', error.message);
      }
      // Still cache locally even if DB failed — never downgrade onboarding status.
      const localDone = getCachedOnboardingComplete();
      cacheUserLocally({displayName, avatarUrl, onboardingComplete: localDone});
      return null;
    }

    // Never downgrade a locally-confirmed onboarding_complete=true to false.
    // The server may lag behind the local write (fire-and-forget backend sync),
    // so if the local cache already says true we trust it over the server value.
    const serverOnboardingDone = (data as any)?.onboarding_complete ?? false;
    const localOnboardingDone = getCachedOnboardingComplete();
    cacheUserLocally({
      displayName: (data as any)?.display_name ?? displayName,
      avatarUrl: (data as any)?.avatar_url ?? avatarUrl,
      onboardingComplete: localOnboardingDone || serverOnboardingDone,
    });

    return data as DBProfile;
  } catch (err) {
    console.warn('[profileSync] upsertUserProfile threw:', err);
    return null;
  }
}

/**
 * Marks onboarding as complete in the Supabase `profiles` table.
 */
export async function markOnboardingComplete(userId?: string): Promise<void> {
  cacheUserLocally({onboardingComplete: true});

  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    let uid = userId ?? null;
    if (!uid) {
      const user = await getCurrentUser();
      uid = (user as any)?.id ?? null;
    }
    if (!uid) {
      return;
    }

    const supabase = getSupabaseClient();
    const {error} = await (supabase as any)
      .from('profiles')
      .update({onboarding_complete: true, updated_at: new Date().toISOString()})
      .eq('id', uid);

    if (error && !error.code?.includes('42P01')) {
      console.warn('[profileSync] markOnboardingComplete error:', error.message);
    }
  } catch (err) {
    console.warn('[profileSync] markOnboardingComplete threw:', err);
  }
}

/**
 * Fetches the user's profile row from Supabase.
 */
export async function fetchUserProfile(userId: string): Promise<DBProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (!error.code?.includes('PGRST116') && !error.code?.includes('42P01')) {
        console.warn('[profileSync] fetchUserProfile error:', error.message);
      }
      return null;
    }

    if (data) {
      cacheUserLocally({
        displayName: (data as any).display_name,
        avatarUrl: (data as any).avatar_url,
        onboardingComplete: (data as any).onboarding_complete,
      });
    }

    return data as DBProfile;
  } catch (err) {
    console.warn('[profileSync] fetchUserProfile threw:', err);
    return null;
  }
}

// ─── Onboarding → backend ─────────────────────────────────────────────────────

/** Maps the app's goal keys onto the `public.goal_type` enum. */
function toGoalType(goal?: string | null): string {
  switch (goal) {
    case 'fat':         return 'weight_loss';
    case 'muscle':      return 'muscle_gain';
    case 'strength':    return 'muscle_gain';
    case 'endurance':   return 'performance';
    case 'flexibility': return 'general_fitness';
    case 'wellness':    return 'general_fitness';
    default:            return 'general_fitness';
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) { return fallback; }
  return Math.max(min, Math.min(max, n));
}

/**
 * Persists every onboarding answer to Supabase.
 *
 * Writes the typed body metrics / preferences onto `profiles` plus the raw
 * answer bag into `profiles.onboarding_answers`, and keeps a single active row
 * in `goals`. `profiles.onboarding_complete` is flipped to true in the same
 * statement, so the backend trigger that derives `user_targets` and
 * `fitness_advice` runs exactly once, with all answers already in place.
 *
 * Fully defensive: returns false instead of throwing when Supabase is missing
 * or the migration has not been applied yet.
 */
export async function syncOnboardingToBackend(
  payload: OnboardingAnswersPayload,
  userId?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    cacheUserLocally({onboardingComplete: true});
    return false;
  }

  try {
    let uid = userId ?? null;
    if (!uid) {
      const user = await getCurrentUser();
      uid = (user as any)?.id ?? null;
    }
    if (!uid) {
      return false;
    }

    const supabase = getSupabaseClient();
    const birthYear =
      payload.birthYear && payload.birthYear > 1900 && payload.birthYear < 2200
        ? Math.round(payload.birthYear)
        : null;

    const row: Record<string, any> = {
      id: uid,
      display_name: payload.displayName ?? undefined,
      full_name: payload.displayName ?? undefined,
      sex: payload.sex ?? undefined,
      height_cm: payload.heightCm ?? undefined,
      date_of_birth: birthYear ? `${birthYear}-01-01` : undefined,
      weight_kg: payload.weightKg ?? undefined,
      target_weight_kg: payload.targetWeightKg ?? undefined,
      primary_goal: toGoalType(payload.goal),
      activity_level: payload.activityLevel ?? undefined,
      fitness_level: payload.fitnessLevel ?? undefined,
      workout_frequency: payload.workoutFrequency ?? undefined,
      daily_activity: payload.dailyActivity ?? undefined,
      onboarding_answers: payload.answers ?? {},
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    };

    Object.keys(row).forEach(key => {
      if (row[key] === undefined) { delete row[key]; }
    });

    const {error} = await (supabase as any)
      .from('profiles')
      .upsert(row, {onConflict: 'id', ignoreDuplicates: false});

    if (error && !error.code?.includes('42P01')) {
      console.warn('[profileSync] syncOnboardingToBackend profile error:', error.message);
      cacheUserLocally({onboardingComplete: true});
      return false;
    }

    // Keep exactly one active goal row for the user.
    try {
      await (supabase as any)
        .from('goals')
        .update({is_active: false})
        .eq('user_id', uid)
        .eq('is_active', true);

      await (supabase as any).from('goals').insert({
        user_id: uid,
        goal_type: toGoalType(payload.goal),
        target_weight_kg: payload.targetWeightKg ?? null,
        activity_level: payload.activityLevel ?? null,
        days_per_week: clampInt(payload.workoutFrequency, 1, 7, 3),
        is_active: true,
      });
    } catch (goalErr) {
      console.warn('[profileSync] syncOnboardingToBackend goals threw:', goalErr);
    }

    cacheUserLocally({onboardingComplete: true});
    return true;
  } catch (err) {
    console.warn('[profileSync] syncOnboardingToBackend threw:', err);
    cacheUserLocally({onboardingComplete: true});
    return false;
  }
}
