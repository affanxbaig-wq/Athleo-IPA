/**
 * stepCounter.ts
 * JS wrapper around the native `AthleoStepCounter` Android module.
 *
 * The native side registers TYPE_STEP_COUNTER (cumulative since boot) or, when
 * unavailable, TYPE_STEP_DETECTOR (one event per step) and emits
 * `AthleoStepCounter:update` with `{source, steps}`.
 *
 * We normalise both sensors into "steps taken today" by persisting a baseline:
 *   todaySteps = baseSteps + (raw - baseRaw)
 * The baseline is reset when the calendar day changes, or when `raw` goes
 * backwards (device reboot / listener restart).
 */

import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

import {appStorage} from './storage';
import {getTodayKey, getSteps, setSteps, setDistanceKm, setSpeedKmh, setCaloriesBurned} from './dailyTracker';

export type StepSource = 'counter' | 'detector' | 'accelerometer' | 'none';

export type StepUpdate = {
  steps: number;
  source: StepSource;
  speedKmh: number;
  distanceKm: number;
  calories: number;
};

/** Raw native readout used by the pedometer's on-device diagnostics line. */
export type StepDiagnostics = {
  hasCounter: boolean;
  hasDetector: boolean;
  hasAccelerometer: boolean;
  activityPermission: boolean;
  listening: boolean;
  activeSource: StepSource;
  eventsReceived: number;
};

const MODULE_NAME = 'AthleoStepCounter';
const EVENT_NAME = 'AthleoStepCounter:update';
const STATE_KEY = 'step_counter_state_v1';

type CounterState = {
  date: string;
  baseRaw: number;
  baseSteps: number;
  steps: number;
  /**
   * Which sensor produced `baseRaw`. The counter reports "steps since boot"
   * while the detector and the accelerometer report "steps this session", so a
   * source change invalidates the baseline — without this, switching from the
   * counter to the accelerometer fallback would add the boot total to the count.
   */
  source?: StepSource;
};

const nativeModule: any = NativeModules?.[MODULE_NAME] ?? null;

let emitter: NativeEventEmitter | null = null;
let subscription: {remove: () => void} | null = null;
let listening = false;
let lastReported = 0;
/**
 * The sensor the native side is *currently* feeding us — updated from the event
 * payload, so it stays correct when the native watchdog swaps the step counter
 * for the accelerometer mid-session.
 */
let activeSourceName: StepSource = 'none';

function readState(): CounterState | null {
  const state = appStorage.getObject<CounterState>(STATE_KEY);
  if (!state || typeof state.baseRaw !== 'number') {
    return null;
  }
  return state;
}

function computeTodaySteps(rawValue: number, source: StepSource): number {
  const current = getSteps();
  const incoming = Number.isFinite(rawValue) ? Math.max(0, Math.round(rawValue)) : 0;
  const today = getTodayKey();
  const existingState = readState();

  let steps = Math.max(current, incoming);
  let baseRaw = incoming;
  let baseSteps = steps;

  if (existingState && existingState.date === today && typeof existingState.baseRaw === 'number') {
    baseRaw = existingState.baseRaw;
    baseSteps = typeof existingState.baseSteps === 'number' ? existingState.baseSteps : current;
    // When raw is hardware cumulative counter, steps = baseSteps + (incoming - baseRaw)
    if (source === 'counter' && incoming >= baseRaw) {
      steps = Math.max(current, baseSteps + (incoming - baseRaw));
    } else {
      steps = Math.max(current, incoming);
    }
  }

  appStorage.setObject(STATE_KEY, {
    date: today,
    baseRaw,
    baseSteps,
    steps,
    source,
  });
  return steps;
}

/** True when the device exposes a hardware step sensor. */
export async function isStepSensorAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.isAvailable) {
    return false;
  }
  try {
    return Boolean(await nativeModule.isAvailable());
  } catch {
    return false;
  }
}

/** Which sensor the native layer will use ('counter' | 'detector' | 'none'). */
export async function getStepSource(): Promise<StepSource> {
  if (Platform.OS !== 'android' || !nativeModule?.getSource) {
    return 'none';
  }
  try {
    return ((await nativeModule.getSource()) as StepSource) ?? 'none';
  } catch {
    return 'none';
  }
}

/**
 * Steps recorded today from the hardware sensor (persisted, no listener needed).
 * Falls back to the daily tracker value when no sensor state exists yet.
 */
export function getTodaySensorSteps(): number {
  const today = getTodayKey();
  const state = readState();
  if (!state || state.date !== today) {
    return 0;
  }
  return Math.max(0, Math.round(state.steps));
}

const updateListeners = new Set<(update: StepUpdate) => void>();

/**
 * Registers the native step listener.
 * @returns the active sensor source ('none' when the device has no step sensor).
 */
export async function startStepUpdates(onUpdate?: (update: StepUpdate) => void): Promise<StepSource> {
  if (onUpdate) {
    updateListeners.add(onUpdate);
  }

  if (Platform.OS !== 'android' || !nativeModule?.startUpdates) {
    return 'none';
  }

  const source = await (async () => {
    try {
      return ((await nativeModule.startUpdates()) as StepSource) ?? 'none';
    } catch {
      return 'none';
    }
  })();

  if (source === 'none') {
    return 'none';
  }

  if (!emitter) {
    emitter = new NativeEventEmitter(nativeModule);
  }

  // Always (re)create subscription if it was removed or never set
  if (!subscription) {
    subscription = emitter.addListener(EVENT_NAME, (payload: {source?: string; steps?: number; speedKmh?: number; distanceKm?: number; calories?: number}) => {
      const stepSource = ((payload?.source as StepSource) ?? source) || 'none';
      const steps = computeTodaySteps(payload?.steps ?? 0, stepSource);
      lastReported = steps;
      activeSourceName = stepSource;
      const speedKmh = Math.max(0, Math.round((payload?.speedKmh ?? 0) * 10) / 10);
      const distanceKm = Math.max(0, Math.round(((payload?.distanceKm ?? (steps * 0.762) / 1000)) * 100) / 100);
      const calories = Math.max(0, Math.round((payload?.calories ?? (steps * 0.04)) * 10) / 10);

      // Hardware sensor is authoritative for today's metrics
      setSteps(steps);
      setDistanceKm(distanceKm);
      setSpeedKmh(speedKmh);
      setCaloriesBurned(calories);

      const updateData: StepUpdate = {steps, source: stepSource, speedKmh, distanceKm, calories};
      updateListeners.forEach(cb => {
        try { cb(updateData); } catch {}
      });
    });
  }

  listening = true;
  return source;
}

/** Unregisters the native step listener. */
export async function stopStepUpdates(): Promise<void> {
  subscription?.remove();
  subscription = null;
  listening = false;
  activeSourceName = 'none';
  updateListeners.clear();

  if (Platform.OS === 'android' && nativeModule?.stopUpdates) {
    try {
      await nativeModule.stopUpdates();
    } catch {
      /* sensor teardown failure must not crash JS */
    }
  }
}

export function isListening(): boolean {
  return listening;
}

/** Sensor currently feeding step events, as reported by the native payload. */
export function getActiveSensorName(): StepSource {
  return listening ? activeSourceName : 'none';
}

/** Raw native sensor state — used by the pedometer's diagnostics readout. */
export async function getStepDiagnostics(): Promise<StepDiagnostics | null> {
  if (Platform.OS !== 'android' || !nativeModule?.getDiagnostics) {
    return null;
  }
  try {
    return (await nativeModule.getDiagnostics()) as StepDiagnostics;
  } catch {
    return null;
  }
}

/** Last value pushed through startStepUpdates (0 before the first event). */
export function getLastReportedSteps(): number {
  return lastReported;
}

/** Convenience: today's steps, preferring the hardware counter over the tracker. */
export function getBestKnownSteps(): number {
  const sensor = getTodaySensorSteps();
  return sensor > 0 ? sensor : getSteps();
}

/** Sets user biometrics to enable ultra-accurate native stride & speed math */
export function setUserBiometrics(weightKg: number, heightCm: number): void {
  if (Platform.OS === 'android' && nativeModule?.setUserBiometrics) {
    try {
      nativeModule.setUserBiometrics(weightKg, heightCm);
    } catch {
      /* non-critical */
    }
  }
}

/**
 * Starts the native Android Foreground Service.
 * Runs at fastest 1ms hardware polling rate (SENSOR_DELAY_FASTEST)
 * and stays active counting steps even if the user swipes away / kills the app!
 */
export async function startBackgroundPedometer(goalSteps = 10000, weightKg = 72, heightCm = 176): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.startForegroundService) {
    return false;
  }
  try {
    return Boolean(await nativeModule.startForegroundService(goalSteps, weightKg, heightCm));
  } catch {
    return false;
  }
}

/** Stops the persistent Android Foreground Service. */
export async function stopBackgroundPedometer(): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.stopForegroundService) {
    return false;
  }
  try {
    return Boolean(await nativeModule.stopForegroundService());
  } catch {
    return false;
  }
}

/**
 * Retrieves steps, distance, speed, and calories accumulated by the background
 * foreground service while the app was closed.
 */
export async function getBackgroundPedometerStats(): Promise<{
  steps: number;
  distanceKm: number;
  speedKmh: number;
  calories: number;
  isActive: boolean;
} | null> {
  if (Platform.OS !== 'android' || !nativeModule?.getBackgroundStats) {
    return null;
  }
  try {
    return (await nativeModule.getBackgroundStats()) as {
      steps: number;
      distanceKm: number;
      speedKmh: number;
      calories: number;
      isActive: boolean;
    };
  } catch {
    return null;
  }
}

/**
 * Returns the last 7 days of step data stored by the background pedometer.
 * Format: [{date: 'YYYY-MM-DD', steps: number, distanceKm: number, calories: number}, ...]
 * Oldest day first, today last.
 */
export async function getWeeklyStepsFromBackground(): Promise<
  Array<{date: string; steps: number; distanceKm: number; calories: number}>
> {
  if (Platform.OS !== 'android' || !nativeModule?.getWeeklyStats) {
    // Fallback: read from MMKV daily tracker history
    const days: Array<{date: string; steps: number; distanceKm: number; calories: number}> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const {appStorage} = await import('./storage');
      const steps = parseFloat(appStorage.getString(`steps_${dateKey}`) || '0') || 0;
      const distanceKm = parseFloat(appStorage.getString(`distance_km_${dateKey}`) || '0') || 0;
      const calories = parseFloat(appStorage.getString(`calories_burned_${dateKey}`) || '0') || 0;
      days.push({date: dateKey, steps, distanceKm, calories});
    }
    return days;
  }
  try {
    return (await nativeModule.getWeeklyStats()) as Array<{
      date: string;
      steps: number;
      distanceKm: number;
      calories: number;
    }>;
  } catch {
    return [];
  }
}

