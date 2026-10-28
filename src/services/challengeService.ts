/**
 * challengeService.ts
 * Manages challenges, leaderboard and badge tracking using MMKV persistence.
 */

import {appStorage} from './storage';
import {getProgressHistory, getStreakDays} from './progressTracker';
import {getCachedDisplayName} from './profileSync';
import {isSupabaseConfigured} from '../config/supabase';
import {getSupabaseClient} from './auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChallengeId =
  | 'streak_30'
  | 'steps_100k_week'
  | 'workouts_10_month'
  | 'calorie_crusher';

export type Challenge = {
  id: ChallengeId;
  title: string;
  badge: string;
  emoji: string;
  description: string;
  color: string;
  durationDays: number;
  goal: number;
  goalUnit: string;
  icon: string;
};

export type UserChallenge = {
  challengeId: ChallengeId;
  joinedAt: string; // ISO date
  progress: number;
  completed: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  scoreLabel: string;
  isYou: boolean;
};

export type BadgeInfo = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  earned: boolean;
  earnedAt?: string;
};

// ─── Static Challenge Catalogue ──────────────────────────────────────────────

export const CHALLENGE_CATALOGUE: Challenge[] = [
  {
    id: 'streak_30',
    title: '30-Day Streak',
    badge: '30 DAY',
    emoji: '🔥',
    description: 'Train or stay active 30 days in a row without breaking your streak.',
    color: '#FF6B35',
    durationDays: 30,
    goal: 30,
    goalUnit: 'days',
    icon: 'flame-outline',
  },
  {
    id: 'steps_100k_week',
    title: '100K Steps Week',
    badge: '100K',
    emoji: '👟',
    description: 'Accumulate 100,000 steps in a single calendar week.',
    color: '#3AB4FF',
    durationDays: 7,
    goal: 100000,
    goalUnit: 'steps',
    icon: 'footsteps-outline',
  },
  {
    id: 'workouts_10_month',
    title: '10 Workouts Month',
    badge: 'GRIND',
    emoji: '💪',
    description: 'Complete 10 full workouts in any rolling 30-day window.',
    color: '#B8FF4D',
    durationDays: 30,
    goal: 10,
    goalUnit: 'workouts',
    icon: 'barbell-outline',
  },
  {
    id: 'calorie_crusher',
    title: 'Calorie Crusher',
    badge: 'BURN',
    emoji: '⚡',
    description: 'Burn 5,000 calories through active exercise over 7 days.',
    color: '#A78BFA',
    durationDays: 7,
    goal: 5000,
    goalUnit: 'kcal burned',
    icon: 'flash-outline',
  },
];

// ─── Storage Keys ────────────────────────────────────────────────────────────

const JOINED_KEY = 'athleo_joined_challenges';
const BADGES_KEY = 'athleo_earned_badges';

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadJoined(): UserChallenge[] {
  return appStorage.getObject<UserChallenge[]>(JOINED_KEY) ?? [];
}

function saveJoined(challenges: UserChallenge[]): void {
  appStorage.setObject(JOINED_KEY, challenges);
}

// ─── Progress Calculator ─────────────────────────────────────────────────────

export function getChallengeProgress(id: ChallengeId): number {
  const history = getProgressHistory(30);
  switch (id) {
    case 'streak_30':
      return Math.min(30, getStreakDays());
    case 'steps_100k_week': {
      const week = history.slice(-7);
      return Math.min(100000, week.reduce((s, e) => s + e.steps, 0));
    }
    case 'workouts_10_month': {
      const month = history.slice(-30);
      return Math.min(10, month.reduce((s, e) => s + e.workoutsCompleted, 0));
    }
    case 'calorie_crusher': {
      const week = history.slice(-7);
      return Math.min(5000, week.reduce((s, e) => s + e.caloriesBurned, 0));
    }
    default:
      return 0;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getAvailableChallenges(): Challenge[] {
  return CHALLENGE_CATALOGUE;
}

export function getJoinedChallenges(): UserChallenge[] {
  return loadJoined();
}

export function isJoined(id: ChallengeId): boolean {
  return loadJoined().some(c => c.challengeId === id);
}

export function joinChallenge(id: ChallengeId): void {
  const existing = loadJoined();
  if (existing.some(c => c.challengeId === id)) {return;}
  existing.push({
    challengeId: id,
    joinedAt: new Date().toISOString().split('T')[0],
    progress: getChallengeProgress(id),
    completed: false,
  });
  saveJoined(existing);

  // Sync real user entry to cloud and local cache
  setTimeout(() => {
    syncLeaderboardWithCloud(id).catch(() => undefined);
  }, 100);
}

export function leaveChallenge(id: ChallengeId): void {
  const filtered = loadJoined().filter(c => c.challengeId !== id);
  saveJoined(filtered);

  // Remove user entry from cloud and local cache
  setTimeout(() => {
    removeUserFromChallengeCloud(id).catch(() => undefined);
  }, 100);
}

export function refreshProgress(): void {
  const joined = loadJoined();
  const updated = joined.map(jc => ({
    ...jc,
    progress: getChallengeProgress(jc.challengeId),
    completed: getChallengeProgress(jc.challengeId) >= (CHALLENGE_CATALOGUE.find(c => c.id === jc.challengeId)?.goal ?? 999),
  }));
  saveJoined(updated);

  // Keep live ranks updated for all joined challenges
  updated.forEach(jc => {
    syncLeaderboardWithCloud(jc.challengeId).catch(() => undefined);
  });
}

// ─── Real User Leaderboard ───────────────────────────────────────────────────

const LEADERBOARD_CACHE_KEY = 'athleo_challenge_leaderboard_cache';

export type RealLeaderboardParticipant = {
  userId?: string;
  name: string;
  avatar: string;
  score: number;
  scoreLabel: string;
  isYou: boolean;
};

function getLocalLeaderboardCache(): Record<string, RealLeaderboardParticipant[]> {
  try {
    return appStorage.getObject<Record<string, RealLeaderboardParticipant[]>>(LEADERBOARD_CACHE_KEY) ?? {};
  } catch {
    return {};
  }
}

function saveLocalLeaderboardCache(data: Record<string, RealLeaderboardParticipant[]>): void {
  try {
    appStorage.setObject(LEADERBOARD_CACHE_KEY, data);
  } catch { /* ignore */ }
}

/**
 * Returns the live leaderboard for a challenge.
 * Completely empty by default — only contains real users who have joined.
 */
export function getLeaderboard(id: ChallengeId): LeaderboardEntry[] {
  const challenge = CHALLENGE_CATALOGUE.find(c => c.id === id);
  if (!challenge) {return [];}

  const cache = getLocalLeaderboardCache();
  let participants: RealLeaderboardParticipant[] = [...(cache[id] ?? [])];

  const userJoined = isJoined(id);
  const myProgress = getChallengeProgress(id);
  const myName = getCachedDisplayName() || 'You';
  const myAvatar = myName.charAt(0).toUpperCase() || 'A';

  const existingIndex = participants.findIndex(p => p.isYou || p.name === myName);
  if (userJoined) {
    const youEntry: RealLeaderboardParticipant = {
      name: myName,
      avatar: myAvatar,
      score: myProgress,
      scoreLabel: `${myProgress.toLocaleString()} ${challenge.goalUnit}`,
      isYou: true,
    };

    if (existingIndex >= 0) {
      participants[existingIndex] = youEntry;
    } else {
      participants.push(youEntry);
    }
  } else if (existingIndex >= 0) {
    participants.splice(existingIndex, 1);
  }

  // Sort descending by score
  participants.sort((a, b) => b.score - a.score);

  return participants.map((p, index) => ({
    rank: index + 1,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    scoreLabel: p.scoreLabel,
    isYou: p.isYou,
  }));
}

/**
 * Syncs the current user's challenge participation to Supabase and
 * fetches all other real enrolled users from the cloud database.
 */
export async function syncLeaderboardWithCloud(id: ChallengeId): Promise<LeaderboardEntry[]> {
  const challenge = CHALLENGE_CATALOGUE.find(c => c.id === id);
  if (!challenge) {return [];}

  // 1. If user is joined, push to Supabase
  if (isJoined(id) && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const {data: {user}} = await supabase.auth.getUser();
      if (user) {
        const myName = getCachedDisplayName() || user.user_metadata?.full_name || 'Athlete';
        const myScore = getChallengeProgress(id);
        const scoreLabel = `${myScore.toLocaleString()} ${challenge.goalUnit}`;

        await (supabase as any).from('challenge_participants').upsert(
          {
            challenge_id: id,
            user_id: user.id,
            display_name: myName,
            score: myScore,
            score_label: scoreLabel,
            updated_at: new Date().toISOString(),
          },
          {onConflict: 'challenge_id,user_id'},
        );
      }
    } catch { /* non-critical */ }
  }

  // 2. Fetch all real participants from Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const {data: {user}} = await supabase.auth.getUser();
      const currentUserId = user?.id ?? '';

      const {data, error} = await (supabase as any)
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', id)
        .order('score', {ascending: false})
        .limit(50);

      if (!error && Array.isArray(data)) {
        const remoteParticipants: RealLeaderboardParticipant[] = data.map((row: any) => ({
          userId: row.user_id,
          name: row.user_id === currentUserId ? (getCachedDisplayName() || row.display_name) : row.display_name,
          avatar: (row.display_name || 'A').charAt(0).toUpperCase(),
          score: Number(row.score) || 0,
          scoreLabel: row.score_label || `${row.score} ${challenge.goalUnit}`,
          isYou: row.user_id === currentUserId,
        }));

        const cache = getLocalLeaderboardCache();
        cache[id] = remoteParticipants;
        saveLocalLeaderboardCache(cache);
      }
    } catch { /* non-critical */ }
  }

  return getLeaderboard(id);
}

async function removeUserFromChallengeCloud(id: ChallengeId): Promise<void> {
  const cache = getLocalLeaderboardCache();
  const myName = getCachedDisplayName() || 'You';
  if (cache[id]) {
    cache[id] = cache[id].filter(p => !p.isYou && p.name !== myName);
    saveLocalLeaderboardCache(cache);
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const {data: {user}} = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from('challenge_participants')
          .delete()
          .eq('challenge_id', id)
          .eq('user_id', user.id);
      }
    } catch { /* non-critical */ }
  }
}

// ─── Badges ──────────────────────────────────────────────────────────────────

const ALL_BADGES: BadgeInfo[] = [
  {id: 'first_workout', label: 'First Sweat', emoji: '🏋️', color: '#B8FF4D', earned: false},
  {id: 'streak_7', label: '7-Day Streak', emoji: '🔥', color: '#FF6B35', earned: false},
  {id: 'streak_30', label: '30-Day Legend', emoji: '👑', color: '#A78BFA', earned: false},
  {id: 'steps_50k', label: 'Half Century', emoji: '👟', color: '#3AB4FF', earned: false},
  {id: 'steps_100k', label: 'Century Steps', emoji: '🚀', color: '#3AB4FF', earned: false},
  {id: 'calorie_crusher', label: 'Calorie Crusher', emoji: '⚡', color: '#A78BFA', earned: false},
  {id: 'workouts_10', label: 'Grind Mode', emoji: '💪', color: '#B8FF4D', earned: false},
  {id: 'early_bird', label: 'Early Bird', emoji: '🌅', color: '#FFB020', earned: false},
];

export function getBadges(): BadgeInfo[] {
  const stored = appStorage.getObject<BadgeInfo[]>(BADGES_KEY) ?? [];
  const storedMap = new Map(stored.map(b => [b.id, b]));

  // Auto-compute earned status from progress data
  const history = getProgressHistory(30);
  const streak = getStreakDays();
  const totalWorkouts = history.reduce((s, e) => s + e.workoutsCompleted, 0);
  const totalSteps = history.reduce((s, e) => s + e.steps, 0);
  const totalCalBurned = history.reduce((s, e) => s + e.caloriesBurned, 0);

  return ALL_BADGES.map(badge => {
    const stored_entry = storedMap.get(badge.id);
    let earned = stored_entry?.earned ?? false;
    let earnedAt = stored_entry?.earnedAt;

    if (!earned) {
      switch (badge.id) {
        case 'first_workout': earned = totalWorkouts >= 1; break;
        case 'streak_7': earned = streak >= 7; break;
        case 'streak_30': earned = streak >= 30; break;
        case 'steps_50k': earned = totalSteps >= 50000; break;
        case 'steps_100k': earned = totalSteps >= 100000; break;
        case 'calorie_crusher': earned = totalCalBurned >= 5000; break;
        case 'workouts_10': earned = totalWorkouts >= 10; break;
        default: earned = false;
      }
      if (earned) {
        earnedAt = new Date().toISOString().split('T')[0];
      }
    }
    return {...badge, earned, earnedAt};
  });
}
