/**
 * exerciseMedia.ts
 * Resolves RepDB exercise media (512px WebP form stills) to canonical URIs.
 *
 * The RepDB free dataset (https://github.com/RepDB/exercise-dataset) stores
 * images as relative paths such as "images/flat/push-up-start.webp". Most
 * movements ship a `start` and a `peak` still — the two ends of one repetition
 * — and a handful ship a single `main` still.
 *
 * They are served from the jsDelivr GitHub CDN; raw.githubusercontent is kept
 * as a fallback host because it is the origin jsDelivr mirrors.
 */

export const REMOTE_DATASET_ROOT =
  'https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@main';

export const REMOTE_DATASET_FALLBACK_ROOT =
  'https://raw.githubusercontent.com/RepDB/exercise-dataset/main';

// ── Internal ───────────────────────────────────────────────────────────────

const buildUri = (root: string, value?: string): string => {
  if (!value) { return ''; }
  const trimmed = value.trim();
  if (!trimmed) { return ''; }

  // Already absolute (e.g. a CDN URL baked into the dataset).
  if (/^https?:/i.test(trimmed)) { return trimmed; }

  // Relative dataset path e.g. "images/flat/push-up-start.webp"
  const cleanPath = trimmed.replace(/^\.?\//, '').replace(/\\/g, '/');
  return `${root}/${cleanPath}`;
};

// ── Public API ─────────────────────────────────────────────────────────────

/** Primary CDN URI for a dataset image path. */
export const resolveExerciseImageUri = (value?: string): string =>
  buildUri(REMOTE_DATASET_ROOT, value);

/**
 * Rewrites an already-resolved primary CDN URI onto the fallback host, so a
 * failed load can be retried against the origin. Returns '' when the URI is
 * not served by the dataset CDN.
 */
export const toFallbackMediaUri = (uri: string): string =>
  uri.startsWith(REMOTE_DATASET_ROOT)
    ? `${REMOTE_DATASET_FALLBACK_ROOT}${uri.slice(REMOTE_DATASET_ROOT.length)}`
    : '';

/**
 * Resolves an ordered list of dataset image paths into CDN URIs, dropping any
 * entry the dataset left empty. The first entry is the frame shown statically.
 */
export const resolveExerciseFrameUris = (frames?: string[]): string[] =>
  (frames ?? []).map(resolveExerciseImageUri).filter(Boolean);
