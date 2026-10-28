/**
 * progressTracker.ts
 * Stores and retrieves up to 90 days of daily user progress.
 * Data is derived from onboarding answers + what the user logs each day.
 */

import {appStorage} from './storage';
import {getUserProfile} from './userProfile';

export type DailyEntry = {
  date: string;           // 'YYYY-MM-DD'
  calories: number;       // kcal consumed
  caloriesBurned: number;
  steps: number;
  weightKg: number;
  workoutsCompleted: number;
  sleepMinutes: number;
  waterMl: number;
  mood: 1 | 2 | 3 | 4 | 5 | null;
};

export type WeekGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export type PRHighlight = {
  label: string;
  value: string;
  icon: string;
};

export type DayActivity = 'active' | 'rest' | 'skipped';

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  totalCalories: number;
  avgCalories: number;
  totalSteps: number;
  avgSteps: number;
  totalWorkouts: number;
  avgSleep: number;
  weightChange: number;
  caloriesBurned: number;
  streakDays: number;
  weekGrade: WeekGrade;
  prHighlights: PRHighlight[];
  coachBlurb: string;
  dayActivities: DayActivity[]; // last 7 days, oldest first
};

const STORAGE_KEY = 'athleo_progress_history';
const MAX_DAYS = 90;

// ─── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadHistory(): DailyEntry[] {
  return appStorage.getObject<DailyEntry[]>(STORAGE_KEY) ?? [];
}

function saveHistory(entries: DailyEntry[]): void {
  // Keep only last MAX_DAYS
  const trimmed = entries.slice(-MAX_DAYS);
  appStorage.setObject(STORAGE_KEY, trimmed);
}

// ─── Read / Write ────────────────────────────────────────────────────────────

export function getProgressHistory(days: 30 | 60 | 90 = 90): DailyEntry[] {
  const all = loadHistory();
  return all.slice(-days);
}

export function getTodayEntry(): DailyEntry | null {
  const all = loadHistory();
  return all.find(e => e.date === today()) ?? null;
}

export function updateTodayEntry(partial: Partial<DailyEntry>): DailyEntry {
  const all = loadHistory();
  const idx = all.findIndex(e => e.date === today());

  const profile = getUserProfile();

  const defaultEntry: DailyEntry = {
    date: today(),
    calories: 0,
    caloriesBurned: 0,
    steps: 0,
    weightKg: profile.weightKg,
    workoutsCompleted: 0,
    sleepMinutes: 0,
    waterMl: 0,
    mood: null,
  };

  if (idx >= 0) {
    all[idx] = {...all[idx], ...partial};
  } else {
    all.push({...defaultEntry, ...partial});
  }

  saveHistory(all);
  return all[idx >= 0 ? idx : all.length - 1];
}

export function recordDailyProgress(entry: Partial<DailyEntry>): void {
  updateTodayEntry(entry);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export function getWeeklyReport(): WeeklyReport {
  const entries = getProgressHistory(30);
  const weekEntries = entries.slice(-7);

  const weekStart = weekEntries[0]?.date ?? today();
  const weekEnd = weekEntries[weekEntries.length - 1]?.date ?? today();

  const totalCalories = weekEntries.reduce((s, e) => s + e.calories, 0);
  const totalSteps = weekEntries.reduce((s, e) => s + e.steps, 0);
  const totalWorkouts = weekEntries.reduce((s, e) => s + e.workoutsCompleted, 0);
  const totalSleep = weekEntries.reduce((s, e) => s + e.sleepMinutes, 0);
  const totalBurned = weekEntries.reduce((s, e) => s + e.caloriesBurned, 0);

  const firstW = weekEntries[0]?.weightKg ?? 0;
  const lastW = weekEntries[weekEntries.length - 1]?.weightKg ?? 0;
  const weightChange = lastW - firstW;

  const streak = getStreakDays();

  const avgStepsVal = weekEntries.length > 0 ? Math.round(totalSteps / weekEntries.length) : 0;
  const weekGrade = computeWeekGrade(totalWorkouts, avgStepsVal, Math.round(totalSleep / Math.max(1, weekEntries.length)));
  const prHighlights = getPRHighlights(weekEntries);
  const coachBlurb = getCoachBlurb(weekGrade, totalWorkouts, avgStepsVal, weightChange);
  const dayActivities: DayActivity[] = weekEntries.map(e => getDayActivity(e));

  return {
    weekStart,
    weekEnd,
    totalCalories,
    avgCalories: weekEntries.length > 0 ? Math.round(totalCalories / weekEntries.length) : 0,
    totalSteps,
    avgSteps: weekEntries.length > 0 ? Math.round(totalSteps / weekEntries.length) : 0,
    totalWorkouts,
    avgSleep: weekEntries.length > 0 ? Math.round(totalSleep / weekEntries.length) : 0,
    weightChange: Math.round(weightChange * 10) / 10,
    caloriesBurned: totalBurned,
    streakDays: streak,
    weekGrade,
    prHighlights,
    coachBlurb,
    dayActivities,
  };
}

// ─── Week Grade & Insights ──────────────────────────────────────────────────

export function getDayActivity(entry: DailyEntry): DayActivity {
  if (entry.workoutsCompleted > 0 || entry.steps > 7000 || entry.caloriesBurned > 200) {
    return 'active';
  }
  if (entry.steps > 2000 || entry.calories > 500) {
    return 'rest';
  }
  return 'skipped';
}

function computeWeekGrade(
  workouts: number,
  avgSteps: number,
  avgSleepMin: number,
): WeekGrade {
  let score = 0;
  // Workouts (max 40pts)
  if (workouts >= 5) { score += 40; }
  else if (workouts >= 4) { score += 32; }
  else if (workouts >= 3) { score += 24; }
  else if (workouts >= 2) { score += 16; }
  else { score += workouts * 6; }
  // Steps (max 30pts)
  if (avgSteps >= 10000) { score += 30; }
  else if (avgSteps >= 7500) { score += 22; }
  else if (avgSteps >= 5000) { score += 14; }
  else { score += 6; }
  // Sleep (max 30pts)
  if (avgSleepMin >= 420) { score += 30; }
  else if (avgSleepMin >= 360) { score += 22; }
  else if (avgSleepMin >= 300) { score += 12; }
  else { score += 4; }

  if (score >= 90) { return 'S'; }
  if (score >= 72) { return 'A'; }
  if (score >= 54) { return 'B'; }
  if (score >= 34) { return 'C'; }
  return 'D';
}

function getPRHighlights(entries: DailyEntry[]): PRHighlight[] {
  if (entries.length === 0) { return []; }
  const highlights: PRHighlight[] = [];
  const bestSteps = Math.max(...entries.map(e => e.steps));
  const bestBurn  = Math.max(...entries.map(e => e.caloriesBurned));
  const bestSleep = Math.max(...entries.map(e => e.sleepMinutes));
  const mostWater = Math.max(...entries.map(e => e.waterMl));

  if (bestSteps > 8000) {
    highlights.push({label: 'Best Steps Day', value: bestSteps.toLocaleString(), icon: 'footsteps-outline'});
  }
  if (bestBurn > 250) {
    highlights.push({label: 'Peak Burn Day', value: `${bestBurn} kcal`, icon: 'flame-outline'});
  }
  if (bestSleep >= 450) {
    highlights.push({label: 'Best Sleep', value: `${Math.floor(bestSleep / 60)}h ${bestSleep % 60}m`, icon: 'moon-outline'});
  }
  if (mostWater >= 2500) {
    highlights.push({label: 'Hydration PR', value: `${(mostWater / 1000).toFixed(1)}L`, icon: 'water-outline'});
  }
  return highlights.slice(0, 3);
}

function getCoachBlurb(
  grade: WeekGrade,
  workouts: number,
  avgSteps: number,
  weightChange: number,
): string {
  const stepNote = avgSteps >= 10000
    ? 'Your daily step count is elite — keep crushing it.'
    : avgSteps >= 7000
    ? 'Good movement volume — aim for 10k steps daily for full metabolic benefit.'
    : 'Try adding short walks between sessions to boost your NEAT and recovery.';

  const weightNote = weightChange < -0.3
    ? `You're trending down ${Math.abs(weightChange).toFixed(1)} kg — great fat loss momentum.`
    : weightChange > 0.3
    ? `Slight weight uptick of ${weightChange.toFixed(1)} kg — expected during muscle gain phases.`
    : 'Weight is holding steady — focus on body recomposition signals like performance.';

  const gradeLines: Record<WeekGrade, string> = {
    S: `Outstanding week — ${workouts} sessions, elite steps, and excellent recovery. You're in peak form.`,
    A: `Strong performance this week with ${workouts} workouts. ${stepNote}`,
    B: `Solid week overall. ${workouts > 0 ? `You trained ${workouts} times` : 'No workouts logged yet'} — ${stepNote}`,
    C: `Moderate activity this week. ${workouts < 2 ? 'Try to hit at least 3 sessions next week.' : stepNote} ${weightNote}`,
    D: `Tough week — life happens. ${weightNote} Reset, recover, and come back stronger.`,
  };
  return gradeLines[grade];
}

export function getStreakDays(): number {
  const entries = loadHistory();
  if (entries.length === 0) {return 0;}

  let streak = 0;
  const todayStr = today();

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - (entries.length - 1 - i));
    const expectedStr = expectedDate.toISOString().split('T')[0];

    if (entry.date !== expectedStr && entry.date !== todayStr) {break;}
    if (entry.steps > 500 || entry.workoutsCompleted > 0 || entry.calories > 100) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getCalorieTarget(): number {
  const profile = getUserProfile();
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * 26 + 5;
  const actMap: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9,
  };
  const mult = actMap[profile.activityLevel ?? 'moderate'] ?? 1.55;
  let tdee = Math.round(bmr * mult);
  if (profile.goal === 'fat') {tdee -= 500;}
  else if (profile.goal === 'muscle') {tdee += 350;}
  return tdee;
}

export function getProteinTarget(): number {
  const profile = getUserProfile();
  let g = 1.8;
  if (profile.goal === 'muscle' || profile.goal === 'strength') {g = 2.2;}
  else if (profile.goal === 'fat') {g = 2.4;}
  return Math.round(profile.weightKg * g);
}

export function getStepsTarget(): number {
  const profile = getUserProfile();
  const map: Record<string, number> = {
    sedentary: 6000, light: 8000, moderate: 10000, active: 12000, athlete: 15000,
  };
  return map[profile.activityLevel ?? 'moderate'] ?? 10000;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export type AppPrefs = {
  hapticEnabled: boolean;
  biometricEnabled: boolean;
  weeklyReportEnabled: boolean;
  pushNotificationsEnabled: boolean;
  locationEnabled: boolean;
};

const PREFS_KEY = 'athleo_app_prefs';

const defaultPrefs: AppPrefs = {
  hapticEnabled: true,
  biometricEnabled: false,
  weeklyReportEnabled: true,
  pushNotificationsEnabled: true,
  locationEnabled: false,
};

export function getAppPrefs(): AppPrefs {
  const stored = appStorage.getObject<AppPrefs>(PREFS_KEY);
  return stored ? {...defaultPrefs, ...stored} : {...defaultPrefs};
}

export function setAppPrefs(partial: Partial<AppPrefs>): AppPrefs {
  const current = getAppPrefs();
  const updated = {...current, ...partial};
  appStorage.setObject(PREFS_KEY, updated);
  return updated;
}
