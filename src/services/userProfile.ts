import {appStorage} from './storage';

export type UserProfile = {
  weightKg: number;
  heightCm: number;
  goal: 'muscle' | 'fat' | 'endurance' | 'wellness' | 'strength' | 'flexibility' | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete' | null;
  bodyType: 'ecto' | 'meso' | 'endo' | null;
  stress: 'low' | 'medium' | 'high' | null;
  experience: 'novice' | 'beginner' | 'intermediate' | 'advanced' | null;
  sessionDuration: 'short' | 'standard' | 'long' | 'marathon' | null;
  gender?: 'male' | 'female' | 'other' | null;
  focusAreas?: string[];
  motivation?: string | null;
  bodyShape?: string | null;
  targetBodyFat?: number | null;
  birthYear?: number | null;
  heightUnit?: 'cm' | 'ft' | null;
  bellyType?: string | null;
  lastIdealWeight?: string | null;
  workoutFrequency?: number | null;
  currentRole?: string | null;
  injuries?: string[];
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced' | null;
  dailyActivity?: number | null;
  workoutDifficulty?: string | null;
  activityPreferences?: string[];
  muscleHistory?: string | null;
  mindsetBlocker?: string | null;
  postGoalRewards?: string[];
  guideCoach?: string | null;
  targetWeightKg?: number | null;
  totalSteps?: number;
  totalCaloriesBurned?: number;
  totalDistanceKm?: number;
  stepGoal?: number;
  avatarUrl?: string | null;
};

const DEFAULT_PROFILE: UserProfile = {
  weightKg: 72,
  heightCm: 176,
  goal: null,
  activityLevel: 'moderate',
  bodyType: null,
  stress: 'medium',
  experience: 'beginner',
  sessionDuration: 'standard',
  gender: null,
  focusAreas: [],
  motivation: null,
  bodyShape: null,
  targetBodyFat: null,
  birthYear: null,
  heightUnit: 'cm',
  bellyType: null,
  lastIdealWeight: null,
  workoutFrequency: null,
  currentRole: null,
  injuries: [],
  fitnessLevel: 'beginner',
  dailyActivity: null,
  workoutDifficulty: null,
  activityPreferences: [],
  muscleHistory: null,
  mindsetBlocker: null,
  postGoalRewards: [],
  guideCoach: null,
  targetWeightKg: null,
  totalSteps: 0,
  totalCaloriesBurned: 0,
  totalDistanceKm: 0,
  stepGoal: 10000,
  avatarUrl: null,
};

const STORAGE_KEY = 'athleo_user_profile';
const cachedProfile = appStorage.getObject<UserProfile>(STORAGE_KEY);
let profile: UserProfile = cachedProfile ? {...DEFAULT_PROFILE, ...cachedProfile} : {...DEFAULT_PROFILE};
const listeners = new Set<(p: UserProfile) => void>();

export function getUserProfile(): UserProfile {
  return {...profile};
}

export function setUserProfile(next: Partial<UserProfile>): UserProfile {
  profile = {...profile, ...next};
  appStorage.setObject(STORAGE_KEY, profile);
  listeners.forEach(l => {
    try { l(profile); } catch { /* ignore */ }
  });
  return {...profile};
}

/**
 * Saves calories burned, steps, and distance directly to the user profile
 * (both in MMKV local storage and async sync to Supabase profiles table).
 */
export function addStepCaloriesToProfile(caloriesBurned: number, steps: number, distanceKm: number): void {
  const current = getUserProfile();
  const nextCalories = Math.max(0, Math.round(((current.totalCaloriesBurned ?? 0) + caloriesBurned) * 10) / 10);
  const nextSteps = Math.max(0, (current.totalSteps ?? 0) + Math.round(steps));
  const nextDistance = Math.max(0, Math.round(((current.totalDistanceKm ?? 0) + distanceKm) * 100) / 100);

  setUserProfile({
    totalCaloriesBurned: nextCalories,
    totalSteps: nextSteps,
    totalDistanceKm: nextDistance,
  });

  // Async sync to Supabase profiles
  syncStepStatsToSupabaseProfile(nextCalories, nextSteps, nextDistance);
}

/**
 * Updates the avatar URL in Supabase profiles table.
 */
export async function updateAvatarInSupabase(url: string): Promise<void> {
  try {
    const {isSupabaseConfigured} = await import('../config/supabase');
    if (!isSupabaseConfigured()) { return; }
    const {getSupabaseClient} = await import('./auth');
    const supabase = getSupabaseClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) { return; }

    await (supabase as any).from('profiles').update({
      avatar_url: url,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    // Update local state too
    setUserProfile({avatarUrl: url});
  } catch (err) {
    console.error('Failed to update avatar in Supabase:', err);
    throw err;
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
function syncStepStatsToSupabaseProfile(calories: number, steps: number, distance: number): void {
  if (syncTimeout) { clearTimeout(syncTimeout); }
  syncTimeout = setTimeout(async () => {
    syncTimeout = null;
    try {
      const {isSupabaseConfigured} = await import('../config/supabase');
      if (!isSupabaseConfigured()) { return; }
      const {getSupabaseClient} = await import('./auth');
      const supabase = getSupabaseClient();
      const {data: {user}} = await supabase.auth.getUser();
      if (!user) { return; }

      await (supabase as any).from('profiles').update({
        total_calories_burned: calories,
        total_steps: steps,
        total_distance_km: distance,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    } catch {
      /* non-critical */
    }
  }, 3500);
}

export function clearUserProfile(): void {
  profile = {...DEFAULT_PROFILE};
  appStorage.delete(STORAGE_KEY);
  listeners.forEach(l => {
    try { l(profile); } catch { /* ignore */ }
  });
}

export function subscribeToProfile(callback: (p: UserProfile) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getBmi(p: UserProfile = profile): number {
  if (p.heightCm <= 0) {return 0;}
  return p.weightKg / Math.max(1e-6, Math.pow(p.heightCm / 100, 2));
}

export function getBmiBand(p: UserProfile = profile): 'underweight' | 'healthy' | 'overweight' | 'obese' {
  const bmi = getBmi(p);
  if (bmi < 18.5) {return 'underweight';}
  if (bmi < 25) {return 'healthy';}
  if (bmi < 30) {return 'overweight';}
  return 'obese';
}

export function isProfileComplete(p: UserProfile = profile): boolean {
  return Boolean(
    p.goal &&
    p.activityLevel &&
    p.weightKg > 0 &&
    p.heightCm > 0 &&
    p.bodyType &&
    p.stress &&
    p.experience &&
    p.sessionDuration,
  );
}
