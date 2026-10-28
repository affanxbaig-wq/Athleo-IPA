/**
 * customWorkoutService.ts
 * Local store for user-built workouts ("Custom Workout Builder").
 *
 * Everything the athlete builds is written here — nothing on that screen is a
 * hardcoded sample any more. The service is offline-first (MMKV) exactly like
 * `progressTracker` / `dailyTracker`, so a saved routine survives a restart and
 * stays usable with no network. It is deliberately storage-only: the builder
 * screen owns the editing UI and asks this module to load/save.
 */

import {appStorage} from './storage';

const STORAGE_KEY = 'athleo_custom_workouts';

export type CustomSetType = 'Warm' | 'Work' | 'Drop';

export type CustomSet = {
  id: string;
  type: CustomSetType;
  reps: number;
  loadKg: number;
  restSec: number;
};

export type CustomExerciseEntry = {
  id: string;
  /** Dataset id so the builder can show the real animation/instructions later. */
  exerciseId: string;
  name: string;
  target: string;
  bodyPart: string;
  sets: CustomSet[];
};

export type CustomWorkout = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: CustomExerciseEntry[];
};

/** Real workload estimate — no invented numbers, just arithmetic on the plan. */
export type CustomWorkoutEstimate = {
  totalSets: number;
  /** Sum of reps × load across every set. */
  totalVolumeKg: number;
  /** Sets × (rest + ~40 s of work) per set, in whole minutes. */
  estimatedMinutes: number;
  /** 1RM-based intensity hint from the average load, or null when no load is set. */
  averageLoadKg: number;
};

const DEFAULT_REST_SEC = 90;
const WORK_SECONDS_PER_SET = 40;

const estimateWorkout = (workout: Pick<CustomWorkout, 'entries'>): CustomWorkoutEstimate => {
  let totalSets = 0;
  let totalVolumeKg = 0;
  let totalSeconds = 0;
  let loadSum = 0;
  let loadedSets = 0;

  workout.entries.forEach(entry => {
    entry.sets.forEach(set => {
      totalSets += 1;
      totalVolumeKg += set.reps * set.loadKg;
      totalSeconds += set.restSec + WORK_SECONDS_PER_SET;
      if (set.loadKg > 0) {
        loadSum += set.loadKg;
        loadedSets += 1;
      }
    });
  });

  return {
    totalSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    estimatedMinutes: Math.max(1, Math.round(totalSeconds / 60)),
    averageLoadKg: loadedSets > 0 ? Math.round((loadSum / loadedSets) * 10) / 10 : 0,
  };
};

const isCustomSet = (value: unknown): value is CustomSet => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const set = value as CustomSet;
  return typeof set.reps === 'number' && typeof set.loadKg === 'number';
};

const isCustomWorkout = (value: unknown): value is CustomWorkout => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const workout = value as CustomWorkout;
  return typeof workout.id === 'string' && Array.isArray(workout.entries);
};

/** Defensive read: a corrupt/partial payload must not crash the builder. */
export function loadCustomWorkouts(): CustomWorkout[] {
  const stored = appStorage.getObject<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .filter(isCustomWorkout)
    .map(workout => ({
      ...workout,
      entries: workout.entries.map(entry => ({
        ...entry,
        sets: Array.isArray(entry.sets) ? entry.sets.filter(isCustomSet) : [],
      })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function persist(workouts: CustomWorkout[]): void {
  appStorage.setObject(STORAGE_KEY, workouts);
}

/** Create or update by id. Returns the full saved list, newest first. */
export function saveCustomWorkout(workout: CustomWorkout): CustomWorkout[] {
  const existing = loadCustomWorkouts();
  const now = Date.now();
  const next: CustomWorkout = {
    ...workout,
    title: workout.title.trim() || 'Untitled Session',
    createdAt: workout.createdAt || now,
    updatedAt: now,
  };
  const withoutCurrent = existing.filter(item => item.id !== next.id);
  const merged = [next, ...withoutCurrent].sort((a, b) => b.updatedAt - a.updatedAt);
  persist(merged);
  return merged;
}

export function deleteCustomWorkout(id: string): CustomWorkout[] {
  const next = loadCustomWorkouts().filter(item => item.id !== id);
  persist(next);
  return next;
}

export function getCustomWorkout(id: string): CustomWorkout | null {
  return loadCustomWorkouts().find(item => item.id === id) ?? null;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createCustomSet(overrides: Partial<CustomSet> = {}): CustomSet {
  return {
    id: makeId('set'),
    type: 'Work',
    reps: 10,
    loadKg: 0,
    restSec: DEFAULT_REST_SEC,
    ...overrides,
  };
}

export function createCustomEntry(input: {
  exerciseId: string;
  name: string;
  target: string;
  bodyPart: string;
  sets?: CustomSet[];
}): CustomExerciseEntry {
  return {
    id: makeId('entry'),
    exerciseId: input.exerciseId,
    name: input.name,
    target: input.target,
    bodyPart: input.bodyPart,
    sets: input.sets ?? [createCustomSet(), createCustomSet(), createCustomSet()],
  };
}

export function createEmptyWorkout(title = 'New Session'): CustomWorkout {
  const now = Date.now();
  return {
    id: makeId('workout'),
    title,
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
}

export {estimateWorkout};
