/**
 * goalService.ts
 * Manages user daily/weekly goals — persists to MMKV and optionally Supabase.
 * Integrates with dailyTracker for live progress calculations.
 */

import {appStorage} from './storage';
import {
  getSteps,
  getCaloriesConsumed,
  getWaterMl,
  getWorkoutsCompleted,
  getCalorieGoal,
  getWaterGoalMl,
} from './dailyTracker';

export type GoalType = 'steps' | 'calories' | 'water' | 'workouts';

interface GoalProgress {
  current: number;
  target: number;
  pct: number;
  completed: boolean;
}

const GOAL_PREFIX = 'goal_target_';
const COMPLETED_PREFIX = 'goal_completed_';
const TODAY_KEY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DEFAULT_GOALS: Record<GoalType, number> = {
  steps: 10000,
  calories: 2200,
  water: 3000,
  workouts: 1,
};

export function setDailyGoal(type: GoalType, target: number): void {
  appStorage.setString(`${GOAL_PREFIX}${type}`, String(Math.max(1, target)));
}

export function getDailyGoal(type: GoalType): number {
  const stored = appStorage.getString(`${GOAL_PREFIX}${type}`);
  if (stored) { return parseInt(stored, 10); }

  // Use calculated goals for calories/water
  if (type === 'calories') { return getCalorieGoal(); }
  if (type === 'water') { return getWaterGoalMl(); }
  return DEFAULT_GOALS[type];
}

function getLiveValue(type: GoalType): number {
  switch (type) {
    case 'steps': return getSteps();
    case 'calories': return getCaloriesConsumed();
    case 'water': return getWaterMl();
    case 'workouts': return getWorkoutsCompleted();
  }
}

export function getGoalProgress(type: GoalType): GoalProgress {
  const current = getLiveValue(type);
  const target = getDailyGoal(type);
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
  return {current, target, pct, completed: pct >= 100};
}

/**
 * Call after any metric update to check if a goal was just completed.
 * Returns the goal type if newly completed, null otherwise.
 */
export function checkGoalCompletion(type: GoalType): boolean {
  const {completed} = getGoalProgress(type);
  const completedKey = `${COMPLETED_PREFIX}${type}_${TODAY_KEY()}`;
  const alreadyFired = appStorage.getString(completedKey) === 'true';

  if (completed && !alreadyFired) {
    appStorage.setString(completedKey, 'true');
    return true; // newly completed — caller should show notification
  }
  return false;
}

export function getAllGoalProgress(): Record<GoalType, GoalProgress> {
  return {
    steps: getGoalProgress('steps'),
    calories: getGoalProgress('calories'),
    water: getGoalProgress('water'),
    workouts: getGoalProgress('workouts'),
  };
}
