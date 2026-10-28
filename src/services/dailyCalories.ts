export type FoodConsumptionEntry = {
  id: string;
  name: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  addedAt: number;
};

export type DailyTotals = {
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  consumedEntries: FoodConsumptionEntry[];
};

import {appStorage} from './storage';
import {getTodayKey, setCaloriesConsumed} from './dailyTracker';

const DAILY_CALORIES_KEY = 'athleo_daily_calories';

type PersistedCalories = {
  date: string;
  consumedEntries: FoodConsumptionEntry[];
};

const cachedState = appStorage.getObject<PersistedCalories>(DAILY_CALORIES_KEY);
// This store only ever holds a single day of food entries. Entries written on an
// earlier day are dropped on load, which previously never happened — so
// yesterday's meals silently carried over into today's totals.
const isSameDay = cachedState?.date === getTodayKey();

const state = {
  date: getTodayKey(),
  consumedEntries: isSameDay
    ? (cachedState?.consumedEntries ?? ([] as FoodConsumptionEntry[]))
    : ([] as FoodConsumptionEntry[]),
};

const listeners = new Set<(t: DailyTotals) => void>();

/** Drops the previous day's entries the moment the date rolls over. */
function rolloverIfNewDay(): void {
  const today = getTodayKey();
  if (state.date !== today) {
    state.date = today;
    state.consumedEntries = [];
  }
}

function persistState() {
  appStorage.setObject(DAILY_CALORIES_KEY, state);
}

function computeTotals(): DailyTotals {
  rolloverIfNewDay();
  const consumedCalories = state.consumedEntries.reduce((s, e) => s + e.calories, 0);
  const consumedProtein = state.consumedEntries.reduce((s, e) => s + e.protein, 0);
  const consumedCarbs = state.consumedEntries.reduce((s, e) => s + e.carbs, 0);
  const consumedFat = state.consumedEntries.reduce((s, e) => s + e.fat, 0);
  return {
    consumedCalories,
    consumedProtein,
    consumedCarbs,
    consumedFat,
    consumedEntries: [...state.consumedEntries],
  };
}

/**
 * Mirrors the food total into `dailyTracker`, which is what the dashboard, the
 * pedometer and the Supabase rollup read. Without this bridge, logging a meal
 * only updated this store and every calorie figure in the app stayed at 0.
 *
 * Active energy burned is deliberately NOT tracked here — that number is owned
 * solely by `dailyTracker.calories_burned` (fed by the step sensor and manual
 * workout logging), so the two stores can never drift apart or double count.
 */
function mirrorToDailyTracker(totals: DailyTotals): void {
  try {
    setCaloriesConsumed(totals.consumedCalories);
  } catch {
    /* non-critical */
  }
}

function notify() {
  rolloverIfNewDay();
  const totals = computeTotals();
  persistState();
  mirrorToDailyTracker(totals);
  listeners.forEach(l => {
    try { l(totals); } catch { /* ignore */ }
  });
}

// Re-seed the shared metric on cold start so the dashboard is correct before
// the user logs anything in this session.
mirrorToDailyTracker(computeTotals());

export function getDailyTotals(): DailyTotals {
  return computeTotals();
}

export function addFoodConsumed(entry: Omit<FoodConsumptionEntry, 'addedAt' | 'id'>): DailyTotals {
  state.consumedEntries.push({
    ...entry,
    addedAt: Date.now(),
    id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  });
  notify();
  return computeTotals();
}

export function subscribeToDailyCalories(
  callback: (t: DailyTotals) => void,
  fireImmediately = true,
): () => void {
  listeners.add(callback);
  if (fireImmediately) {
    try { callback(computeTotals()); } catch { /* ignore */ }
  }
  return () => listeners.delete(callback);
}

export function resetDailyStore(): DailyTotals {
  state.consumedEntries = [];
  notify();
  return computeTotals();
}
