/**
 * communityService.ts
 * Local, offline-first store behind the Community feed.
 *
 * The feed used to render a static array: a post you wrote vanished on the next
 * mount, likes were local component state, and "refresh" was a 1.2 s timeout.
 * Everything an athlete does now lands here and survives a restart, exactly like
 * `dailyTracker` / `progressTracker`.
 *
 * The sample posts from `data/socialFeed.ts` are seeded once with real
 * timestamps so their "12m ago" labels age naturally instead of repeating
 * forever, and they are flagged `isSeed`. Swapping this module for a Supabase
 * table later is a drop-in change — the screen only talks to the functions here.
 */

import {socialPosts, suggestedPeople, groups} from '../data/socialFeed';
import {appStorage} from './storage';

const STORAGE_KEY = 'athleo_community_state';
const VERSION = 2;

export type CommunityWorkout = {
  title: string;
  volumeKg: number;
  durationMin: number;
  pr?: string;
};

export type CommunityPost = {
  id: string;
  authorName: string;
  handle: string;
  body: string;
  createdAt: number;
  /** Engagement already on a seeded sample post — your own actions are added on top. */
  baseLikes: number;
  baseComments: number;
  isSeed: boolean;
  avatar?: string;
  image?: string;
  workout?: CommunityWorkout | null;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type CommunityState = {
  version: number;
  posts: CommunityPost[];
  comments: CommunityComment[];
  likedIds: string[];
  followingIds: string[];
};

/** Seed engagement numbers are text in the source data — parse them once. */
function parseNumber(value: string): number {
  const digits = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTimeAgoToMs(timeAgo: string): number {
  const match = timeAgo.match(/(\d+)\s*([mhd])/i);
  if (!match) {
    return 0;
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const minute = 60 * 1000;
  if (unit === 'm') {return amount * minute;}
  if (unit === 'h') {return amount * 60 * minute;}
  return amount * 24 * 60 * minute;
}

function buildSeedState(): CommunityState {
  const now = Date.now();
  const posts: CommunityPost[] = socialPosts.map((post, index) => ({
    id: post.id,
    authorName: post.user,
    handle: post.handle,
    body: post.text,
    createdAt: now - parseTimeAgoToMs(post.timeAgo) - index * 60 * 1000,
    baseLikes: post.likes,
    baseComments: post.comments,
    isSeed: true,
    avatar: post.avatar,
    image: post.image,
    workout: post.workout
      ? {
          title: post.workout.title,
          volumeKg: parseNumber(post.workout.volume),
          durationMin: parseNumber(post.workout.duration),
          pr: post.workout.pr,
        }
      : null,
  }));

  return {version: VERSION, posts, comments: [], likedIds: [], followingIds: []};
}

const isState = (value: unknown): value is CommunityState => {
  const state = value as CommunityState | null;
  return Boolean(state) && state?.version === VERSION && Array.isArray(state.posts);
};

export function loadCommunity(): CommunityState {
  const stored = appStorage.getObject<unknown>(STORAGE_KEY);
  if (isState(stored)) {
    return {
      ...stored,
      posts: stored.posts.map(post => ({...post, baseLikes: post.baseLikes ?? 0})),
      comments: Array.isArray(stored.comments) ? stored.comments : [],
      likedIds: Array.isArray(stored.likedIds) ? stored.likedIds : [],
      followingIds: Array.isArray(stored.followingIds) ? stored.followingIds : [],
    };
  }
  const seeded = buildSeedState();
  persist(seeded);
  return seeded;
}

function persist(state: CommunityState): void {
  appStorage.setObject(STORAGE_KEY, state);
}

export function isLiked(state: CommunityState, postId: string): boolean {
  return state.likedIds.includes(postId);
}

export function likeCount(state: CommunityState, post: CommunityPost): number {
  return post.baseLikes + (isLiked(state, post.id) ? 1 : 0);
}

export function commentCount(state: CommunityState, post: CommunityPost): number {
  const own = state.comments.filter(comment => comment.postId === post.id).length;
  return post.baseComments + own;
}

/** Comments stored on this device for a post, oldest first. */
export function getComments(state: CommunityState, postId: string): CommunityComment[] {
  return state.comments
    .filter(comment => comment.postId === postId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function isFollowing(state: CommunityState, personId: string): boolean {
  return state.followingIds.includes(personId);
}

/** Newest first. */
export function getPosts(state: CommunityState): CommunityPost[] {
  return [...state.posts].sort((a, b) => b.createdAt - a.createdAt);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Handle derived from the athlete's own name (same shape as the seeded handles). */
export function handleFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `@${slug || 'athlete'}`;
}

export function createPost(
  state: CommunityState,
  input: {authorName: string; body: string; workout?: CommunityWorkout | null},
): CommunityState {
  const body = input.body.trim();
  if (!body) {
    return state;
  }
  const post: CommunityPost = {
    id: makeId('post'),
    authorName: input.authorName,
    handle: handleFor(input.authorName),
    body,
    createdAt: Date.now(),
    baseLikes: 0,
    baseComments: 0,
    isSeed: false,
    workout: input.workout ?? null,
  };
  const next: CommunityState = {...state, posts: [post, ...state.posts]};
  persist(next);
  return next;
}

export function deletePost(state: CommunityState, postId: string): CommunityState {
  const next: CommunityState = {
    ...state,
    posts: state.posts.filter(post => post.id !== postId),
    comments: state.comments.filter(comment => comment.postId !== postId),
    likedIds: state.likedIds.filter(id => id !== postId),
  };
  persist(next);
  return next;
}

export function toggleLike(state: CommunityState, postId: string): CommunityState {
  const liked = state.likedIds.includes(postId);
  const next: CommunityState = {
    ...state,
    likedIds: liked
      ? state.likedIds.filter(id => id !== postId)
      : [...state.likedIds, postId],
  };
  persist(next);
  return next;
}

export function addComment(
  state: CommunityState,
  input: {postId: string; authorName: string; body: string},
): CommunityState {
  const body = input.body.trim();
  if (!body) {
    return state;
  }
  const comment: CommunityComment = {
    id: makeId('comment'),
    postId: input.postId,
    authorName: input.authorName,
    body,
    createdAt: Date.now(),
  };
  const next: CommunityState = {...state, comments: [...state.comments, comment]};
  persist(next);
  return next;
}

export function toggleFollow(state: CommunityState, personId: string): CommunityState {
  const following = state.followingIds.includes(personId);
  const next: CommunityState = {
    ...state,
    followingIds: following
      ? state.followingIds.filter(id => id !== personId)
      : [...state.followingIds, personId],
  };
  persist(next);
  return next;
}

export function getSuggestedPeople() {
  return suggestedPeople;
}

export function getGroups() {
  return groups;
}

/** Real relative time from a stored timestamp, so labels age as time passes. */
export function getRelativeTime(createdAt: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
  if (seconds < 45) {return 'just now';}
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {return `${minutes}m ago`;}
  const hours = Math.round(minutes / 60);
  if (hours < 24) {return `${hours}h ago`;}
  const days = Math.round(hours / 24);
  if (days < 7) {return `${days}d ago`;}
  return `${Math.round(days / 7)}w ago`;
}
