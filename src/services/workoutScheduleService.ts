/**
 * workoutScheduleService.ts
 *
 * Manages user's workout schedule, chosen fitness exercises,
 * auto-derived goal reminders, and Supabase synchronization.
 */

import {getSupabaseClient} from './auth';
import {isSupabaseConfigured} from '../config/supabase';
import {appStorage} from './storage';
import {getUserProfile, type UserProfile, getBmiBand} from './userProfile';
import {getCachedLocationProfile, type UserLocationProfile} from './locationTimezoneService';
import {scheduleCustomWorkoutReminder} from './notificationService';

export interface SelectedWorkoutExercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  sets?: number;
  reps?: string;
}

export interface WorkoutScheduleData {
  workoutTime: string; // e.g. "07:00 AM"
  workoutDays: string[]; // e.g. ["Monday", "Wednesday", "Friday"]
  selectedExercises: SelectedWorkoutExercise[];
  reminderEnabled: boolean;
  timezone: string;
  country: string;
  region: string;
  city: string;
}

export interface GeneratedReminderSnapshot {
  title: string;
  body: string;
  goalSummary: string;
  appSuggestion: string;
  scheduledTime: string;
  timezone: string;
  country?: string;
  region?: string;
}

export interface WeeklyWorkoutDay {
  dayName: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  focus: string;
  targetMuscles: string[];
  durationMin: number;
  intensity: 'Low' | 'Moderate' | 'High' | 'Peak';
  estimatedKcal: number;
  exercises: SelectedWorkoutExercise[];
  coachNote: string;
  isRestDay: boolean;
}

export interface WeeklyWorkoutPlan {
  planTitle: string;
  subtitle: string;
  targetGoal: string;
  bodyProfileSummary: {
    bmi: number;
    bmiCategory: string;
    age: number;
    heightCm: number;
    weightKg: number;
    bodyShape: string;
    fitnessLevel: string;
  };
  weeklyVolumeSets: number;
  weeklyBurnKcal: number;
  days: WeeklyWorkoutDay[];
}

const STORAGE_KEY_SCHEDULE    = 'athleo_workout_schedule_data';
const STORAGE_KEY_REMINDER    = 'athleo_last_generated_reminder';
const STORAGE_KEY_WEEKLY_PLAN = 'athleo_personalized_weekly_plan';
const STORAGE_KEY_PLAN_SIG    = 'athleo_personalized_weekly_plan_sig';
// Bump this version whenever the exercise dataset changes to force-clear old cached plans
const WEEKLY_PLAN_VERSION     = 'kaggle-v1';
const STORAGE_KEY_PLAN_VER    = 'athleo_weekly_plan_version';

function getPlanSignature(profile: UserProfile): string {
  return [
    profile.goal ?? 'wellness',
    profile.weightKg ?? 72,
    profile.heightCm ?? 176,
    profile.bodyShape ?? profile.bodyType ?? 'meso',
    profile.fitnessLevel ?? profile.experience ?? 'beginner',
    profile.activityLevel ?? 'moderate',
    profile.stress ?? 'medium',
    profile.targetWeightKg ?? 0,
  ].join('|');
}

export const DEFAULT_WORKOUT_EXERCISES: SelectedWorkoutExercise[] = [
  {id: 'squat', name: 'Barbell Back Squat', bodyPart: 'Legs', equipment: 'Barbell', target: 'Quadriceps', sets: 4, reps: '8-10'},
  {id: 'bench-press', name: 'Barbell Bench Press', bodyPart: 'Chest', equipment: 'Barbell', target: 'Pectorals', sets: 4, reps: '8-10'},
  {id: 'lat-pulldown', name: 'Lat Pulldown', bodyPart: 'Back', equipment: 'Cable', target: 'Latissimus Dorsi', sets: 3, reps: '10-12'},
  {id: 'pushup', name: 'Push-up', bodyPart: 'Chest', equipment: 'Bodyweight', target: 'Chest & Core', sets: 3, reps: '12-15'},
  {id: 'plank', name: 'Standard Plank', bodyPart: 'Core', equipment: 'Bodyweight', target: 'Abdominals', sets: 3, reps: '45s'},
];

let cachedSchedule: WorkoutScheduleData | null = null;
const scheduleListeners = new Set<(schedule: WorkoutScheduleData) => void>();

export function getCachedWorkoutSchedule(): WorkoutScheduleData {
  if (cachedSchedule) {
    return cachedSchedule;
  }
  const saved = appStorage.getObject<WorkoutScheduleData>(STORAGE_KEY_SCHEDULE);
  if (saved) {
    cachedSchedule = saved;
    return saved;
  }

  const loc = getCachedLocationProfile();
  const initial: WorkoutScheduleData = {
    workoutTime: '07:00 AM',
    workoutDays: ['Monday', 'Wednesday', 'Friday'],
    selectedExercises: DEFAULT_WORKOUT_EXERCISES,
    reminderEnabled: true,
    timezone: loc.timezone,
    country: loc.country,
    region: loc.region,
    city: loc.city,
  };

  cachedSchedule = initial;
  return initial;
}

export function subscribeWorkoutSchedule(cb: (schedule: WorkoutScheduleData) => void): () => void {
  scheduleListeners.add(cb);
  cb(getCachedWorkoutSchedule());
  return () => scheduleListeners.delete(cb);
}

function broadcastSchedule(data: WorkoutScheduleData): void {
  cachedSchedule = data;
  appStorage.setObject(STORAGE_KEY_SCHEDULE, data);
  scheduleListeners.forEach(cb => cb(data));
}

/**
 * Builds the personalized reminder payload from body metrics, goals, and schedule
 */
export function generateLocalReminderPreview(
  schedule: WorkoutScheduleData,
  profile?: UserProfile,
  loc?: UserLocationProfile,
): GeneratedReminderSnapshot {
  const p = profile ?? getUserProfile();
  const l = loc ?? getCachedLocationProfile();

  let goalLabel = 'General Fitness';
  switch (p.goal) {
    case 'fat':
      goalLabel = 'Fat Loss & Conditioning';
      break;
    case 'muscle':
      goalLabel = 'Muscle Hypertrophy';
      break;
    case 'strength':
      goalLabel = 'Maximum Strength';
      break;
    case 'endurance':
      goalLabel = 'Athletic Endurance';
      break;
    case 'flexibility':
    case 'wellness':
      goalLabel = 'Full Body Health & Mobility';
      break;
  }

  const goalSummary = p.targetWeightKg
    ? `Goal: ${goalLabel} (Current: ${p.weightKg} kg → Target: ${p.targetWeightKg} kg)`
    : `Goal: ${goalLabel} (Body Weight: ${p.weightKg} kg)`;

  // Recommendation derived from personal metrics
  const targetKcal = p.goal === 'fat' ? 2050 : p.goal === 'muscle' ? 2600 : 2300;
  const targetProtein = Math.round(p.weightKg * (p.goal === 'muscle' ? 2.2 : 1.8));

  const appSuggestion = `App Suggestion: Daily target ~${targetKcal} kcal, ${targetProtein}g protein. Focus on clean execution and adequate recovery.`;

  const exerciseNames = schedule.selectedExercises.length > 0
    ? schedule.selectedExercises.map(e => e.name).slice(0, 3).join(', ') +
      (schedule.selectedExercises.length > 3 ? ` +${schedule.selectedExercises.length - 3} more` : '')
    : 'Personalized Daily Workout Protocol';

  const title = `🏋️ Workout Reminder (${schedule.workoutTime}) — ${goalLabel}`;
  const body = `${goalSummary}. Today's Focus: ${exerciseNames}. ${appSuggestion}`;

  const snapshot: GeneratedReminderSnapshot = {
    title,
    body,
    goalSummary,
    appSuggestion,
    scheduledTime: schedule.workoutTime,
    timezone: schedule.timezone || l.timezone,
    country: schedule.country || l.country,
    region: schedule.region || l.region,
  };

  appStorage.setObject(STORAGE_KEY_REMINDER, snapshot);
  return snapshot;
}

export function getCachedReminderSnapshot(): GeneratedReminderSnapshot | null {
  return appStorage.getObject<GeneratedReminderSnapshot>(STORAGE_KEY_REMINDER);
}

/**
 * Saves workout schedule, updates local notification triggers, and syncs to Supabase.
 */
export async function saveAndSyncWorkoutSchedule(
  schedule: Partial<WorkoutScheduleData>,
): Promise<{ok: boolean; reminder: GeneratedReminderSnapshot}> {
  const current = getCachedWorkoutSchedule();
  const loc = getCachedLocationProfile();

  const updated: WorkoutScheduleData = {
    ...current,
    ...schedule,
    timezone: schedule.timezone ?? current.timezone ?? loc.timezone,
    country: schedule.country ?? current.country ?? loc.country,
    region: schedule.region ?? current.region ?? loc.region,
    city: schedule.city ?? current.city ?? loc.city,
  };

  broadcastSchedule(updated);

  // Generate reminder snapshot
  const reminder = generateLocalReminderPreview(updated);

  // Schedule native Notifee trigger notification if enabled
  if (updated.reminderEnabled) {
    try {
      await scheduleCustomWorkoutReminder({
        timeStr: updated.workoutTime,
        title: reminder.title,
        body: reminder.body,
        timezone: updated.timezone,
      });
    } catch (e) {
      console.warn('[workoutSchedule] scheduleCustomWorkoutReminder failed:', e);
    }
  }

  // Sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const {data, error} = await (supabase as any).rpc('save_workout_schedule_and_exercises', {
        p_workout_time: updated.workoutTime,
        p_workout_days: updated.workoutDays,
        p_selected_exercises: updated.selectedExercises,
        p_reminder_enabled: updated.reminderEnabled,
      });

      if (error) {
        console.warn('[workoutSchedule] save_workout_schedule_and_exercises RPC error:', error.message);
      } else if (data?.ok) {
        return {ok: true, reminder};
      }
    } catch (err) {
      console.warn('[workoutSchedule] Sync to Supabase threw:', err);
    }
  }

  return {ok: true, reminder};
}

/**
 * Fetches latest schedule and reminder from Supabase
 */
export async function fetchScheduleFromSupabase(): Promise<WorkoutScheduleData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any).rpc('get_user_workout_schedule');

    if (error || !data?.ok) {
      return null;
    }

    const s = data.schedule;
    const l = data.location;
    const fetched: WorkoutScheduleData = {
      workoutTime: s?.workout_time ?? '07:00 AM',
      workoutDays: s?.workout_days ?? ['Monday', 'Wednesday', 'Friday'],
      selectedExercises: Array.isArray(s?.selected_exercises) ? s.selected_exercises : DEFAULT_WORKOUT_EXERCISES,
      reminderEnabled: s?.reminder_enabled ?? true,
      timezone: l?.timezone ?? 'UTC',
      country: l?.country ?? '',
      region: l?.region ?? '',
      city: l?.city ?? '',
    };

    broadcastSchedule(fetched);
    if (data.reminder) {
      const r = data.reminder;
      appStorage.setObject(STORAGE_KEY_REMINDER, {
        title: r.title,
        body: r.body,
        goalSummary: r.goal_snapshot,
        appSuggestion: r.suggestion_snapshot,
        scheduledTime: r.scheduled_time,
        timezone: r.timezone,
        country: r.country,
        region: r.region,
      });
    }

    return fetched;
  } catch (err) {
    console.warn('[workoutSchedule] fetchScheduleFromSupabase threw:', err);
    return null;
  }
}

/**
 * Returns the cached personalized weekly plan, or generates a fresh one
 * if none exists yet.
 */
export function getCachedWeeklyPlan(): WeeklyWorkoutPlan {
  const currentProfile = getUserProfile();
  const storedVersion = appStorage.getString(STORAGE_KEY_PLAN_VER) ?? '';
  const storedSignature = appStorage.getString(STORAGE_KEY_PLAN_SIG) ?? '';
  const signatureMatches = storedSignature === getPlanSignature(currentProfile);

  if (storedVersion !== WEEKLY_PLAN_VERSION || !signatureMatches) {
    appStorage.delete(STORAGE_KEY_WEEKLY_PLAN);
    appStorage.setString(STORAGE_KEY_PLAN_VER, WEEKLY_PLAN_VERSION);
    appStorage.setString(STORAGE_KEY_PLAN_SIG, getPlanSignature(currentProfile));
    return generatePersonalizedWeeklySchedule(currentProfile);
  }

  const saved = appStorage.getObject<WeeklyWorkoutPlan>(STORAGE_KEY_WEEKLY_PLAN);
  if (saved && Array.isArray(saved.days) && saved.days.length === 7) {
    return saved;
  }

  return generatePersonalizedWeeklySchedule(currentProfile);
}

function makeExercise(id: string, name: string, bodyPart: string, equipment: string, target: string, sets: number, reps: string): SelectedWorkoutExercise {
  return {id, name, bodyPart, equipment, target, sets, reps};
}

function buildDay(
  dayName: WeeklyWorkoutDay['dayName'],
  focus: string,
  targetMuscles: string[],
  durationMin: number,
  intensity: WeeklyWorkoutDay['intensity'],
  exercises: SelectedWorkoutExercise[],
  coachNote: string,
  isRestDay = false,
): WeeklyWorkoutDay {
  return {
    dayName,
    focus,
    targetMuscles,
    durationMin,
    intensity,
    estimatedKcal: Math.max(120, Math.round(exercises.length * 28 + durationMin * 0.7)),
    exercises,
    coachNote,
    isRestDay,
  };
}

function buildDaySpecificExercises(profile: UserProfile, goal: string, level: string, bmiBand: ReturnType<typeof getBmiBand>): Record<string, SelectedWorkoutExercise[]> {
  const setsBase = level === 'advanced' ? 5 : level === 'intermediate' ? 4 : 3;
  const repStrength = goal === 'fat' ? '12-15' : goal === 'strength' ? '5-8' : goal === 'endurance' ? '10-12' : '8-12';
  const repUpper = goal === 'fat' ? '12-15' : '8-12';
  const repLower = goal === 'fat' ? '10-15' : '6-10';

  const cardioVolume = bmiBand === 'overweight' || bmiBand === 'obese' ? '18-22 min' : '12-18 min';

  return {
    push: [
      makeExercise('bench-press', 'Barbell Flat Bench Press', 'Chest', 'Barbell', 'Pectoralis Major', setsBase, repUpper),
      makeExercise('incline-db', 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Upper Chest', Math.max(2, setsBase - 1), '10-12'),
      makeExercise('overhead-press', 'Seated Overhead Press', 'Shoulders', 'Dumbbell', 'Deltoids', setsBase - 1, '8-10'),
      makeExercise('tricep-pushdown', 'Cable Tricep Extension', 'Arms', 'Cable', 'Triceps', 3, '12-15'),
    ],
    pull: [
      makeExercise('lat-pulldown', 'Wide-Grip Lat Pulldown', 'Back', 'Cable', 'Latissimus Dorsi', setsBase, '10-12'),
      makeExercise('barbell-row', 'Bent-Over Barbell Row', 'Back', 'Barbell', 'Mid-Back & Rhomboids', setsBase, repStrength),
      makeExercise('seated-cable-row', 'Neutral-Grip Seated Row', 'Back', 'Cable', 'Lower Lats', 3, '10-12'),
      makeExercise('face-pull', 'Cable Face Pull', 'Shoulders', 'Cable', 'Rear Deltoids', 3, '12-15'),
      makeExercise('incline-curl', 'Incline DB Curl', 'Arms', 'Dumbbell', 'Biceps', 3, '10-12'),
    ],
    legs: [
      makeExercise('squat', 'Barbell Back Squat', 'Legs', 'Barbell', 'Quadriceps & Glutes', setsBase, repLower),
      makeExercise('romanian-deadlift', 'Romanian Deadlift', 'Legs', 'Dumbbell', 'Hamstrings & Posterior Chain', setsBase, '8-10'),
      makeExercise('bulgarian-split-squat', 'Bulgarian Split Squat', 'Legs', 'Dumbbells', 'Glutes & Quads', 3, '8-10/leg'),
      makeExercise('leg-curl', 'Seated Leg Curl', 'Legs', 'Machine', 'Hamstrings', 3, '10-12'),
      makeExercise('standing-calf', 'Standing Calf Raise', 'Calves', 'Machine', 'Gastrocnemius', 4, '12-15'),
    ],
    core: [
      makeExercise('plank', 'Standard Plank', 'Core', 'Bodyweight', 'Abdominals', 3, '45-60s'),
      makeExercise('hanging-leg-raise', 'Hanging Knee Raise', 'Core', 'Pull-up Bar', 'Lower Abs', 3, '10-12'),
      makeExercise('bird-dog', 'Bird-Dog', 'Core', 'Bodyweight', 'Spinal Stabilizers', 3, '12/side'),
      makeExercise('dead-bug', 'Dead Bug', 'Core', 'Bodyweight', 'Deep Core', 3, '10/side'),
    ],
    conditioning: [
      makeExercise('treadmill-walk', 'Incline Treadmill Walk', 'Cardio', 'Treadmill', 'Aerobic Base', 1, cardioVolume),
      makeExercise('mountain-climbers', 'Mountain Climbers', 'Core', 'Bodyweight', 'Cardiovascular Core', 4, '30s'),
      makeExercise('kettlebell-swing', 'Kettlebell Swing', 'Full Body', 'Kettlebell', 'Posterior Chain', 4, '12-15'),
      makeExercise('jump-rope', 'Jump Rope Intervals', 'Cardio', 'Rope', 'Conditioning', 4, '20-30s'),
    ],
    mobility: [
      makeExercise('foam-roll', 'Full-Body Foam Rolling', 'Mobility', 'Foam Roller', 'Myofascial Release', 1, '10 min'),
      makeExercise('pigeon-pose', 'Pigeon Pose', 'Mobility', 'Mat', 'Hip Flexors', 2, '60s/side'),
      makeExercise('cat-cow', 'Cat-Cow', 'Mobility', 'Mat', 'Thoracic Mobility', 3, '10 breaths'),
      makeExercise('hip-flexor-stretch', 'Hip Flexor Stretch', 'Mobility', 'Bodyweight', 'Glutes & Hips', 2, '45s/side'),
    ],
  };
}

/**
 * Generates a realistic weekly split that changes based on the user's actual body metrics,
 * training goal, BMI status, and training level instead of a generic mixed-up template.
 */
export function generatePersonalizedWeeklySchedule(customProfile?: UserProfile): WeeklyWorkoutPlan {
  const profile = customProfile || getUserProfile();
  const heightCm = Math.max(120, Math.min(230, profile.heightCm || 176));
  const weightKg = Math.max(40, Math.min(220, profile.weightKg || 72));
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  const currentYear = new Date().getFullYear();
  const birthYear = profile.birthYear || (currentYear - 27);
  const age = Math.max(16, Math.min(90, currentYear - birthYear));

  const rawGoal = (profile.goal || 'muscle').toLowerCase();
  const bodyShape = (profile.bodyShape || profile.bodyType || 'mesomorph').toLowerCase();
  const fitnessLevel = (profile.fitnessLevel || profile.experience || 'beginner').toLowerCase();
  const bmiBand = getBmiBand(profile);

  const goal =
    rawGoal === 'fat' || rawGoal === 'muscle' || rawGoal === 'strength' || rawGoal === 'endurance' || rawGoal === 'wellness' || rawGoal === 'flexibility'
      ? rawGoal
      : bmiBand === 'overweight' || bmiBand === 'obese'
        ? 'fat'
        : bmiBand === 'underweight'
          ? 'muscle'
          : 'wellness';

  const goalTitleMap: Record<string, string> = {
    fat: 'Athletic Shred & Conditioning',
    muscle: 'Muscle Growth & Strength Engine',
    strength: 'Power Build & Performance Base',
    endurance: 'Endurance & Conditioning Cycle',
    flexibility: 'Mobility & Functional Balance',
    wellness: 'Balanced Strength & Recovery',
  };

  const exerciseMap = buildDaySpecificExercises(profile, goal, fitnessLevel, bmiBand);

  const weekTemplate: Array<{
    dayName: WeeklyWorkoutDay['dayName'];
    focus: string;
    targetMuscles: string[];
    durationMin: number;
    intensity: WeeklyWorkoutDay['intensity'];
    exerciseKey: 'upper' | 'lower' | 'recovery' | 'conditioning' | 'full';
    coachNote: string;
    isRestDay?: boolean;
  }> = [
    {
      dayName: 'Monday',
      focus: goal === 'fat' ? 'Upper Push + Conditioning' : 'Upper Body Strength',
      targetMuscles: ['Chest', 'Shoulders', 'Triceps'],
      durationMin: goal === 'fat' ? 48 : 54,
      intensity: 'High',
      exerciseKey: 'upper',
      coachNote: 'Primary upper-body work goes first so your nervous system is fresh and your form stays sharp.',
    },
    {
      dayName: 'Tuesday',
      focus: goal === 'fat' ? 'Lower Power + Core' : 'Lower Body Strength',
      targetMuscles: ['Legs', 'Glutes', 'Core'],
      durationMin: goal === 'fat' ? 52 : 58,
      intensity: 'Peak',
      exerciseKey: 'lower',
      coachNote: 'This is your main lower-body strength slot, so stay controlled and keep the effort focused.',
    },
    {
      dayName: 'Wednesday',
      focus: goal === 'fat' ? 'Recovery Walk + Mobility' : 'Recovery + Mobility',
      targetMuscles: ['Mobility', 'Core', 'Recovery'],
      durationMin: 32,
      intensity: 'Moderate',
      exerciseKey: 'recovery',
      coachNote: 'A lighter day keeps fatigue in check and helps you absorb the hard work from earlier in the week.',
    },
    {
      dayName: 'Thursday',
      focus: goal === 'strength' ? 'Pull + Posterior Chain' : 'Upper Pull + Arms',
      targetMuscles: ['Back', 'Biceps', 'Rear Delts'],
      durationMin: 50,
      intensity: 'High',
      exerciseKey: 'upper',
      coachNote: 'Back strength and posture support every other lift, so the pull work should stay tight and deliberate.',
    },
    {
      dayName: 'Friday',
      focus: goal === 'fat' ? 'Full-Body Conditioning' : 'Full Body Hybrid',
      targetMuscles: ['Full Body', 'Core'],
      durationMin: goal === 'fat' ? 44 : 50,
      intensity: goal === 'fat' ? 'High' : 'Moderate',
      exerciseKey: 'full',
      coachNote: 'This is the bridge day; it keeps the body moving without stacking excessive fatigue.',
    },
    {
      dayName: 'Saturday',
      focus: goal === 'endurance' ? 'Endurance Circuit' : 'Conditioning + Core',
      targetMuscles: ['Cardio', 'Core', 'Full Body'],
      durationMin: goal === 'endurance' ? 60 : 42,
      intensity: goal === 'endurance' ? 'High' : 'High',
      exerciseKey: 'conditioning',
      coachNote: 'Use this slot to build output and work capacity without the plan turning into random mixed exercise selection.',
    },
    {
      dayName: 'Sunday',
      focus: 'Complete Recovery',
      targetMuscles: ['Recovery'],
      durationMin: 20,
      intensity: 'Low',
      exerciseKey: 'recovery',
      coachNote: 'Recovery is part of the plan. Sleep, hydration, and easy movement improve adaptation more than extra fatigue.',
      isRestDay: true,
    },
  ];

  const days: WeeklyWorkoutDay[] = weekTemplate.map(dayTemplate => {
    let chosenExercises: SelectedWorkoutExercise[] = [];

    switch (dayTemplate.exerciseKey) {
      case 'upper':
        chosenExercises = [...exerciseMap.push.slice(0, 2), ...exerciseMap.pull.slice(0, 2)];
        break;
      case 'lower':
        chosenExercises = [...exerciseMap.legs.slice(0, 4)];
        break;
      case 'recovery':
        chosenExercises = [...exerciseMap.mobility.slice(0, 3)];
        break;
      case 'conditioning':
        chosenExercises = [...exerciseMap.conditioning.slice(0, 4)];
        break;
      case 'full':
        chosenExercises = [...exerciseMap.push.slice(0, 2), ...exerciseMap.legs.slice(0, 2), ...exerciseMap.core.slice(0, 2)];
        break;
      default:
        chosenExercises = [...exerciseMap.mobility.slice(0, 2)];
    }

    if (dayTemplate.isRestDay) {
      chosenExercises = [...exerciseMap.mobility.slice(0, 2)];
    }

    return buildDay(
      dayTemplate.dayName,
      dayTemplate.focus,
      dayTemplate.targetMuscles,
      dayTemplate.durationMin,
      dayTemplate.intensity,
      chosenExercises,
      `${dayTemplate.coachNote} Your profile is ${bodyShape} build, ${bmiBand} BMI range, and ${fitnessLevel} level, so this split is specifically matched to your body and recovery capacity.`,
      dayTemplate.isRestDay,
    );
  });

  const totalSets = days.reduce((sum, day) => sum + day.exercises.reduce((inner, ex) => inner + (ex.sets || 3), 0), 0);
  const totalBurn = days.reduce((sum, day) => sum + day.estimatedKcal, 0);

  const planTitle = `${goalTitleMap[goal] ?? 'Hybrid Training Plan'} · ${bodyShape.toUpperCase()}`;
  const subtitle = `Engineered for age ${age} • ${heightCm}cm • ${weightKg}kg • BMI ${bmi} (${bmiBand})`;

  const plan: WeeklyWorkoutPlan = {
    planTitle,
    subtitle,
    targetGoal: goal.toUpperCase(),
    bodyProfileSummary: {
      bmi,
      bmiCategory: bmiBand,
      age,
      heightCm,
      weightKg,
      bodyShape,
      fitnessLevel,
    },
    weeklyVolumeSets: totalSets,
    weeklyBurnKcal: totalBurn,
    days,
  };

  appStorage.setObject(STORAGE_KEY_WEEKLY_PLAN, plan);
  appStorage.setString(STORAGE_KEY_PLAN_SIG, getPlanSignature(profile));
  return plan;
}
