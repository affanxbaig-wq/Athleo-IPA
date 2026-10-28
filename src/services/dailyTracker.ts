/**
 * dailyTracker.ts
 * Central live daily-metrics store backed by MMKV.
 *
 * All values reset automatically at midnight.
 * Exposes a simple subscribe/unsubscribe so UI components can react to changes.
 * Optionally syncs to Supabase `daily_activity` table when authenticated.
 */

import {appStorage} from './storage';
import {updateTodayEntry} from './progressTracker';
import {getUserProfile} from './userProfile';
import {isSupabaseConfigured} from '../config/supabase';

// ─── Date helpers ────────────────────────────────────────────────────────────

export function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DATE_STORAGE_KEY = 'daily_tracker_date';

function storageKey(metric: string): string {
  return `${metric}_${getTodayKey()}`;
}

/**
 * Resets all daily counters if the stored date differs from today.
 * Call once on app start and whenever the app foregrounds.
 */
export function resetIfNewDay(): void {
  const storedDate = appStorage.getString(DATE_STORAGE_KEY);
  const today = getTodayKey();
  if (storedDate !== today) {
    // Archive yesterday's data before clearing (optional — stored under its own key)
    appStorage.setString(DATE_STORAGE_KEY, today);
    // Reset today's counters to 0
    appStorage.setString(storageKey('steps'), '0');
    appStorage.setString(storageKey('water_ml'), '0');
    appStorage.setString(storageKey('calories_burned'), '0');
    appStorage.setString(storageKey('calories_consumed'), '0');
    appStorage.setString(storageKey('workouts'), '0');
    appStorage.setString(storageKey('distance_km'), '0');
    appStorage.setString(storageKey('speed_kmh'), '0');
  }
}

// ─── Listener system ─────────────────────────────────────────────────────────

type MetricKey =
  | 'steps'
  | 'water_ml'
  | 'calories_burned'
  | 'calories_consumed'
  | 'workouts'
  | 'distance_km'
  | 'speed_kmh';
const listeners = new Map<MetricKey, Set<(value: number) => void>>();
const globalListeners = new Set<() => void>();

function notifyListeners(key: MetricKey, value: number): void {
  listeners.get(key)?.forEach(cb => {
    try { cb(value); } catch {}
  });
  globalListeners.forEach(cb => {
    try { cb(); } catch {}
  });
}

export function subscribe(key: MetricKey, callback: (value: number) => void): () => void {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key)!.add(callback);
  return () => listeners.get(key)?.delete(callback);
}

/**
 * Subscribe to ANY metric change. Useful for screens like Dashboard that
 * need to refresh multiple values at once.
 */
export function subscribeAll(callback: () => void): () => void {
  globalListeners.add(callback);
  return () => globalListeners.delete(callback);
}

// ─── Generic read/write ───────────────────────────────────────────────────────

function readMetric(key: MetricKey): number {
  return parseFloat(appStorage.getString(storageKey(key)) || '0') || 0;
}

function writeMetric(key: MetricKey, value: number): void {
  const rounded = Math.max(0, Math.round(value * 10) / 10);
  appStorage.setString(storageKey(key), String(rounded));
  notifyListeners(key, rounded);
  // Mirror every change to the backend (debounced inside dailyTracker).
  scheduleSyncToSupabase();
  // …and into the rolling history the Progress screen / weekly report read.
  scheduleMirrorToHistory();
}

// ─── Bridge into the 90-day history store ─────────────────────────────────────
//
// dailyTracker holds *today's* live counters (fed by the hardware step sensor,
// nutrition logging and finished workouts); progressTracker holds the rolling
// 90-day history that the Progress screen, the weekly report and the charts read
// from. Nothing used to copy one into the other, so every history-based screen
// stayed at zero no matter how many steps the sensor actually counted.
//
// `waterMl` is deliberately NOT mirrored: the recovery screen owns that field in
// the history (it writes the user's own water entry), and the live tracker has no
// water writer — mirroring it would wipe the user's input with a zero.

let pendingMirrorTimeout: ReturnType<typeof setTimeout> | null = null;
const MIRROR_DEBOUNCE_MS = 1200;

/** Copies today's live counters into the history entry for today. */
export function mirrorTodayToHistory(): void {
  try {
    updateTodayEntry({
      steps: getSteps(),
      caloriesBurned: getCaloriesBurned(),
      calories: getCaloriesConsumed(),
      workoutsCompleted: getWorkoutsCompleted(),
    });
  } catch {
    /* non-critical — the next write retries */
  }
}

/**
 * Writes immediately instead of on the debounce.
 *
 * Used right before navigating to a history-driven screen (finishing a workout
 * or a run), where waiting out the debounce would let the destination mount and
 * read stale numbers.
 */
export function flushMirrorToHistory(): void {
  if (pendingMirrorTimeout) {
    clearTimeout(pendingMirrorTimeout);
    pendingMirrorTimeout = null;
  }
  mirrorTodayToHistory();
}

function scheduleMirrorToHistory(): void {
  // A burst of step events must result in one history write, not one per step.
  if (pendingMirrorTimeout) {clearTimeout(pendingMirrorTimeout);}
  pendingMirrorTimeout = setTimeout(() => {
    pendingMirrorTimeout = null;
    mirrorTodayToHistory();
  }, MIRROR_DEBOUNCE_MS);
}

function addMetric(key: MetricKey, delta: number): number {
  const current = readMetric(key);
  const next = current + Math.max(0, delta);
  writeMetric(key, next);
  return next;
}

// ─── Steps ──────────────────────────────────────────────────────────────────

export function getSteps(): number {
  return readMetric('steps');
}

export function setSteps(value: number): void {
  writeMetric('steps', value);
  try {
    const profile = getUserProfile();
    const weightKg = Number.isFinite(profile?.weightKg) && (profile?.weightKg ?? 0) > 0 ? profile.weightKg : 72;
    const minStepCals = Math.round(value * weightKg * 0.00055 * 10) / 10;
    const currentBurned = readMetric('calories_burned');
    if (minStepCals > currentBurned) {
      writeMetric('calories_burned', minStepCals);
    }
  } catch {
    /* non-critical */
  }
}

export function addSteps(delta: number): number {
  return addMetric('steps', delta);
}

// ─── Water ──────────────────────────────────────────────────────────────────

export function getWaterMl(): number {
  return readMetric('water_ml');
}

export function addWaterMl(ml: number): number {
  return addMetric('water_ml', ml);
}

export function setWaterMl(ml: number): void {
  writeMetric('water_ml', ml);
}

// ─── Calories burned (active / exercise) ─────────────────────────────────────

export function getCaloriesBurned(): number {
  return readMetric('calories_burned');
}

export function addCaloriesBurned(kcal: number): number {
  return addMetric('calories_burned', kcal);
}

export function setCaloriesBurned(kcal: number): void {
  writeMetric('calories_burned', kcal);
}

// ─── Calories consumed (nutrition) ───────────────────────────────────────────

export function getCaloriesConsumed(): number {
  return readMetric('calories_consumed');
}

export function addCaloriesConsumed(kcal: number): number {
  return addMetric('calories_consumed', kcal);
}

export function setCaloriesConsumed(kcal: number): void {
  writeMetric('calories_consumed', kcal);
}

// ─── Workouts completed ───────────────────────────────────────────────────────

export function getWorkoutsCompleted(): number {
  return readMetric('workouts');
}

export function incrementWorkoutsCompleted(): number {
  return addMetric('workouts', 1);
}

// ─── Distance & Speed (Pedometer metrics) ────────────────────────────────────

export function getDistanceKm(): number {
  return readMetric('distance_km');
}

export function setDistanceKm(val: number): void {
  writeMetric('distance_km', val);
}

export function getSpeedKmh(): number {
  return readMetric('speed_kmh');
}

export function setSpeedKmh(val: number): void {
  writeMetric('speed_kmh', val);
}

// ─── Mifflin-St Jeor Calorie Goal ─────────────────────────────────────────────

/**
 * Daily calorie target derived from the user's onboarding answers.
 *
 * BMR uses Mifflin-St Jeor with the *real* age (from `birthYear`) and the
 * *real* sex offset — the earlier version hard-coded a 26-year-old male, which
 * made every user's target identical. The goal adjustment is capped by a safe
 * floor so aggressive fat-loss goals can never produce a starvation target.
 */
export function getCalorieGoal(): number {
  try {
    const profile = getUserProfile();
    const {weightKg, heightCm, activityLevel, goal, gender, birthYear} = profile;

    const weight = weightKg > 0 ? weightKg : 72;
    const height = heightCm > 0 ? heightCm : 176;

    const currentYear = new Date().getFullYear();
    const age =
      birthYear && birthYear > currentYear - 100 && birthYear < currentYear
        ? Math.max(14, currentYear - birthYear)
        : 26;

    // Mifflin-St Jeor sex constant: +5 (male), −161 (female), midpoint otherwise.
    const sexOffset = gender === 'female' ? -161 : gender === 'male' ? 5 : -78;

    const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;

    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      athlete: 1.9,
    };
    const tdee = bmr * (activityMultipliers[activityLevel ?? 'moderate'] ?? 1.55);

    const goalAdjust: Record<string, number> = {
      fat: -400,
      muscle: +250,
      endurance: +150,
      wellness: 0,
      strength: +200,
      flexibility: 0,
    };
    const target = tdee + (goalAdjust[goal ?? 'wellness'] ?? 0);

    return Math.round(Math.max(1200, target));
  } catch {
    return 2200;
  }
}

/**
 * Daily step target derived from the user's activity level. Used by the
 * dashboard, the pedometer and the coaching copy so all three agree.
 */
export function getStepsGoal(): number {
  try {
    const {activityLevel} = getUserProfile();
    const stepGoals: Record<string, number> = {
      sedentary: 6000,
      light: 8000,
      moderate: 10000,
      active: 12000,
      athlete: 14000,
    };
    return stepGoals[activityLevel ?? 'moderate'] ?? 10000;
  } catch {
    return 10000;
  }
}

export function getWaterGoalMl(): number {
  try {
    const {weightKg, activityLevel} = getUserProfile();
    const base = weightKg * 30; // 30ml per kg
    const activityBonus: Record<string, number> = {
      sedentary: 0,
      light: 200,
      moderate: 400,
      active: 600,
      athlete: 800,
    };
    return Math.round(base + (activityBonus[activityLevel ?? 'moderate'] ?? 400));
  } catch {
    return 3000;
  }
}

// ─── Streak management ────────────────────────────────────────────────────────

const STREAK_DATES_KEY = 'streak_dates';
const STREAK_COUNT_KEY = 'streak_count';

export function getStreak(): number {
  return parseInt(appStorage.getString(STREAK_COUNT_KEY) || '0', 10);
}

export function updateStreak(): number {
  const today = getTodayKey();
  const storedDates: string[] = JSON.parse(appStorage.getString(STREAK_DATES_KEY) || '[]');

  if (storedDates.includes(today)) {
    return getStreak();
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const isConsecutive = storedDates.includes(yesterdayKey);
  const currentStreak = isConsecutive ? getStreak() + 1 : 1;

  const updatedDates = [...storedDates.slice(-29), today]; // keep last 30
  appStorage.setString(STREAK_DATES_KEY, JSON.stringify(updatedDates));
  appStorage.setString(STREAK_COUNT_KEY, String(currentStreak));

  return currentStreak;
}

// ─── Optional Supabase sync ───────────────────────────────────────────────────

let pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncToSupabase(): void {
  if (!isSupabaseConfigured()) { return; }
  // Debounce: sync 3 seconds after last metric change
  if (pendingSyncTimeout) { clearTimeout(pendingSyncTimeout); }
  pendingSyncTimeout = setTimeout(syncToSupabase, 3000);
}

async function syncToSupabase(): Promise<void> {
  try {
    const {getSupabaseClient} = await import('./auth');
    const supabase = getSupabaseClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) { return; }

    const today = getTodayKey();
    const payload: Record<string, any> = {
      user_id: user.id,
      date: today,
      steps: getSteps(),
      water_ml: getWaterMl(),
      calories_burned: getCaloriesBurned(),
      calories_consumed: getCaloriesConsumed(),
      workouts: getWorkoutsCompleted(),
      distance_km: getDistanceKm(),
      speed_avg_kmh: getSpeedKmh(),
      updated_at: new Date().toISOString(),
    };

    let {error} = await (supabase as any).from('daily_activity').upsert(
      payload,
      {onConflict: 'user_id,date'},
    );

    if (error && (error.code === '23503' || error.message?.includes('foreign key'))) {
      // User profile row does not exist in profiles table yet — insert minimal profile first
      try {
        await (supabase as any).from('profiles').upsert({
          id: user.id,
          email: user.email ?? null,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Athlete',
          updated_at: new Date().toISOString(),
        }, {onConflict: 'id'});

        const retry = await (supabase as any).from('daily_activity').upsert(
          payload,
          {onConflict: 'user_id,date'},
        );
        error = retry.error;
      } catch { /* ignore */ }
    }

    if (error && (error.message?.includes('column') || error.code?.includes('42703'))) {
      // Fallback if distance_km or speed_avg_kmh column has not been added to remote DB
      delete payload.distance_km;
      delete payload.speed_avg_kmh;
      await (supabase as any).from('daily_activity').upsert(
        payload,
        {onConflict: 'user_id,date'},
      );
    }
  } catch (err) {
    console.warn('[dailyTracker] Supabase sync failed (non-critical):', err);
  }
}
