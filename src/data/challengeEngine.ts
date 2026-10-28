export type ChallengeType = 'daily' | 'weekly' | 'monthly' | 'transform' | 'group';

export type ChallengeDefinition = {
  id: string;
  name: string;
  type: ChallengeType;
  target: string;
  objective: string;
  rewardXp: number;
  rewardBadge?: string;
};

export const challengeDefinitions: ChallengeDefinition[] = [
  {id: 'daily-steps', name: '10K Day', type: 'daily', target: '10,000 steps', objective: 'Complete 10k steps in a single day.', rewardXp: 150, rewardBadge: 'week-10k'},
  {id: 'weekly-fuel', name: 'Hydration Week', type: 'weekly', target: '7-day water target', objective: 'Hit hydration each day for 7 days.', rewardXp: 220, rewardBadge: 'sleep-goal'},
  {id: 'monthly-transform', name: 'Transformation 30', type: 'monthly', target: '30-day body comp', objective: 'Stay consistent across workouts, sleep and weight checks.', rewardXp: 400, rewardBadge: 'challenge-complete'},
  {id: 'group-push', name: 'Group Push', type: 'group', target: 'team total volume', objective: 'Complete a group challenge with your team.', rewardXp: 300},
];

export function evaluateChallengeCompletion(
  metrics: {
    steps: number;
    workouts: number;
    waterMl: number;
    sleepMinutes: number;
    challengeType: ChallengeType;
    teamVolume?: number;
  },
): boolean {
  switch (metrics.challengeType) {
    case 'daily':
      return metrics.steps >= 10000;
    case 'weekly':
      return metrics.waterMl >= 14000 && metrics.sleepMinutes >= 3360;
    case 'monthly':
      return metrics.workouts >= 12 && metrics.sleepMinutes >= 12000;
    case 'transform':
      return metrics.workouts >= 8 && metrics.steps >= 70000;
    case 'group':
      return (metrics.teamVolume ?? 0) >= 5000;
    default:
      return false;
  }
}
