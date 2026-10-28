/**
 * exercises.ts
 * Full exercise library sourced from the RepDB exercise dataset
 * (https://github.com/RepDB/exercise-dataset) — 650 movements with 512px WebP
 * form images, muscles, equipment and EN/DE/ES instructions.
 *
 * Dataset file: repdb-exercise-dataset/exercises.json (project root)
 *
 * RepDB fields used:
 *   id, name_en, description_en, category, force_type, mechanic, difficulty,
 *   body_part, primary_muscles, secondary_muscles, instructions_en, images.flat
 */

export type ExerciseCategory =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'
  | 'Full Body';

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  focus: string;
  sets: number;
  reps: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  equipment: string;
  bodyPart?: string;
  target?: string;
  secondaryMuscles?: string[];
  imageFile?: string;
  steps?: string[];
};

// ─── Raw shape from the RepDB dataset ────────────────────────────────────────
type RawRepdbFlatImages = {
  main?: string;
  start?: string;
  peak?: string;
};

type RawRepdbExercise = {
  id?: string;
  name_en?: string;
  description_en?: string;
  /** Movement family: strength | stretching | cardio | olympic | plyometrics */
  category?: string;
  force_type?: string;
  mechanic?: string;
  /** beginner | intermediate | advanced */
  difficulty?: string;
  /** chest | back | shoulders | upper_arms | lower_arms | upper_legs | lower_legs | core | full_body */
  body_part?: string;
  equipment?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions_en?: string[];
  images?: {flat?: RawRepdbFlatImages};
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const normalizeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number') { return String(value); }
  return fallback;
};

/** "gluteus_maximus" → "Gluteus Maximus" */
const humanize = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, char => char.toUpperCase());

const BODY_PART_TO_CATEGORY: Record<string, ExerciseCategory> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  upper_arms: 'Arms',
  lower_arms: 'Arms',
  upper_legs: 'Legs',
  lower_legs: 'Legs',
  core: 'Core',
  full_body: 'Full Body',
};

/**
 * Maps a RepDB body part + movement family onto the app's eight categories.
 * Shared with flowExerciseDataset.ts so both views of the dataset agree.
 */
export const getExerciseCategory = (
  bodyPart: string,
  movementFamily: string,
): ExerciseCategory => {
  if (movementFamily.toLowerCase() === 'cardio') { return 'Cardio'; }
  return BODY_PART_TO_CATEGORY[bodyPart.toLowerCase()] ?? 'Full Body';
};

/**
 * Normalises a RepDB difficulty token onto the app's three levels.
 * Shared with flowExerciseDataset.ts so every screen shows the same value.
 */
export const mapExerciseDifficulty = (
  value: string,
): 'Beginner' | 'Intermediate' | 'Advanced' => {
  const s = value.toLowerCase();
  if (s === 'beginner') { return 'Beginner'; }
  if (s === 'advanced') { return 'Advanced'; }
  return 'Intermediate';
};

const mapDifficulty = (value: string): Exercise['difficulty'] =>
  mapExerciseDifficulty(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).map(item => String(item ?? '').trim()).filter(Boolean)
    : [];

/** first still we can show for the movement */
const pickStill = (flat?: RawRepdbFlatImages): string =>
  normalizeString(flat?.main) || normalizeString(flat?.start) || normalizeString(flat?.peak);

// ─── Load dataset ─────────────────────────────────────────────────────────────
const rawData = require('../../repdb-exercise-dataset/exercises.json') as {
  exercises: RawRepdbExercise[];
};

// ─── Build exercise library ───────────────────────────────────────────────────
export const exerciseLibrary: Exercise[] = (rawData.exercises ?? []).map((exercise, index) => {
  const bodyPartRaw = normalizeString(exercise.body_part, 'full_body');
  const equipmentRaw = normalizeString(exercise.equipment, 'body weight');
  const primaryMuscles = toStringArray(exercise.primary_muscles);
  const targetRaw = primaryMuscles[0] ?? bodyPartRaw;

  const bodyPart = humanize(bodyPartRaw);
  const equipment = humanize(equipmentRaw);
  const target = humanize(targetRaw);
  const category = getExerciseCategory(bodyPartRaw, normalizeString(exercise.category));

  // Description: opening line of the English description (capped at 220 chars)
  const rawDescription = normalizeString(exercise.description_en).replace(/\s+/g, ' ').trim();
  const description = rawDescription.slice(0, 220).trim() ||
    'Train with controlled tempo and proper form for best results.';

  return {
    id: normalizeString(exercise.id ?? `exercise-${index + 1}`, `exercise-${index + 1}`),
    name: normalizeString(exercise.name_en, `Exercise ${index + 1}`),
    category,
    focus: target,
    sets: category === 'Cardio' ? 5 : category === 'Core' ? 3 : 4,
    reps: category === 'Cardio' ? '30-90 sec' : category === 'Core' ? '20-45 sec' : '8-12',
    difficulty: mapDifficulty(normalizeString(exercise.difficulty)),
    description,
    equipment,
    bodyPart,
    target,
    secondaryMuscles: toStringArray(exercise.secondary_muscles).map(humanize),
    imageFile: pickStill(exercise.images?.flat),
    steps: toStringArray(exercise.instructions_en),
  };
});

// ─── Utility exports ──────────────────────────────────────────────────────────
export const exerciseInventorySummary = {
  chest:    exerciseLibrary.filter(ex => ex.category === 'Chest').length,
  back:     exerciseLibrary.filter(ex => ex.category === 'Back').length,
  shoulders:exerciseLibrary.filter(ex => ex.category === 'Shoulders').length,
  arms:     exerciseLibrary.filter(ex => ex.category === 'Arms').length,
  legs:     exerciseLibrary.filter(ex => ex.category === 'Legs').length,
  core:     exerciseLibrary.filter(ex => ex.category === 'Core').length,
  cardio:   exerciseLibrary.filter(ex => ex.category === 'Cardio').length,
  fullbody: exerciseLibrary.filter(ex => ex.category === 'Full Body').length,
  totalCatalogEntries: exerciseLibrary.length,
};

export const getExercisesByCategory = (category: Exercise['category']) =>
  exerciseLibrary.filter(exercise => exercise.category === category);

export const getExerciseById = (id: string) =>
  exerciseLibrary.find(exercise => exercise.id === id);

export const getExercisesByEquipment = (equipment: string) =>
  exerciseLibrary.filter(exercise =>
    exercise.equipment.toLowerCase().includes(equipment.toLowerCase()),
  );
