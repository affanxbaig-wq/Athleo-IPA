/**
 * flowExerciseDataset.ts
 * Exercise dataset — powered by the RepDB exercise dataset
 * (https://github.com/RepDB/exercise-dataset), 650 movements.
 *
 * Every movement ships 512px WebP stills; most ship a `start` and a `peak`
 * still — the two ends of one repetition — which the previews cross-fade to
 * show the movement without needing a video.
 *
 * All public exports are preserved so screens don't need to change.
 */

import {useEffect, useState} from 'react';

import {getExerciseCategory, mapExerciseDifficulty} from './exercises';

// ── Types ─────────────────────────────────────────────────────────────────

export type FlowExerciseAnimation = {
  frames: string[];
  sequence: number[];
  frameDurationMs: number;
  license?: string;
  provenance?: string;
};

export type FlowExerciseRecord = {
  id: string;
  name: string;
  category?: 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core' | 'Cardio' | 'Full Body' | string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  movementPattern: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  instructions: string[];
  dataLicense?: string;
  mediaStatus?: string;
  animation?: FlowExerciseAnimation | null;
  imageFile?: string;
};

// ── Raw RepDB JSON type ───────────────────────────────────────────────────

type RepdbImages = {main?: string; start?: string; peak?: string};

type RepdbExercise = {
  id?: string;
  name_en?: string;
  category?: string;
  body_part?: string;
  equipment?: string;
  difficulty?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions_en?: string[];
  images?: {flat?: RepdbImages};
};

// ── Normalisation helpers ─────────────────────────────────────────────────

const normalizeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).map(item => String(item ?? '').trim()).filter(Boolean)
    : [];

/** "gluteus_maximus" → "Gluteus Maximus" */
const humanize = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, char => char.toUpperCase());

// ── Category mapping ──────────────────────────────────────────────────────

export function getExerciseMuscleCategory(exercise: {
  bodyPart?: string;
  target?: string;
  category?: string;
  movementPattern?: string;
}): 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core' | 'Cardio' | 'Full Body' {
  if (
    exercise.category &&
    ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body'].includes(
      exercise.category,
    )
  ) {
    return exercise.category as any;
  }
  const bp      = (exercise.bodyPart       || '').toLowerCase();
  const target  = (exercise.target         || '').toLowerCase();
  const cat     = (exercise.category       || '').toLowerCase();
  const pattern = (exercise.movementPattern || '').toLowerCase();
  const all     = `${cat} ${bp} ${target} ${pattern}`;

  if (all.includes('cardio')   || all.includes('cardiovascular'))                                         { return 'Cardio'; }
  if (all.includes('chest')    || all.includes('pectoral'))                                              { return 'Chest'; }
  if (all.includes('back')     || all.includes('lat') || all.includes('trap') || all.includes('spine'))  { return 'Back'; }
  if (all.includes('shoulder') || all.includes('delt') || all.includes('neck'))                          { return 'Shoulders'; }
  if (all.includes('arm')      || all.includes('bicep') || all.includes('tricep') || all.includes('forearm')) { return 'Arms'; }
  if (all.includes('leg')      || all.includes('quad') || all.includes('hamstring') || all.includes('glute') || all.includes('calv')) { return 'Legs'; }
  if (all.includes('waist')    || all.includes('core') || all.includes('ab'))                            { return 'Core'; }
  return 'Full Body';
}

export function mapFlowExerciseToWorkoutCategory(
  exercise: FlowExerciseRecord,
): 'Gym' | 'Home' | 'HIIT' | 'Strength' | 'Mobility' {
  const movement  = exercise.movementPattern?.toLowerCase() ?? '';
  const equipment = exercise.equipment?.toLowerCase()       ?? '';
  const bodyPart  = exercise.bodyPart?.toLowerCase()        ?? '';
  const name      = exercise.name?.toLowerCase()            ?? '';

  if (
    movement === 'cardio' ||
    bodyPart === 'cardio' ||
    equipment.includes('rope') ||
    equipment.includes('sled') ||
    name.includes('jump') ||
    name.includes('burpee')
  ) { return 'HIIT'; }

  if (
    movement === 'mobility' ||
    name.includes('stretch') ||
    name.includes('foam roll') ||
    name.includes('mobility')
  ) { return 'Mobility'; }

  if (
    equipment.includes('barbell') ||
    equipment.includes('olympic') ||
    name.includes('bench press') ||
    name.includes('deadlift') ||
    name.includes('squat') ||
    name.includes('overhead press')
  ) { return 'Strength'; }

  if (equipment.includes('body weight') || equipment.includes('band')) {
    return 'Home';
  }

  return 'Gym';
}

// ── RepDB → FlowExerciseRecord mapper ─────────────────────────────────────

const mapRepdbExercise = (ex: RepdbExercise, index: number): FlowExerciseRecord => {
  const bodyPartRaw = normalizeString(ex.body_part, 'full_body');
  const equipmentRaw = normalizeString(ex.equipment);
  const primaryMuscles = toStringArray(ex.primary_muscles);
  const movementFamily = normalizeString(ex.category);

  const bodyPart = humanize(bodyPartRaw);
  const equipment = equipmentRaw ? humanize(equipmentRaw) : 'Body Weight';
  const target = humanize(primaryMuscles[0] ?? bodyPartRaw);
  const category = getExerciseCategory(bodyPartRaw, movementFamily);

  const flat = ex.images?.flat;
  const start = normalizeString(flat?.start);
  const peak = normalizeString(flat?.peak);
  const still = normalizeString(flat?.main) || start || peak;

  // start + peak are the two ends of one rep — enough for a form loop.
  const frames = start && peak ? [start, peak] : [];

  return {
    id: normalizeString(ex.id ?? `repdb-${index + 1}`, `repdb-${index + 1}`),
    name: normalizeString(ex.name_en, `Exercise ${index + 1}`),
    category,
    bodyPart,
    equipment,
    target,
    secondaryMuscles: toStringArray(ex.secondary_muscles).map(humanize),
    movementPattern: movementFamily || category.toLowerCase(),
    difficulty: mapExerciseDifficulty(normalizeString(ex.difficulty)),
    instructions: toStringArray(ex.instructions_en),
    dataLicense: 'RepDB free tier — https://repdb.co',
    mediaStatus: frames.length > 1 ? 'animated' : still ? 'image_only' : 'none',
    animation: frames.length > 1
      ? {
          frames,
          sequence: [0, 1],
          frameDurationMs: 2400,
          license: 'RepDB free tier',
          provenance: 'https://github.com/RepDB/exercise-dataset',
        }
      : null,
    imageFile: still,
  };
};

// ── Build primary local dataset from the RepDB JSON ───────────────────────

const REPDB_RAW: {exercises?: RepdbExercise[]} = require('../../repdb-exercise-dataset/exercises.json');

const LOCAL_DATASET: FlowExerciseRecord[] = (REPDB_RAW.exercises ?? []).map(mapRepdbExercise);

let DATASET_CACHE: FlowExerciseRecord[] = LOCAL_DATASET;

// ── Supabase fetch (optional live override) ───────────────────────────────

export async function fetchFlowExerciseDataset(): Promise<FlowExerciseRecord[]> {
  // Always use the bundled RepDB dataset — the Supabase exercises table
  // contained the old GymX data and would override the new dataset.
  DATASET_CACHE = LOCAL_DATASET;
  return DATASET_CACHE;
}

export function loadFlowExerciseDataset(limit?: number): FlowExerciseRecord[] {
  const source = DATASET_CACHE.length > 0 ? DATASET_CACHE : LOCAL_DATASET;
  return typeof limit === 'number' ? source.slice(0, limit) : source;
}

export function useFlowExerciseDataset(limit?: number): FlowExerciseRecord[] {
  const [dataset, setDataset] = useState<FlowExerciseRecord[]>(() =>
    loadFlowExerciseDataset(limit),
  );

  useEffect(() => {
    let cancelled = false;
    fetchFlowExerciseDataset()
      .then(next => {
        if (!cancelled) {
          setDataset(limit === undefined ? next : next.slice(0, limit));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataset(loadFlowExerciseDataset(limit));
        }
      });
    return () => { cancelled = true; };
  }, [limit]);

  return dataset;
}
