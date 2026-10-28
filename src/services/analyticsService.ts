/**
 * analyticsService.ts
 * Derives advanced fitness analytics from stored progress + workout data.
 */

import {getProgressHistory, getCalorieTarget, getProteinTarget} from './progressTracker';
import {getUserProfile} from './userProfile';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HeatmapCell = {
  date: string;
  intensity: 0 | 1 | 2 | 3; // 0=none, 1=low, 2=medium, 3=high
};

export type MacroBreakdown = {
  proteinG: number;
  carbG: number;
  fatG: number;
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  totalKcal: number;
};

export type BodyComposition = {
  bmi: number;
  bmiCategory: 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
  estimatedBFPct: number; // rough Deurenberg formula
  leanMassKg: number;
  fatMassKg: number;
};

export type VolumeTrend = {
  week: string; // e.g. "W1", "W2"
  workouts: number;
  avgSteps: number;
  avgCalBurned: number;
};

// ─── Heatmap ─────────────────────────────────────────────────────────────────

/** Returns last `weeks` weeks (oldest first) of daily activity as intensity cells */
export function getWorkoutHeatmap(weeks: number = 4): HeatmapCell[] {
  const history = getProgressHistory(90);
  const days = weeks * 7;

  // Build lookup map
  const byDate = new Map(history.map(e => [e.date, e]));

  const cells: HeatmapCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);

    let intensity: 0 | 1 | 2 | 3 = 0;
    if (entry) {
      const score =
        (entry.workoutsCompleted > 0 ? 3 : 0) +
        (entry.steps > 10000 ? 2 : entry.steps > 5000 ? 1 : 0) +
        (entry.caloriesBurned > 300 ? 2 : entry.caloriesBurned > 100 ? 1 : 0);
      intensity = score >= 5 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0;
    }

    cells.push({date: dateStr, intensity});
  }
  return cells;
}

// ─── Macro Breakdown ─────────────────────────────────────────────────────────

/** Estimates this week's macro split from calorie logs + goal-derived macro ratios */
export function getMacroBreakdown(): MacroBreakdown {
  const history = getProgressHistory(30);
  const weekEntries = history.slice(-7);
  const profile = getUserProfile();
  const calorieTarget = getCalorieTarget();
  const proteinTarget = getProteinTarget();

  const avgCalories =
    weekEntries.length > 0
      ? Math.round(weekEntries.reduce((s, e) => s + e.calories, 0) / weekEntries.length)
      : calorieTarget;

  // Protein is locked from goal
  const proteinG = proteinTarget;
  const proteinKcal = proteinG * 4;

  // Fat: 25–35% of kcal depending on goal
  const fatPctOfKcal =
    profile.goal === 'fat' ? 0.35 :
    profile.goal === 'muscle' ? 0.25 : 0.30;
  const fatKcal = Math.round(avgCalories * fatPctOfKcal);
  const fatG = Math.round(fatKcal / 9);

  // Carbs: remainder
  const carbKcal = Math.max(0, avgCalories - proteinKcal - fatKcal);
  const carbG = Math.round(carbKcal / 4);

  const totalKcal = proteinKcal + fatKcal + carbKcal;
  const safeTotal = Math.max(1, totalKcal);

  return {
    proteinG,
    carbG,
    fatG,
    proteinPct: Math.round((proteinKcal / safeTotal) * 100),
    carbPct: Math.round((carbKcal / safeTotal) * 100),
    fatPct: Math.round((fatKcal / safeTotal) * 100),
    totalKcal: avgCalories,
  };
}

// ─── Body Composition ────────────────────────────────────────────────────────

/** Rough Deurenberg formula for estimated BF% */
export function getBodyCompositionEstimate(): BodyComposition {
  const profile = getUserProfile();
  const heightM = profile.heightCm / 100;
  const bmi = profile.weightKg / (heightM * heightM);

  let bmiCategory: BodyComposition['bmiCategory'];
  if (bmi < 18.5) { bmiCategory = 'Underweight'; }
  else if (bmi < 25) { bmiCategory = 'Normal'; }
  else if (bmi < 30) { bmiCategory = 'Overweight'; }
  else { bmiCategory = 'Obese'; }

  // Deurenberg: BF% = (1.20 × BMI) + (0.23 × Age) − (10.8 × Sex) − 5.4
  // Approximating male (1), age 26
  const estimatedBFPct = Math.max(5, Math.min(50,
    (1.20 * bmi) + (0.23 * 26) - (10.8 * 1) - 5.4,
  ));
  const fatMassKg = Math.round((estimatedBFPct / 100) * profile.weightKg * 10) / 10;
  const leanMassKg = Math.round((profile.weightKg - fatMassKg) * 10) / 10;

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory,
    estimatedBFPct: Math.round(estimatedBFPct * 10) / 10,
    leanMassKg,
    fatMassKg,
  };
}

// ─── Volume Trend (4-week) ───────────────────────────────────────────────────

/** Returns per-week summary for the last 4 weeks */
export function getVolumeTrend(): VolumeTrend[] {
  const history = getProgressHistory(90);
  const weeks: VolumeTrend[] = [];

  for (let w = 3; w >= 0; w--) {
    const startIdx = history.length - (w + 1) * 7;
    const endIdx = history.length - w * 7;
    const slice = history.slice(Math.max(0, startIdx), endIdx);

    const workouts = slice.reduce((s, e) => s + e.workoutsCompleted, 0);
    const avgSteps = slice.length > 0
      ? Math.round(slice.reduce((s, e) => s + e.steps, 0) / slice.length) : 0;
    const avgCalBurned = slice.length > 0
      ? Math.round(slice.reduce((s, e) => s + e.caloriesBurned, 0) / slice.length) : 0;

    weeks.push({
      week: `W${4 - w}`,
      workouts,
      avgSteps,
      avgCalBurned,
    });
  }
  return weeks;
}
