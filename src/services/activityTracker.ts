/**
 * activityTracker.ts
 * App-level owner of the hardware step sensor.
 *
 * Started once per authenticated session (see AppNavigator). Responsibilities:
 *   1. request the Android ACTIVITY_RECOGNITION runtime permission,
 *   2. register the native step listener — today's steps land in dailyTracker,
 *   3. convert each step delta into active calories burned,
 *   4. re-check the day boundary + push the rollup to Supabase on foreground.
 *
 * Every call degrades to a safe no-op on iOS and on devices with no step sensor,
 * so nothing here can throw into the render path.
 */

import {AppState, type AppStateStatus} from 'react-native';

import {
  addCaloriesBurned,
  getSteps,
  getStepsGoal,
  resetIfNewDay,
  scheduleSyncToSupabase,
  setDistanceKm,
  setSpeedKmh,
  setSteps,
} from './dailyTracker';
import {getUserProfile, addStepCaloriesToProfile} from './userProfile';
import {requestActivityRecognitionPermission} from './permissionsService';
import {
  getBackgroundPedometerStats,
  setUserBiometrics,
  startStepUpdates,
  stopStepUpdates,
  type StepSource,
  type StepUpdate,
} from './stepCounter';
import {checkStepGoalMilestones} from './notificationService';

/** Active-energy cost of one step per kilogram of body weight (≈0.04 kcal/step @72kg). */
const KCAL_PER_STEP_PER_KG = 0.00055;

let started = false;
let activeSource: StepSource = 'none';
let lastCountedSteps = 0;
let appStateSub: {remove: () => void} | null = null;

function currentWeightKg(): number {
  try {
    const w = getUserProfile().weightKg;
    return Number.isFinite(w) && w > 0 ? w : 72;
  } catch {
    return 72;
  }
}

/** Reconciles background stats accumulated while app was completely closed */
async function reconcileBackgroundSteps(): Promise<void> {
  try {
    const stats = await getBackgroundPedometerStats();
    if (stats && stats.steps > 0) {
      const current = getSteps();
      if (stats.steps > current) {
        const delta = stats.steps - current;
        setSteps(stats.steps);
        setDistanceKm(stats.distanceKm);
        setSpeedKmh(stats.speedKmh);
        lastCountedSteps = stats.steps;

        const kcal = delta * currentWeightKg() * KCAL_PER_STEP_PER_KG;
        if (kcal > 0) {
          const rounded = Math.round(kcal * 10) / 10;
          addCaloriesBurned(rounded);
          addStepCaloriesToProfile(rounded, delta, stats.distanceKm);
        }
        checkStepGoalMilestones(stats.steps, getStepsGoal(), kcal, stats.distanceKm);
      }
    }
  } catch {
    /* non-critical */
  }
}

/**
 * Converts newly-counted steps into burned calories and saves to user profile.
 * Also checks step goal milestones (50% and 100%).
 */
function handleStepUpdate(update: StepUpdate): void {
  const steps = update.steps;
  const delta = steps - lastCountedSteps;
  lastCountedSteps = steps;
  if (delta <= 0) { return; }

  const kcal = delta * currentWeightKg() * KCAL_PER_STEP_PER_KG;
  if (kcal > 0) {
    const rounded = Math.round(kcal * 10) / 10;
    addCaloriesBurned(rounded);
    addStepCaloriesToProfile(rounded, delta, update.distanceKm);
  }

  const goal = getStepsGoal();
  checkStepGoalMilestones(steps, goal, kcal, update.distanceKm);
}

function onAppStateChange(state: AppStateStatus): void {
  if (state !== 'active') { return; }
  try {
    resetIfNewDay();
    reconcileBackgroundSteps();
    startStepUpdates(update => handleStepUpdate(update)).catch(() => {});
    scheduleSyncToSupabase();
  } catch {
    /* non-critical */
  }
}

function attachAppStateListener(): void {
  if (appStateSub) { return; }
  try {
    appStateSub = AppState.addEventListener('change', onAppStateChange);
  } catch {
    appStateSub = null;
  }
}

/**
 * Idempotent bootstrap. Returns the active sensor source so callers (e.g. the
 * pedometer screen) can show whether real step hardware is in play.
 */
export async function startActivityTracking(): Promise<StepSource> {
  if (started && activeSource !== 'none') {
    return activeSource;
  }

  try {
    resetIfNewDay();
    lastCountedSteps = getSteps();

    // Set user biometrics for native speed and distance math
    const profile = getUserProfile();
    setUserBiometrics(profile.weightKg || 72, profile.heightCm || 176);

    // Ingest any steps counted while app was closed
    await reconcileBackgroundSteps();

    await requestActivityRecognitionPermission();
    const source: StepSource = await startStepUpdates(update => handleStepUpdate(update));

    started = source !== 'none';
    activeSource = source;

    if (source !== 'none') {
      attachAppStateListener();
      scheduleSyncToSupabase();
    }

    return source;
  } catch {
    started = false;
    activeSource = 'none';
    return 'none';
  }
}

export async function stopActivityTracking(): Promise<void> {
  try {
    appStateSub?.remove();
  } catch {
    /* ignore */
  }
  appStateSub = null;

  try {
    await stopStepUpdates();
  } catch {
    /* ignore */
  }

  started = false;
  activeSource = 'none';
  lastCountedSteps = 0;
}

export function isActivityTracking(): boolean {
  return started;
}

/** The sensor the tracker is actually listening to right now ('none' when idle). */
export function getActiveStepSource(): StepSource {
  return activeSource;
}
