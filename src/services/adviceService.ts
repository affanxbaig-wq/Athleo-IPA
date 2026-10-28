/**
 * adviceService.ts
 *
 * Reads the personalised targets + coaching advice the backend derives from the
 * user's onboarding answers and their recent activity.
 *
 * Primary path : Supabase RPC `get_user_advice()` (BMR → TDEE → targets →
 *                advice, all computed in SQL — see
 *                supabase/migrations/202610170002_onboarding_profile_advice.sql).
 * Fallback path: derived locally from the MMKV profile + today's tracker data,
 *                so the advice section never renders empty when the device is
 *                offline or the migration has not been applied yet.
 *
 * Fully defensive: every backend call is wrapped in try/catch and returns the
 * local bundle on any failure.
 */

import {getSupabaseClient} from './auth';
import {isSupabaseConfigured} from '../config/supabase';
import {appStorage} from './storage';
import {getUserProfile} from './userProfile';
import {
  getCaloriesConsumed,
  getSteps,
  getStepsGoal,
  getWaterMl,
} from './dailyTracker';

export type AdviceCategory =
  | 'steps'
  | 'calories'
  | 'nutrition'
  | 'training'
  | 'recovery'
  | 'hydration'
  | 'consistency';

export type FitnessAdvice = {
  id?: string;
  category: AdviceCategory;
  title: string;
  body: string;
  priority: number;
  metric?: string | null;
};

export type UserTargets = {
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  water_target_ml: number;
  steps_target: number;
  active_energy_target: number;
  bmr?: number | null;
  tdee?: number | null;
  bmi?: number | null;
};

export type UserAdviceBundle = {
  targets: UserTargets;
  advice: FitnessAdvice[];
  /** 'backend' when Supabase answered, 'local' when derived on-device. */
  source: 'backend' | 'local';
  generatedAt: string;
};

const CACHE_KEY = 'athleo_advice_bundle_v1';

// ─── Local derivation (offline fallback) ─────────────────────────────────────

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const GOAL_ADJUST: Record<string, number> = {
  fat: -400,
  muscle: 250,
  strength: 200,
  endurance: 150,
  wellness: 0,
  flexibility: 0,
};

const PROTEIN_PER_KG: Record<string, number> = {
  fat: 2.0,
  muscle: 1.8,
  strength: 1.8,
  endurance: 1.6,
  wellness: 1.2,
  flexibility: 1.2,
};

function localTargets(): UserTargets {
  const p = getUserProfile();
  const weight = p.weightKg > 0 ? p.weightKg : 72;
  const height = p.heightCm > 0 ? p.heightCm : 176;
  const age = p.birthYear && p.birthYear > 1900
    ? Math.max(14, Math.min(90, new Date().getFullYear() - p.birthYear))
    : 30;

  const sexOffset = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const tdee = bmr * (ACTIVITY_MULTIPLIER[p.activityLevel ?? 'moderate'] ?? 1.55);
  const calorieTarget = Math.round(Math.max(1200, tdee + (GOAL_ADJUST[p.goal ?? ''] ?? 0)));

  const protein = Math.round(weight * (PROTEIN_PER_KG[p.goal ?? ''] ?? 1.2));
  const fat = Math.max(35, Math.round((calorieTarget * 0.25) / 9));
  const carb = Math.max(60, Math.round((calorieTarget - protein * 4 - fat * 9) / 4));

  return {
    calorie_target: calorieTarget,
    protein_target_g: protein,
    carb_target_g: carb,
    fat_target_g: fat,
    water_target_ml: Math.max(1500, Math.round((weight * 35) / 100) * 100),
    steps_target: getStepsGoal(),
    active_energy_target: Math.round(getStepsGoal() * weight * 0.00055),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    bmi: Math.round((weight / Math.pow(height / 100, 2)) * 100) / 100,
  };
}

function localAdvice(targets: UserTargets): FitnessAdvice[] {
  const p = getUserProfile();
  const steps = getSteps();
  const water = getWaterMl();
  const consumed = getCaloriesConsumed();
  const streak = 0; // streak lives server-side; degrade gracefully offline
  const goal = p.goal ?? 'wellness';
  const freq = p.workoutFrequency ?? 3;
  const band = p.activityLevel ?? 'moderate';
  const items: FitnessAdvice[] = [];

  // steps
  if (steps <= 0) {
    items.push({
      category: 'steps',
      title: 'Start counting your steps',
      body: `Your daily step target is ${targets.steps_target.toLocaleString()}. Keep the pedometer running so the sensor counts automatically.`,
      priority: 3,
      metric: 'steps',
    });
  } else if (steps >= targets.steps_target) {
    items.push({
      category: 'steps',
      title: 'You are beating your step goal',
      body: `${steps.toLocaleString()} steps today against a ${targets.steps_target.toLocaleString()} target. Hold this rhythm — add one extra 15-minute walk to keep progressing.`,
      priority: 3,
      metric: 'steps',
    });
  } else {
    items.push({
      category: 'steps',
      title: 'Close the step gap',
      body: `${(targets.steps_target - steps).toLocaleString()} steps to go today. Two 10-minute walks — one after lunch, one after dinner — close most of that gap.`,
      priority: 4,
      metric: 'steps',
    });
  }

  // calories
  if (consumed <= 0) {
    items.push({
      category: 'calories',
      title: 'Your daily energy budget',
      body: `Based on your body data your daily calorie target is ${targets.calorie_target.toLocaleString()} kcal (BMR ${targets.bmr} · TDEE ${targets.tdee}).`,
      priority: 3,
      metric: 'calories',
    });
  } else {
    const diff = Math.round(consumed - targets.calorie_target);
    items.push({
      category: 'calories',
      title: diff > 0 ? 'You are above your calorie target' : 'Energy intake is on target',
      body: diff > 0
        ? `${diff.toLocaleString()} kcal over your ${targets.calorie_target.toLocaleString()} kcal target today. Trim one snack tomorrow to balance the week.`
        : `${Math.abs(diff).toLocaleString()} kcal left of your ${targets.calorie_target.toLocaleString()} kcal target. Aim for protein-first meals to stay full.`,
      priority: diff > 0 ? 5 : 2,
      metric: 'calories',
    });
  }

  // nutrition
  items.push({
    category: 'nutrition',
    title: `Protein target: ${targets.protein_target_g} g a day`,
    body: `Spread ${targets.protein_target_g} g of protein across 3-4 meals — roughly ${Math.round(targets.protein_target_g / 4)} g per meal — to support recovery and keep hunger stable.`,
    priority: 2,
    metric: 'protein_g',
  });

  // hydration
  items.push({
    category: 'hydration',
    title: `Hydration goal: ${targets.water_target_ml.toLocaleString()} ml a day`,
    body: `${Math.max(0, targets.water_target_ml - water).toLocaleString()} ml to go today${goal === 'fat' ? ', plus 500 ml on training days' : ''}.`,
    priority: water < targets.water_target_ml * 0.6 ? 4 : 1,
    metric: 'water_ml',
  });

  // training
  items.push({
    category: 'training',
    title: goal === 'muscle'
      ? `Train for muscle, ${freq} days a week`
      : goal === 'fat'
        ? 'Protect muscle while losing fat'
        : 'Keep training consistently',
    body: goal === 'muscle'
      ? `Hit the gym ${freq} days a week with 3-4 sets of 6-12 reps on the big lifts, keeping 1-2 reps in reserve. Progressive overload beats more volume.`
      : goal === 'fat'
        ? `Lift ${freq} days a week to preserve muscle while you lose fat, and pair it with your ${targets.steps_target.toLocaleString()} step target.`
        : `${freq} sessions a week is a strong base. Mix strength, mobility and easy cardio — as a ${band} your fastest win is showing up every week.`,
    priority: 2,
    metric: 'workouts',
  });

  // recovery
  items.push({
    category: 'recovery',
    title: 'Log your sleep',
    body: 'Aim for 7-9 hours a night. Log sleep for a week and your recovery advice will sharpen up automatically.',
    priority: 1,
    metric: 'sleep_hours',
  });

  // consistency
  items.push({
    category: 'consistency',
    title: streak > 0 ? `You are on a ${streak}-day streak` : 'Build your first streak',
    body: "Log any activity today to start a streak. The goal isn't perfection — it's never missing twice in a row.",
    priority: 3,
    metric: 'streak',
  });

  return items.sort((a, b) => b.priority - a.priority);
}

// ─── Public API ──────────────────────────────────────────────────────────────

function localBundle(): UserAdviceBundle {
  const targets = localTargets();
  return {
    targets,
    advice: localAdvice(targets),
    source: 'local',
    generatedAt: new Date().toISOString(),
  };
}

/** Last successfully fetched bundle, so the UI renders instantly on mount. */
export function getCachedAdvice(): UserAdviceBundle | null {
  try {
    return appStorage.getObject<UserAdviceBundle>(CACHE_KEY) ?? null;
  } catch {
    return null;
  }
}

function cacheAdvice(bundle: UserAdviceBundle): void {
  try {
    appStorage.setObject(CACHE_KEY, bundle);
  } catch {
    /* ignore */
  }
}

/**
 * Fetches the user's targets + advice. Never throws — falls back to the
 * on-device derivation when the backend is unavailable.
 */
export async function fetchUserAdvice(): Promise<UserAdviceBundle> {
  if (!isSupabaseConfigured()) {
    return localBundle();
  }

  try {
    const supabase = getSupabaseClient();
    const {data, error} = await (supabase as any).rpc('get_user_advice');

    if (error) {
      // 42P01 = table missing, 42883 = function missing → migration not applied
      if (!error.code?.includes('42P01') && !error.code?.includes('42883')) {
        console.warn('[adviceService] get_user_advice error:', error.message);
      }
      return localBundle();
    }

    const payload = typeof data === 'string' ? JSON.parse(data) : data;
    if (!payload || payload.ok === false) {
      return localBundle();
    }

    const backendTargets = payload.targets ?? {};
    const fallback = localTargets();

    // Merge so a partially-computed backend row never leaves a field undefined.
    const targets: UserTargets = {
      calorie_target: Number(backendTargets.calorie_target) || fallback.calorie_target,
      protein_target_g: Number(backendTargets.protein_target_g) || fallback.protein_target_g,
      carb_target_g: Number(backendTargets.carb_target_g) || fallback.carb_target_g,
      fat_target_g: Number(backendTargets.fat_target_g) || fallback.fat_target_g,
      water_target_ml: Number(backendTargets.water_target_ml) || fallback.water_target_ml,
      steps_target: Number(backendTargets.steps_target) || fallback.steps_target,
      active_energy_target: Number(backendTargets.active_energy_target) || fallback.active_energy_target,
      bmr: backendTargets.bmr ?? fallback.bmr,
      tdee: backendTargets.tdee ?? fallback.tdee,
      bmi: backendTargets.bmi ?? fallback.bmi,
    };

    const advice: FitnessAdvice[] = Array.isArray(payload.advice) && payload.advice.length > 0
      ? payload.advice.map((a: any) => ({
          id: a.id,
          category: a.category,
          title: a.title,
          body: a.body,
          priority: Number(a.priority) || 1,
          metric: a.metric ?? null,
        }))
      : localAdvice(targets);

    const bundle: UserAdviceBundle = {
      targets,
      advice,
      source: 'backend',
      generatedAt: payload.generated_at ?? new Date().toISOString(),
    };

    cacheAdvice(bundle);
    return bundle;
  } catch (err) {
    console.warn('[adviceService] fetchUserAdvice threw:', err);
    return localBundle();
  }
}
