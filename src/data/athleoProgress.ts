export type WeightPoint = {
  date: string;
  value: number;
};

export type BodyMeasurement = {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down';
};

export type StrengthMilestone = {
  exercise: string;
  bestWeight: number;
  unit: string;
  pin: boolean;
};

export type PhotoEntry = {
  id: string;
  uri: string;
  label: string;
  weight: number;
  date: string;
};

export type SleepStage = {
  label: string;
  minutes: number;
  color: string;
};

export type RecoveryReadinessScore = {
  score: number;
  band: 'Low' | 'Moderate' | 'High';
};

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
};

export type LevelSnapshot = {
  level: number;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progress: number;
  xpRemaining: number;
};

export type StreakSnapshot = {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  atRisk: boolean;
};

export const weightHistory: WeightPoint[] = [
  {date: '2025-08-07', value: 74.8},
  {date: '2025-08-12', value: 74.1},
  {date: '2025-08-17', value: 73.9},
  {date: '2025-08-22', value: 73.5},
  {date: '2025-08-27', value: 73.2},
  {date: '2025-09-02', value: 72.9},
  {date: '2025-09-07', value: 72.6},
  {date: '2025-09-12', value: 72.5},
  {date: '2025-09-21', value: 72.3},
  {date: '2025-09-27', value: 72.1},
  {date: '2025-10-02', value: 72.0},
  {date: '2025-10-06', value: 72.0},
];

export const bodyMeasurementData: BodyMeasurement[] = [
  {label: 'Chest', value: 98, change: 1.2, trend: 'up'},
  {label: 'Waist', value: 81, change: -2.4, trend: 'down'},
  {label: 'Hips', value: 96, change: -1.1, trend: 'down'},
  {label: 'Arms', value: 35, change: 0.8, trend: 'up'},
  {label: 'Thighs', value: 58, change: -1.4, trend: 'down'},
];

export const strengthMilestones: StrengthMilestone[] = [
  {exercise: 'Squat', bestWeight: 145, unit: 'kg', pin: true},
  {exercise: 'Bench', bestWeight: 105, unit: 'kg', pin: true},
  {exercise: 'Deadlift', bestWeight: 170, unit: 'kg', pin: true},
  {exercise: 'Overhead Press', bestWeight: 78, unit: 'kg', pin: false},
  {exercise: 'Pull-up', bestWeight: 19, unit: 'kg', pin: false},
];

export const recentPrs = [
  {exercise: 'Deadlift', weight: 170, date: '2 days ago'},
  {exercise: 'Bench', weight: 105, date: '6 days ago'},
  {exercise: 'Squat', weight: 145, date: '12 days ago'},
  {exercise: 'Overhead Press', weight: 78, date: '3 weeks ago'},
];

export const volumeHistory = [
  {label: 'Jan', value: 180},
  {label: 'Feb', value: 206},
  {label: 'Mar', value: 241},
  {label: 'Apr', value: 268},
  {label: 'May', value: 290},
  {label: 'Jun', value: 318},
  {label: 'Jul', value: 344},
  {label: 'Aug', value: 360},
  {label: 'Sep', value: 392},
  {label: 'Oct', value: 418},
];

export const progressPhotos: PhotoEntry[] = [
  {id: 'front-01', uri: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80', label: 'Front', weight: 74.8, date: 'Aug 15'},
  {id: 'side-01', uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80', label: 'Side', weight: 73.3, date: 'Sep 05'},
  {id: 'back-01', uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80', label: 'Back', weight: 72.6, date: 'Sep 21'},
  {id: 'front-02', uri: 'https://images.unsplash.com/photo-1541534401786-2077eed87a74?auto=format&fit=crop&w=900&q=80', label: 'Front', weight: 72.0, date: 'Oct 06'},
  {id: 'side-02', uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80', label: 'Side', weight: 72.0, date: 'Oct 06'},
  {id: 'back-02', uri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80', label: 'Back', weight: 72.0, date: 'Oct 06'},
];

export const sleepStages: SleepStage[] = [
  {label: 'Deep', minutes: 98, color: '#B8FF4D'},
  {label: 'Light', minutes: 182, color: '#7AD7FF'},
  {label: 'REM', minutes: 88, color: '#FFB020'},
];

export const recoveryTips = [
  'Aim for 9+ hours of sleep tonight to maximise your recovery.',
  'Keep your heart rate under 70% of max for the next 20 minutes of cardio.',
  'Hydrate before your next session and keep sodium intake consistent.',
];

export const healthActivitySummary = {
  steps: 8432,
  goalSteps: 10000,
  distanceKm: 6.9,
  activeCalories: 432,
  activeMinutes: 72,
  activeGoalMinutes: 60,
  hourlySteps: [220, 310, 260, 120, 540, 820, 650, 740, 610, 482, 360, 280, 420, 610, 710, 640, 560, 470, 430, 260, 180, 120, 90, 40],
};

export const readinessMetrics = {
  hrv: 64,
  restingHeartRate: 48,
  bodyTemp: 36.8,
  sleepScore: 87,
  recoveryBand: 'High',
};

export function getRangeData(
  data: {date: string; value: number}[],
  range: '1W' | '1M' | '3M' | '1Y' | 'All',
): {date: string; value: number}[] {
  if (!Array.isArray(data) || data.length === 0) {return [];}

  let rangeMs = 0;
  switch (range) {
    case '1W':
      rangeMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case '1M':
      rangeMs = 30 * 24 * 60 * 60 * 1000;
      break;
    case '3M':
      rangeMs = 90 * 24 * 60 * 60 * 1000;
      break;
    case '1Y':
      rangeMs = 365 * 24 * 60 * 60 * 1000;
      break;
    case 'All':
    default:
      rangeMs = 0;
      break;
  }

  const sorted = [...data].sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    return ta - tb;
  });

  let cutoffTs = 0;
  if (rangeMs > 0) {
    const latestTs = new Date(sorted[sorted.length - 1].date).getTime();
    cutoffTs = latestTs - rangeMs;
  }

  const byDay = new Map<string, {date: string; value: number}>();
  for (const entry of sorted) {
    const ts = new Date(entry.date).getTime();
    if (Number.isNaN(ts)) {continue;}
    if (rangeMs > 0 && ts < cutoffTs) {continue;}
    const ymd = entry.date.slice(0, 10);
    byDay.set(ymd, {date: ymd, value: entry.value});
  }

  return Array.from(byDay.values()).sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    return ta - tb;
  });
}

export function calculateSleepScore({
  targetMinutes,
  totalMinutes,
  deepMinutes,
  lightMinutes,
  remMinutes,
  consistency,
  interruptions,
}: {
  targetMinutes: number;
  totalMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  consistency: number;
  interruptions: number;
}): number {
  const durationScore = Math.min(1, totalMinutes / targetMinutes) * 45;
  const stageScore = Math.min(1, (deepMinutes / 90 + remMinutes / 120 + lightMinutes / 220) / 3) * 25;
  const consistencyScore = consistency * 20;
  const interruptionPenalty = Math.min(10, interruptions * 2);
  const score = Math.max(0, Math.min(100, durationScore + stageScore + consistencyScore - interruptionPenalty));
  return Math.round(score);
}

export function calculateReadinessScore({
  hrv,
  baselineHrv,
  restingHeartRate,
  baselineRestingHeartRate,
  sleepScore,
  acuteLoad,
  chronicLoad,
  temperature,
  baselineTemperature,
}: {
  hrv: number;
  baselineHrv: number;
  restingHeartRate: number;
  baselineRestingHeartRate: number;
  sleepScore: number;
  acuteLoad: number;
  chronicLoad: number;
  temperature: number;
  baselineTemperature: number;
}): RecoveryReadinessScore {
  const hrvDelta = ((hrv - baselineHrv) / Math.max(1, baselineHrv)) * 100;
  // rhrDelta is computed inline in score calculation below
  const loadRatio = acuteLoad / Math.max(1, chronicLoad);
  const tempDeviation = Math.abs(temperature - baselineTemperature) * 10;

  let score = 50;
  score += Math.max(-20, Math.min(20, hrvDelta * 1.8));
  score += Math.max(-18, Math.min(18, (baselineRestingHeartRate - restingHeartRate) * 1.2));
  score += (sleepScore - 50) * 0.6;
  score -= Math.max(0, (loadRatio - 1) * 12);
  score -= Math.max(0, tempDeviation);
  score = Math.max(0, Math.min(100, score));

  let band: RecoveryReadinessScore['band'] = 'Moderate';
  if (score >= 75) {band = 'High';}
  if (score < 45) {band = 'Low';}

  return {score: Math.round(score), band};
}

export function getLevelCurve(level: number): number {
  return Math.round(260 + level * 170 + Math.pow(level, 1.8) * 30);
}

export function getLevelSnapshot(totalXp: number): LevelSnapshot {
  let level = 1;
  let xpForCurrentLevel = 0;
  let totalXpAccrued = 0;

  while (totalXpAccrued + getLevelCurve(level) <= totalXp) {
    totalXpAccrued += getLevelCurve(level);
    level += 1;
  }

  xpForCurrentLevel = totalXpAccrued;
  const xpForNextLevel = xpForCurrentLevel + getLevelCurve(level);
  const xpRemaining = Math.max(0, xpForNextLevel - totalXp);
  const progress = totalXp <= xpForCurrentLevel ? 0 : (totalXp - xpForCurrentLevel) / Math.max(1, xpForNextLevel - xpForCurrentLevel);

  return {
    level,
    currentXp: totalXp,
    xpForCurrentLevel,
    xpForNextLevel,
    progress: Math.min(1, Math.max(0, progress)),
    xpRemaining,
  };
}

export function calculateStreakSnapshot(dates: string[], freezeTokens = 1): StreakSnapshot {
  const normalized = Array.from(new Set(dates.map(date => date.slice(0, 10)))).sort();
  if (normalized.length === 0) {
    return {currentStreak: 0, longestStreak: 0, freezeTokens, atRisk: true};
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterdayIso = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let currentStreak = 0;
  let cursor = todayIso;

  while (normalized.includes(cursor)) {
    currentStreak += 1;
    const prev = new Date(new Date(cursor).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    cursor = prev;
  }

  if (currentStreak === 0 && normalized.includes(yesterdayIso)) {
    currentStreak = 1;
  }

  let longestStreak = 1;
  let run = 1;
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = new Date(normalized[index - 1]).getTime();
    const current = new Date(normalized[index]).getTime();
    const diff = (current - previous) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  const atRisk = currentStreak > 0 && !normalized.includes(todayIso) && !normalized.includes(yesterdayIso);

  return {
    currentStreak,
    longestStreak,
    freezeTokens,
    atRisk,
  };
}

export const achievementCatalog: BadgeDefinition[] = [
  {id: 'first-workout', name: 'First Workout', description: 'Complete your first ATHLEO session.', icon: '🔥', requirement: '1 workout'},
  {id: 'streak-7', name: 'Week Warrior', description: 'Hit a 7-day streak.', icon: '✅', requirement: '7-day streak'},
  {id: 'streak-30', name: 'Momentum', description: 'Hold a 30-day streak.', icon: '🏆', requirement: '30-day streak'},
  {id: 'first-pr', name: 'PR Breakthrough', description: 'Set your first personal record.', icon: '📈', requirement: '1 PR'},
  {id: 'hundred-workouts', name: '100 Sessions', description: 'Complete 100 workouts.', icon: '💪', requirement: '100 workouts'},
  {id: 'week-10k', name: '10K Hunter', description: 'Hit a 10k step week.', icon: '👟', requirement: '10k steps in one week'},
  {id: 'sleep-goal', name: 'Recovery Ready', description: 'Hit your 8-hour sleep target.', icon: '🌙', requirement: 'Sleep goal'},
  {id: 'challenge-complete', name: 'Challenge Master', description: 'Complete a challenge objective.', icon: '🎯', requirement: 'Challenge completion'},
];

export function evaluateXpAward({
  workoutCompleted,
  mealsLogged,
  steps,
  waterMl,
  prSet,
  sleepMinutes,
  challengeComplete,
}: {
  workoutCompleted?: boolean;
  mealsLogged?: number;
  steps?: number;
  waterMl?: number;
  prSet?: boolean;
  sleepMinutes?: number;
  challengeComplete?: boolean;
}): number {
  let xp = 0;

  if (workoutCompleted) {xp += 150;}
  if (mealsLogged && mealsLogged > 0) {xp += Math.min(60, mealsLogged * 20);}
  if (steps && steps >= 10000) {xp += 100;}
  if (waterMl && waterMl >= 2000) {xp += 40;}
  if (prSet) {xp += 120;}
  if (sleepMinutes && sleepMinutes >= 480) {xp += 80;}
  if (challengeComplete) {xp += 180;}

  return xp;
}

export function evaluateChallengeProgress({
  steps,
  workouts,
  waterMl,
  sleepMinutes,
  weightLossKg,
  prCount,
}: {
  steps: number;
  workouts: number;
  waterMl: number;
  sleepMinutes: number;
  weightLossKg?: number;
  prCount?: number;
}) {
  return {
    dailySteps: steps >= 10000,
    dailyHydration: waterMl >= 2500,
    sleepTarget: sleepMinutes >= 480,
    workoutTarget: workouts >= 1,
    weeklyWeightTrend: Boolean(weightLossKg && weightLossKg > 0),
    prMilestone: Boolean(prCount && prCount >= 1),
  };
}

export function shouldUnlockBadge({
  badgeId,
  workoutCount,
  streakDays,
  personalRecords,
  stepsThisWeek,
  sleepGoalHit,
  challengeComplete,
}: {
  badgeId: string;
  workoutCount: number;
  streakDays: number;
  personalRecords: number;
  stepsThisWeek: number;
  sleepGoalHit: boolean;
  challengeComplete: boolean;
}): boolean {
  switch (badgeId) {
    case 'first-workout':
      return workoutCount >= 1;
    case 'streak-7':
      return streakDays >= 7;
    case 'streak-30':
      return streakDays >= 30;
    case 'first-pr':
      return personalRecords >= 1;
    case 'hundred-workouts':
      return workoutCount >= 100;
    case 'week-10k':
      return stepsThisWeek >= 10000;
    case 'sleep-goal':
      return sleepGoalHit;
    case 'challenge-complete':
      return challengeComplete;
    default:
      return false;
  }
}
