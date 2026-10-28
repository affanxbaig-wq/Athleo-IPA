/**
 * generate-flow-dataset.js
 *
 * Builds an offline, bundled exercise dataset for the Workout Library.
 *
 * Source:  ../../../flow-exercise-dataset  (data/exercises.json + assets/**.svg)
 * Output:  ../src/data/flowExercises.json  (trimmed metadata, curated subset)
 *          ../src/data/flowExerciseFrames.ts (SVG frame XML keyed by frame path)
 *
 * Only a curated subset is bundled: the raw dataset ships ~43 MB of traced SVG
 * frames, which is far too heavy for a mobile bundle. MAX_EXERCISES caps how
 * many of the ~1250 animated exercises are bundled offline so the library stays
 * rich while the app bundle remains reasonable.
 *
 * Run with:  node scripts/generate-flow-dataset.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_ROOT = path.resolve(__dirname, '..', '..', 'flow-exercise-dataset');
const DATASET_JSON = path.join(SOURCE_ROOT, 'data', 'exercises.json');
const ASSETS_ROOT = path.join(SOURCE_ROOT, 'assets');

const OUT_META = path.resolve(__dirname, '..', 'src', 'data', 'flowExercises.json');
const OUT_FRAMES = path.resolve(__dirname, '..', 'src', 'data', 'flowExerciseFrames.ts');

// Movement keywords, in priority order. One exercise is picked per keyword so the
// curated list stays varied across body parts and movement patterns.
const MOVEMENT_KEYWORDS = [
  'push-up', 'bench press', 'overhead press', 'shoulder press', 'lateral raise',
  'biceps curl', 'triceps', 'pull-up', 'lat pulldown', 'seated row', 'bent over row',
  'squat', 'deadlift', 'lunge', 'hip thrust', 'glute bridge', 'calf raise',
  'leg raise', 'plank', 'crunch', 'sit-up', 'russian twist', 'mountain climber',
  'jumping jack', 'burpee', 'high knee', 'jump squat', 'wall sit', 'dip',
  'superman', 'bird dog', 'dead bug', 'step-up', 'arm circle', 'side plank',
  'hollow hold', 'flutter kick', 'reverse fly', 'front raise', 'hammer curl',
  'shrug', 'good morning', 'romanian deadlift', 'face pull', 'kettlebell swing',
  'stretch', 'leg extension', 'leg curl', 'chest fly',
];

const MAX_EXERCISES = 1324;

function main() {
  if (!fs.existsSync(DATASET_JSON)) {
    throw new Error(`Source dataset not found: ${DATASET_JSON}`);
  }

  const raw = JSON.parse(fs.readFileSync(DATASET_JSON, 'utf8'));
  const withFrames = raw.filter(
    record =>
      record.animation &&
      Array.isArray(record.animation.frames) &&
      record.animation.frames.length > 0 &&
      record.animation.frames.every(frame => fs.existsSync(path.join(SOURCE_ROOT, frame))),
  );

  const chosen = [];
  const usedIds = new Set();

  for (const keyword of MOVEMENT_KEYWORDS) {
    if (chosen.length >= MAX_EXERCISES) {
      break;
    }
    const hit = withFrames.find(
      record => !usedIds.has(record.id) && record.name.toLowerCase().includes(keyword),
    );
    if (hit) {
      usedIds.add(hit.id);
      chosen.push(hit);
    }
  }

  // Top up with remaining animated exercises if the keyword sweep came up short.
  for (const record of withFrames) {
    if (chosen.length >= MAX_EXERCISES) {
      break;
    }
    if (!usedIds.has(record.id)) {
      usedIds.add(record.id);
      chosen.push(record);
    }
  }

  const exercises = chosen.map(record => ({
    id: record.id,
    name: record.name,
    bodyPart: record.bodyPart,
    equipment: record.equipment,
    target: record.target,
    secondaryMuscles: (record.secondaryMuscles || []).slice(0, 4),
    movementPattern: record.movementPattern,
    instructions: (record.instructions || []).slice(0, 4),
    dataLicense: record.dataLicense,
    mediaStatus: record.mediaStatus,
    animation: {
      frames: record.animation.frames,
      sequence: record.animation.sequence,
      frameDurationMs: record.animation.frameDurationMs,
      license: record.animation.license,
    },
  }));

  fs.writeFileSync(OUT_META, `${JSON.stringify(exercises)}\n`, 'utf8');

  const frameEntries = [];
  for (const record of exercises) {
    for (const frame of record.animation.frames) {
      const xml = fs.readFileSync(path.join(SOURCE_ROOT, frame), 'utf8');
      const minified = xml
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
        .replace(/\s*\n\s*/g, ' ')
        .trim();
      frameEntries.push(`  ${JSON.stringify(frame)}:\n    ${JSON.stringify(minified)},`);
    }
  }

  const framesFile = `/**
 * flowExerciseFrames.ts — GENERATED FILE, DO NOT EDIT BY HAND.
 * Regenerate with: node scripts/generate-flow-dataset.js
 *
 * SVG frame XML for the curated offline exercise set, keyed by dataset frame path.
 */

export const FLOW_EXERCISE_FRAMES: Record<string, string> = {
${frameEntries.join('\n')}
};
`;

  fs.writeFileSync(OUT_FRAMES, framesFile, 'utf8');

  const metaKb = Math.round(fs.statSync(OUT_META).size / 1024);
  const framesKb = Math.round(fs.statSync(OUT_FRAMES).size / 1024);
  console.log(`curated exercises: ${exercises.length}`);
  console.log(`wrote ${OUT_META} (${metaKb} KB)`);
  console.log(`wrote ${OUT_FRAMES} (${framesKb} KB)`);
}

main();
