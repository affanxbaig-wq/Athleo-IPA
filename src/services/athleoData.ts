import {challengeDefinitions, evaluateChallengeCompletion} from '../data/challengeEngine';
import {exerciseLibrary} from '../data/exercises';
import {defaultMacroTargets, foodLibrary, mealPlan, starterPrograms} from '../data/foods';
import {achievementCatalog, calculateStreakSnapshot, getLevelSnapshot, readinessMetrics, sleepStages, strengthMilestones, volumeHistory, weightHistory} from '../data/athleoProgress';
import {socialPosts} from '../data/socialFeed';

export const appUser = {
  name: 'Farhan Malik',
  age: 26,
  weightKg: 74.5,
  heightCm: 176,
  streakDays: 30,
  goal: 'Muscle Gain',
};

export const homeDashboard = {
  greeting: 'Good Morning',
  name: appUser.name,
  readinessScore: 92,
  caloriesConsumed: 1842,
  caloriesTarget: defaultMacroTargets.calories,
  steps: 8432,
  waterMl: 2600,
  waterTargetMl: 3200,
  activeMinutes: 72,
  activeMinutesGoal: 60,
  streak: calculateStreakSnapshot(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'], 1),
  readinessBand: 'High',
  challenge: challengeDefinitions[0],
  currentWeight: weightHistory[weightHistory.length - 1]?.value ?? 72,
  socialPosts,
};

export const workoutCategories = ['Gym', 'Home', 'HIIT', 'Strength', 'Mobility'] as const;
export const workoutLibrary = exerciseLibrary.map((exercise, index) => ({
  ...exercise,
  program: starterPrograms[index % starterPrograms.length]?.name ?? 'Athleo Strength Foundation',
  duration: 35 + (index % 4) * 8,
  intensity: exercise.difficulty ?? (['Beginner', 'Intermediate', 'Advanced'][index % 3]),
  bodyPart: exercise.bodyPart ?? exercise.category,
  target: exercise.target ?? exercise.focus,
}));

export const nutritionSummary = {
  caloriesConsumed: 1842,
  caloriesTarget: defaultMacroTargets.calories,
  protein: {current: 142, target: defaultMacroTargets.protein},
  carbs: {current: 198, target: defaultMacroTargets.carbs},
  fat: {current: 48, target: defaultMacroTargets.fat},
  meals: [
    {id: 'meal-1', mealType: 'Breakfast', name: 'Anda Paratha + Karak Chai', calories: 480, protein: 22, carbs: 46, fat: 18},
    {id: 'meal-2', mealType: 'Lunch', name: 'Chicken Biryani (1.5 plates)', calories: 720, protein: 48, carbs: 86, fat: 18},
    {id: 'meal-3', mealType: 'Dinner', name: 'Grilled Chicken + Rice', calories: 620, protein: 54, carbs: 58, fat: 12},
  ],
  foodSearch: foodLibrary.slice(0, 8),
  mealPlan,
  starterPrograms,
};

export const profileSummary = {
  level: getLevelSnapshot(12850),
  streak: homeDashboard.streak,
  achievements: achievementCatalog.slice(0, 5),
  weightHistory,
  strengthMilestones: strengthMilestones,
  volumeHistory,
  sleepStages,
  readiness: readinessMetrics,
};

export const challengeSummary = challengeDefinitions.map(challenge => ({
  ...challenge,
  progress: evaluateChallengeCompletion({
    steps: homeDashboard.steps,
    workouts: 12,
    waterMl: homeDashboard.waterMl,
    sleepMinutes: 468 * 1.5,
    challengeType: challenge.type,
    teamVolume: 6800,
  }),
}));

export const socialSummary = {
  posts: socialPosts,
  totalFollowers: 1842,
  totalFollowing: 326,
};

export const healthSummary = {
  sleepScore: 87,
  scoreLabel: 'Excellent',
  totalSleep: '7h 48m',
  steps: 8432,
  goalSteps: 10000,
  distanceKm: 6.9,
  activeCalories: 432,
  activeMinutes: 72,
  activeGoalMinutes: 60,
  hourlySteps: [220, 310, 260, 120, 540, 820, 650, 740, 610, 482, 360, 280, 420, 610, 710, 640, 560, 470, 430, 260, 180, 120, 90, 40],
};
