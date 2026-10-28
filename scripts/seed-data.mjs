#!/usr/bin/env node
/**
 * ATHLEO Backend Seed Script
 *
 * Seeds:
 *  1. exercises  — from flow-exercise-dataset
 *  2. foods      — curated starter list
 *  3. badges     — achievement definitions
 *  4. storage buckets — progress-photos, profile-avatars, meal-photos, workout-videos
 *
 * Usage:
 *   node scripts/seed-data.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ──────────────────────────────────────────
// Load .env
// ──────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at', envPath);
    process.exit(1);
  }
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY === 'your-service-role-key') {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env');
  console.error('   Open your Supabase dashboard → Project Settings → API → service_role key');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Prefer': 'return=minimal',
};

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
async function supabasePost(endpoint, body) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${endpoint} → ${res.status}: ${text}`);
  }
  return res;
}

async function supabaseGet(endpoint) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${endpoint} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function upsertBatch(table, rows, onConflict = 'name') {
  if (rows.length === 0) return;
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Prefer': `resolution=ignore-duplicates,return=minimal`,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upsert ${table} → ${res.status}: ${text}`);
  }
}

async function supabaseDelete(table, query = 'id=not.is.null') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...HEADERS,
      'Prefer': 'return=minimal',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${table} → ${res.status}: ${text}`);
  }
}

async function deleteLegacyExerciseCatalog() {
  console.log('  Removing legacy exercise records and dependent references...');
  await supabaseDelete('sets', 'id=not.is.null');
  await supabaseDelete('session_exercises', 'id=not.is.null');
  await supabaseDelete('personal_records', 'id=not.is.null');
  await supabaseDelete('program_day_exercises', 'id=not.is.null');
  await supabaseDelete('exercises', 'id=not.is.null');
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ──────────────────────────────────────────
// 1. Exercises
// ──────────────────────────────────────────
async function seedExercises() {
  console.log('\n📦 Seeding exercises...');

  // Load the installed exercises-dataset repo as the canonical library.
  const datasetPath = path.resolve(ROOT, '..', 'exercises-dataset', 'data', 'exercises.json');
  if (!fs.existsSync(datasetPath)) {
    console.warn('  ⚠️  exercises-dataset not found at', datasetPath);
    console.warn('     Falling back to flow-exercise-dataset if it still exists.');
    const legacyPath = path.resolve(ROOT, '..', 'flow-exercise-dataset', 'data', 'exercises.json');
    if (!fs.existsSync(legacyPath)) {
      console.warn('     Seeding with built-in starter exercises instead.');
      await seedBuiltinExercises();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    const exercises = Array.isArray(raw) ? raw : Object.values(raw).flat();
    // legacy fallback path retained only until the old repo is removed
    console.log(`  Found ${exercises.length} legacy exercises in dataset`);

    // Check existing count
    const existing = await supabaseGet('exercises?select=id&limit=1');
    if (existing.length > 0) {
      const count = await supabaseGet('exercises?select=id');
      if (count.length >= 100) {
        console.log(`  ✅ Already have ${count.length} exercises, skipping.`);
        return;
      }
    }

    if (existing.length > 0) {
      await deleteLegacyExerciseCatalog();
    }

    const mapped = exercises.map(ex => ({
      source_id: String(ex.id ?? '').trim(),
      name: ex.name,
      body_part: ex.body_part || ex.bodyPart || null,
      category: ex.category || ex.body_part || ex.bodyPart || null,
      equipment: ex.equipment || null,
      target_muscle: ex.target || null,
      primary_muscle_group: ex.target || null,
      secondary_muscle_groups: Array.isArray(ex.secondary_muscles ?? ex.secondaryMuscles) ? (ex.secondary_muscles ?? ex.secondaryMuscles).slice(0, 10) : [],
      movement_pattern: ex.movement_pattern || ex.movementPattern || null,
      instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
      description: ex.instructions && ex.instructions.en ? ex.instructions.en : (Array.isArray(ex.instruction_steps?.en) ? ex.instruction_steps.en.join(' ') : (ex.instructions && Array.isArray(ex.instructions) ? ex.instructions[0] : null)),
      image_url: ex.image || ex.image_url || null,
      gif_url: ex.gif_url || null,
      data_license: ex.attribution || ex.dataLicense || null,
      media_status: ex.media_status || ex.mediaStatus || (ex.gif_url ? 'gif_available' : 'image_only'),
      animation: ex.animation || {},
      source_dataset: 'exercises-dataset',
      is_global: true,
    }));

    const batches = chunk(mapped, 200);
    let inserted = 0;
    for (let i = 0; i < batches.length; i++) {
      process.stdout.write(`  Uploading batch ${i + 1}/${batches.length}...`);
      await upsertBatch('exercises', batches[i], 'source_id');
      inserted += batches[i].length;
      process.stdout.write(` ✓\n`);
    }
    console.log(`  ✅ Seeded ${inserted} exercises`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const exercises = Array.isArray(raw) ? raw : Object.values(raw).flat();

  console.log(`  Found ${exercises.length} exercises in dataset`);

  // Check existing count
  const existing = await supabaseGet('exercises?select=id&limit=1');
  if (existing.length > 0) {
    const count = await supabaseGet('exercises?select=id');
    if (count.length >= 100) {
      console.log(`  ✅ Already have ${count.length} exercises, skipping.`);
      return;
    }
  }

  if (existing.length > 0) {
    await deleteLegacyExerciseCatalog();
  }

  const mapped = exercises.map(ex => ({
    source_id: String(ex.id ?? '').trim(),
    name: ex.name,
    body_part: ex.body_part || ex.bodyPart || null,
    category: ex.category || ex.body_part || ex.bodyPart || null,
    equipment: ex.equipment || null,
    target_muscle: ex.target || null,
    primary_muscle_group: ex.target || null,
    secondary_muscle_groups: Array.isArray(ex.secondary_muscles ?? ex.secondaryMuscles) ? (ex.secondary_muscles ?? ex.secondaryMuscles).slice(0, 10) : [],
    movement_pattern: ex.movement_pattern || ex.movementPattern || null,
    instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
    description: ex.instructions && ex.instructions.en ? ex.instructions.en : (Array.isArray(ex.instruction_steps?.en) ? ex.instruction_steps.en.join(' ') : (ex.instructions && Array.isArray(ex.instructions) ? ex.instructions[0] : null)),
    image_url: ex.image || ex.image_url || null,
    gif_url: ex.gif_url || null,
    data_license: ex.attribution || ex.dataLicense || null,
    media_status: ex.media_status || ex.mediaStatus || (ex.gif_url ? 'gif_available' : 'image_only'),
    animation: ex.animation || {},
    source_dataset: 'exercises-dataset',
    is_global: true,
  }));

  const batches = chunk(mapped, 200);
  let inserted = 0;
  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(`  Uploading batch ${i + 1}/${batches.length}...`);
    await upsertBatch('exercises', batches[i], 'source_id');
    inserted += batches[i].length;
    process.stdout.write(` ✓\n`);
  }
  console.log(`  ✅ Seeded ${inserted} exercises`);
}

async function seedBuiltinExercises() {
  const builtins = [
    { name: 'Barbell Squat', category: 'upper legs', equipment: 'barbell', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes','hamstrings'], movement_pattern: 'squat', instructions: '["Stand with feet shoulder-width apart","Rest barbell on upper traps","Squat until thighs are parallel","Drive through heels to stand"]', is_global: true },
    { name: 'Bench Press', category: 'chest', equipment: 'barbell', primary_muscle_group: 'pectorals', secondary_muscle_groups: ['triceps','shoulders'], movement_pattern: 'push_h', instructions: '["Lie flat on bench","Grip bar slightly wider than shoulders","Lower bar to chest","Press bar back up"]', is_global: true },
    { name: 'Deadlift', category: 'back', equipment: 'barbell', primary_muscle_group: 'glutes', secondary_muscle_groups: ['hamstrings','lower back'], movement_pattern: 'hinge', instructions: '["Stand over bar with feet hip-width","Hinge at hips, grip bar","Drive hips forward to stand tall","Lower bar under control"]', is_global: true },
    { name: 'Pull-Up', category: 'back', equipment: 'body weight', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps','rhomboids'], movement_pattern: 'pull_v', instructions: '["Hang from bar with overhand grip","Pull chest up to bar","Lower with control","Repeat"]', is_global: true },
    { name: 'Overhead Press', category: 'shoulders', equipment: 'barbell', primary_muscle_group: 'delts', secondary_muscle_groups: ['triceps','upper chest'], movement_pattern: 'push_v', instructions: '["Stand with bar at collar bone","Press bar overhead","Lock out arms","Lower under control"]', is_global: true },
    { name: 'Romanian Deadlift', category: 'upper legs', equipment: 'barbell', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes','lower back'], movement_pattern: 'hinge', instructions: '["Hold bar at hip level","Hinge forward keeping back flat","Lower bar along legs","Drive hips forward to return"]', is_global: true },
    { name: 'Dumbbell Lunges', category: 'upper legs', equipment: 'dumbbell', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes','hamstrings'], movement_pattern: 'lunge', instructions: '["Stand with dumbbells at sides","Step forward and lower knee","Drive through front heel to stand","Alternate legs"]', is_global: true },
    { name: 'Plank', category: 'waist', equipment: 'body weight', primary_muscle_group: 'abs', secondary_muscle_groups: ['lower back','shoulders'], movement_pattern: 'core', instructions: '["Get into push-up position","Lower to forearms","Keep body straight","Hold for time"]', is_global: true },
    { name: 'Dips', category: 'chest', equipment: 'body weight', primary_muscle_group: 'triceps', secondary_muscle_groups: ['pectorals','shoulders'], movement_pattern: 'push_h', instructions: '["Grip parallel bars, arms straight","Lower body until elbows at 90 degrees","Push back up","Repeat"]', is_global: true },
    { name: 'Bent Over Row', category: 'back', equipment: 'barbell', primary_muscle_group: 'lats', secondary_muscle_groups: ['rhomboids','biceps'], movement_pattern: 'pull_h', instructions: '["Hinge forward with bar","Pull bar to lower chest","Squeeze shoulder blades","Lower with control"]', is_global: true },
    { name: 'Bicep Curl', category: 'upper arms', equipment: 'dumbbell', primary_muscle_group: 'biceps', secondary_muscle_groups: ['forearms'], movement_pattern: 'pull_v', instructions: '["Stand with dumbbells palms up","Curl weights to shoulders","Squeeze at top","Lower slowly"]', is_global: true },
    { name: 'Tricep Pushdown', category: 'upper arms', equipment: 'cable', primary_muscle_group: 'triceps', secondary_muscle_groups: [], movement_pattern: 'push_v', instructions: '["Stand at cable machine","Push bar down until arms straight","Control the return","Repeat"]', is_global: true },
    { name: 'Leg Press', category: 'upper legs', equipment: 'leverage machine', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes','hamstrings'], movement_pattern: 'squat', instructions: '["Sit in leg press machine","Place feet shoulder-width","Push platform away","Return under control"]', is_global: true },
    { name: 'Lat Pulldown', category: 'back', equipment: 'cable', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps','rhomboids'], movement_pattern: 'pull_v', instructions: '["Sit at lat pulldown machine","Grip bar wider than shoulders","Pull bar to upper chest","Return with control"]', is_global: true },
    { name: 'Cable Row', category: 'back', equipment: 'cable', primary_muscle_group: 'lats', secondary_muscle_groups: ['rhomboids','biceps'], movement_pattern: 'pull_h', instructions: '["Sit at cable row machine","Pull handle to lower chest","Squeeze at peak","Return slowly"]', is_global: true },
    { name: 'Push-Up', category: 'chest', equipment: 'body weight', primary_muscle_group: 'pectorals', secondary_muscle_groups: ['triceps','shoulders'], movement_pattern: 'push_h', instructions: '["Start in high plank","Lower chest toward ground","Push back to start","Keep core tight"]', is_global: true },
    { name: 'Incline Dumbbell Press', category: 'chest', equipment: 'dumbbell', primary_muscle_group: 'pectorals', secondary_muscle_groups: ['triceps','shoulders'], movement_pattern: 'push_h', instructions: '["Set bench at 30-45 degrees","Press dumbbells from chest","Extend fully at top","Lower with control"]', is_global: true },
    { name: 'Face Pull', category: 'shoulders', equipment: 'cable', primary_muscle_group: 'delts', secondary_muscle_groups: ['rotator cuff','rhomboids'], movement_pattern: 'pull_h', instructions: '["Attach rope to high cable","Pull rope to face","Externally rotate at peak","Control the return"]', is_global: true },
    { name: 'Hip Thrust', category: 'upper legs', equipment: 'barbell', primary_muscle_group: 'glutes', secondary_muscle_groups: ['hamstrings','abs'], movement_pattern: 'hinge', instructions: '["Sit back against bench with bar over hips","Drive hips up","Squeeze glutes at top","Lower under control"]', is_global: true },
    { name: 'Calf Raise', category: 'lower legs', equipment: 'leverage machine', primary_muscle_group: 'calves', secondary_muscle_groups: [], movement_pattern: 'isolation', instructions: '["Stand on calf raise platform","Rise onto toes","Hold at top","Lower fully"]', is_global: true },
  ];
  await upsertBatch('exercises', builtins);
  console.log(`  ✅ Seeded ${builtins.length} built-in exercises`);
}

// ──────────────────────────────────────────
// 2. Foods
// ──────────────────────────────────────────
async function seedFoods() {
  console.log('\n🍎 Seeding food database...');

  const existing = await supabaseGet('foods?select=id&limit=1');
  if (existing.length > 0) {
    const count = await supabaseGet('foods?select=id');
    if (count.length >= 50) {
      console.log(`  ✅ Already have ${count.length} foods, skipping.`);
      return;
    }
  }

  // Normalise all rows to the same key set so PostgREST doesn't complain about mismatched keys (PGRST102)
  const BASE_FOOD = { name_urdu: null, name_roman_urdu: null, brand: null };

  const foods = [
    // Proteins
    { ...BASE_FOOD, name: 'Chicken Breast', category: 'protein', serving_size_g: 100, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sodium_mg: 74, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Salmon', category: 'protein', serving_size_g: 100, calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, fiber_g: 0, sodium_mg: 59, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Eggs (Whole)', category: 'protein', serving_size_g: 50, calories: 72, protein_g: 6, carbs_g: 0.4, fat_g: 5, fiber_g: 0, sodium_mg: 71, sugar_g: 0.2, is_verified: true },
    { ...BASE_FOOD, name: 'Egg White', category: 'protein', serving_size_g: 30, calories: 17, protein_g: 3.6, carbs_g: 0.2, fat_g: 0.1, fiber_g: 0, sodium_mg: 55, sugar_g: 0.2, is_verified: true },
    { ...BASE_FOOD, name: 'Tuna (Canned in Water)', category: 'protein', serving_size_g: 100, calories: 116, protein_g: 26, carbs_g: 0, fat_g: 1, fiber_g: 0, sodium_mg: 333, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Ground Beef (90/10)', category: 'protein', serving_size_g: 100, calories: 176, protein_g: 20, carbs_g: 0, fat_g: 10, fiber_g: 0, sodium_mg: 70, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Turkey Breast', category: 'protein', serving_size_g: 100, calories: 135, protein_g: 29, carbs_g: 0, fat_g: 1, fiber_g: 0, sodium_mg: 70, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Greek Yogurt (Non-fat)', category: 'dairy', serving_size_g: 170, calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, fiber_g: 0, sodium_mg: 65, sugar_g: 6, is_verified: true },
    { ...BASE_FOOD, name: 'Cottage Cheese (Low-fat)', category: 'dairy', serving_size_g: 113, calories: 90, protein_g: 12, carbs_g: 5, fat_g: 2, fiber_g: 0, sodium_mg: 310, sugar_g: 4, is_verified: true },
    { ...BASE_FOOD, name: 'Whey Protein Powder', category: 'supplement', serving_size_g: 30, calories: 120, protein_g: 25, carbs_g: 3, fat_g: 1.5, fiber_g: 0, sodium_mg: 130, sugar_g: 2, is_verified: true },
    // Carbohydrates
    { ...BASE_FOOD, name: 'White Rice (Cooked)', category: 'grain', serving_size_g: 186, calories: 242, protein_g: 4.4, carbs_g: 53, fat_g: 0.4, fiber_g: 0.6, sodium_mg: 0, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Brown Rice (Cooked)', category: 'grain', serving_size_g: 195, calories: 215, protein_g: 5, carbs_g: 45, fat_g: 1.8, fiber_g: 3.5, sodium_mg: 0, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Oats (Dry)', category: 'grain', serving_size_g: 40, calories: 148, protein_g: 6, carbs_g: 27, fat_g: 2.5, fiber_g: 4, sodium_mg: 0, sugar_g: 0.5, is_verified: true },
    { ...BASE_FOOD, name: 'Sweet Potato', category: 'vegetable', serving_size_g: 130, calories: 112, protein_g: 2, carbs_g: 26, fat_g: 0.1, fiber_g: 3.8, sodium_mg: 72, sugar_g: 5.4, is_verified: true },
    { ...BASE_FOOD, name: 'Pasta (Cooked)', category: 'grain', serving_size_g: 140, calories: 220, protein_g: 8, carbs_g: 43, fat_g: 1.3, fiber_g: 2.5, sodium_mg: 1, sugar_g: 0.6, is_verified: true },
    { ...BASE_FOOD, name: 'Whole Wheat Bread', category: 'grain', serving_size_g: 30, calories: 79, protein_g: 4, carbs_g: 15, fat_g: 1, fiber_g: 1.9, sodium_mg: 132, sugar_g: 1.4, is_verified: true },
    { ...BASE_FOOD, name: 'Banana', category: 'fruit', serving_size_g: 118, calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, sodium_mg: 1, sugar_g: 14, is_verified: true },
    { ...BASE_FOOD, name: 'Apple', category: 'fruit', serving_size_g: 182, calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, sodium_mg: 2, sugar_g: 19, is_verified: true },
    { ...BASE_FOOD, name: 'Quinoa (Cooked)', category: 'grain', serving_size_g: 185, calories: 222, protein_g: 8, carbs_g: 39, fat_g: 3.5, fiber_g: 5, sodium_mg: 13, sugar_g: 1.6, is_verified: true },
    { ...BASE_FOOD, name: 'Blueberries', category: 'fruit', serving_size_g: 148, calories: 84, protein_g: 1.1, carbs_g: 21, fat_g: 0.5, fiber_g: 3.6, sodium_mg: 1, sugar_g: 15, is_verified: true },
    // Fats
    { ...BASE_FOOD, name: 'Avocado', category: 'fat', serving_size_g: 150, calories: 240, protein_g: 3, carbs_g: 13, fat_g: 22, fiber_g: 10, sodium_mg: 11, sugar_g: 1, is_verified: true },
    { ...BASE_FOOD, name: 'Almonds', category: 'nut', serving_size_g: 28, calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14, fiber_g: 3.5, sodium_mg: 0, sugar_g: 1.2, is_verified: true },
    { ...BASE_FOOD, name: 'Olive Oil', category: 'fat', serving_size_g: 14, calories: 119, protein_g: 0, carbs_g: 0, fat_g: 14, fiber_g: 0, sodium_mg: 0, sugar_g: 0, is_verified: true },
    { ...BASE_FOOD, name: 'Peanut Butter (Natural)', category: 'nut', serving_size_g: 32, calories: 190, protein_g: 8, carbs_g: 7, fat_g: 16, fiber_g: 2, sodium_mg: 75, sugar_g: 3, is_verified: true },
    { ...BASE_FOOD, name: 'Walnuts', category: 'nut', serving_size_g: 28, calories: 185, protein_g: 4.3, carbs_g: 3.9, fat_g: 18.5, fiber_g: 1.9, sodium_mg: 1, sugar_g: 0.7, is_verified: true },
    // Vegetables
    { ...BASE_FOOD, name: 'Broccoli', category: 'vegetable', serving_size_g: 148, calories: 50, protein_g: 4.2, carbs_g: 10, fat_g: 0.6, fiber_g: 3.8, sodium_mg: 60, sugar_g: 2.6, is_verified: true },
    { ...BASE_FOOD, name: 'Spinach', category: 'vegetable', serving_size_g: 30, calories: 7, protein_g: 0.9, carbs_g: 1.1, fat_g: 0.1, fiber_g: 0.7, sodium_mg: 24, sugar_g: 0.1, is_verified: true },
    { ...BASE_FOOD, name: 'Mixed Greens', category: 'vegetable', serving_size_g: 85, calories: 20, protein_g: 2, carbs_g: 3, fat_g: 0.3, fiber_g: 2, sodium_mg: 60, sugar_g: 1, is_verified: true },
    { ...BASE_FOOD, name: 'Bell Pepper', category: 'vegetable', serving_size_g: 119, calories: 37, protein_g: 1.2, carbs_g: 7.2, fat_g: 0.4, fiber_g: 2.5, sodium_mg: 5, sugar_g: 5, is_verified: true },
    // Dairy
    { ...BASE_FOOD, name: 'Milk (2%)', category: 'dairy', serving_size_g: 244, calories: 122, protein_g: 8, carbs_g: 12, fat_g: 5, fiber_g: 0, sodium_mg: 115, sugar_g: 12, is_verified: true },
    { ...BASE_FOOD, name: 'Cheddar Cheese', category: 'dairy', serving_size_g: 28, calories: 113, protein_g: 7, carbs_g: 0.4, fat_g: 9.3, fiber_g: 0, sodium_mg: 185, sugar_g: 0.1, is_verified: true },
    // South Asian / Pakistani foods
    { ...BASE_FOOD, name: 'Chapati (Roti)', name_roman_urdu: 'Roti', category: 'grain', serving_size_g: 52, calories: 145, protein_g: 4, carbs_g: 31, fat_g: 0.8, fiber_g: 2.5, sodium_mg: 270, sugar_g: 0.5, is_verified: true },
    { ...BASE_FOOD, name: 'Dal (Lentil Curry)', name_roman_urdu: 'Dal', category: 'legume', serving_size_g: 200, calories: 220, protein_g: 14, carbs_g: 36, fat_g: 2, fiber_g: 8, sodium_mg: 400, sugar_g: 3, is_verified: true },
    { ...BASE_FOOD, name: 'Chicken Karahi', name_roman_urdu: 'Karahi', category: 'protein', serving_size_g: 200, calories: 310, protein_g: 28, carbs_g: 6, fat_g: 19, fiber_g: 1, sodium_mg: 520, sugar_g: 4, is_verified: true },
    { ...BASE_FOOD, name: 'Biryani (Chicken)', name_roman_urdu: 'Biryani', category: 'grain', serving_size_g: 300, calories: 460, protein_g: 25, carbs_g: 58, fat_g: 12, fiber_g: 2, sodium_mg: 680, sugar_g: 3, is_verified: true },
    { ...BASE_FOOD, name: 'Paratha', name_roman_urdu: 'Paratha', category: 'grain', serving_size_g: 80, calories: 260, protein_g: 5, carbs_g: 35, fat_g: 11, fiber_g: 2, sodium_mg: 330, sugar_g: 1, is_verified: true },
    { ...BASE_FOOD, name: 'Dahi (Plain Yogurt)', name_roman_urdu: 'Dahi', category: 'dairy', serving_size_g: 150, calories: 90, protein_g: 5, carbs_g: 7, fat_g: 4, fiber_g: 0, sodium_mg: 50, sugar_g: 7, is_verified: true },
    { ...BASE_FOOD, name: 'Saag', name_roman_urdu: 'Saag', category: 'vegetable', serving_size_g: 200, calories: 130, protein_g: 7, carbs_g: 14, fat_g: 5, fiber_g: 5, sodium_mg: 300, sugar_g: 2, is_verified: true },
    { ...BASE_FOOD, name: 'Nihari', name_roman_urdu: 'Nihari', category: 'protein', serving_size_g: 250, calories: 380, protein_g: 30, carbs_g: 10, fat_g: 24, fiber_g: 1, sodium_mg: 700, sugar_g: 2, is_verified: true },
    { ...BASE_FOOD, name: 'Chickpeas (Chana)', name_roman_urdu: 'Chana', category: 'legume', serving_size_g: 164, calories: 268, protein_g: 14.5, carbs_g: 45, fat_g: 4.2, fiber_g: 12.5, sodium_mg: 11, sugar_g: 8, is_verified: true },
    // Beverages
    { ...BASE_FOOD, name: 'Whole Milk', category: 'dairy', serving_size_g: 244, calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8, fiber_g: 0, sodium_mg: 105, sugar_g: 12, is_verified: true },
    { ...BASE_FOOD, name: 'Orange Juice', category: 'beverage', serving_size_g: 248, calories: 112, protein_g: 1.7, carbs_g: 26, fat_g: 0.5, fiber_g: 0.5, sodium_mg: 2, sugar_g: 21, is_verified: true },
    { ...BASE_FOOD, name: 'Protein Shake (Water)', category: 'supplement', serving_size_g: 400, calories: 130, protein_g: 26, carbs_g: 5, fat_g: 1.5, fiber_g: 0, sodium_mg: 140, sugar_g: 3, is_verified: true },
  ];

  await upsertBatch('foods', foods);
  console.log(`  ✅ Seeded ${foods.length} foods`);
}

// ──────────────────────────────────────────
// 3. Badges
// ──────────────────────────────────────────
async function seedBadges() {
  console.log('\n🏆 Seeding badges...');

  const existing = await supabaseGet('badges?select=id&limit=1');
  if (existing.length > 0) {
    console.log('  ✅ Badges already exist, skipping.');
    return;
  }

  const badges = [
    { code: 'first_workout', name: 'First Sweat', description: 'Complete your very first workout', icon: '💪', criteria_json: { event: 'workout_complete', count: 1 } },
    { code: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', criteria_json: { event: 'streak', value: 7 } },
    { code: 'streak_30', name: 'Iron Discipline', description: '30-day streak achieved', icon: '⚡', criteria_json: { event: 'streak', value: 30 } },
    { code: 'streak_100', name: 'Centurion', description: '100-day streak — legendary', icon: '🛡️', criteria_json: { event: 'streak', value: 100 } },
    { code: 'first_pr', name: 'Personal Best', description: 'Set your first personal record', icon: '🎯', criteria_json: { event: 'pr_broken', count: 1 } },
    { code: 'pr_5', name: 'Record Breaker', description: 'Break 5 personal records', icon: '🥇', criteria_json: { event: 'pr_broken', count: 5 } },
    { code: 'workout_10', name: 'Getting Serious', description: 'Complete 10 workouts', icon: '🏋️', criteria_json: { event: 'workout_complete', count: 10 } },
    { code: 'workout_50', name: 'Dedicated Athlete', description: 'Complete 50 workouts', icon: '🦾', criteria_json: { event: 'workout_complete', count: 50 } },
    { code: 'workout_100', name: 'Elite Performer', description: 'Complete 100 workouts', icon: '🏆', criteria_json: { event: 'workout_complete', count: 100 } },
    { code: 'calorie_goal_7', name: 'Nutrition Streak', description: 'Hit calorie goal 7 days in a row', icon: '🥗', criteria_json: { event: 'calorie_goal', streak: 7 } },
    { code: 'water_goal_7', name: 'Hydration Hero', description: 'Hit water goal 7 days in a row', icon: '💧', criteria_json: { event: 'water_goal', streak: 7 } },
    { code: 'xp_1000', name: 'Rising Star', description: 'Earn 1,000 XP', icon: '⭐', criteria_json: { event: 'xp_total', value: 1000 } },
    { code: 'xp_10000', name: 'Legendary', description: 'Earn 10,000 XP', icon: '👑', criteria_json: { event: 'xp_total', value: 10000 } },
    { code: 'early_bird', name: 'Early Bird', description: 'Complete a workout before 7 AM', icon: '🌅', criteria_json: { event: 'workout_time', hour_lt: 7 } },
    { code: 'night_owl', name: 'Night Owl', description: 'Complete a workout after 10 PM', icon: '🦉', criteria_json: { event: 'workout_time', hour_gte: 22 } },
  ];

  await upsertBatch('badges', badges);
  console.log(`  ✅ Seeded ${badges.length} badges`);
}

// ──────────────────────────────────────────
// 4. Storage Buckets
// ──────────────────────────────────────────
async function createStorageBuckets() {
  console.log('\n🪣 Creating storage buckets...');

  const buckets = [
    { id: 'progress-photos', name: 'progress-photos', public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    { id: 'profile-avatars', name: 'profile-avatars', public: true,  fileSizeLimit: 5242880,  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    { id: 'meal-photos',     name: 'meal-photos',     public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    { id: 'workout-videos',  name: 'workout-videos',  public: false, fileSizeLimit: null, allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
  ];

  for (const bucket of buckets) {
    try {
      const bucketBody = {
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
        allowed_mime_types: bucket.allowedMimeTypes,
      };
      // Only set file_size_limit if specified (avoid 413 on free plan for large values)
      if (bucket.fileSizeLimit) {
        bucketBody.file_size_limit = bucket.fileSizeLimit;
      }
      const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify(bucketBody),
      });

      if (res.status === 409 || res.status === 422) {
        console.log(`  ✅ Bucket '${bucket.name}' already exists`);
      } else if (res.ok) {
        console.log(`  ✅ Created bucket '${bucket.name}'`);
      } else {
        const text = await res.text();
        console.warn(`  ⚠️  Bucket '${bucket.name}': ${res.status} ${text}`);
      }
    } catch (e) {
      console.warn(`  ⚠️  Bucket '${bucket.name}': ${e.message}`);
    }
  }
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
async function main() {
  console.log('\n🚀 ATHLEO Backend Seed\n');
  console.log('   URL:', SUPABASE_URL);
  console.log('   Key: ***' + SERVICE_KEY.slice(-6));

  try {
    await deleteLegacyExerciseCatalog();
    await seedExercises();
    await seedFoods();
    await seedBadges();
    await createStorageBuckets();

    console.log('\n✅ Seeding complete!\n');
    console.log('Next steps:');
    console.log('  1. Deploy edge functions:');
    console.log('     npx supabase functions deploy --project-ref hdnssncxdoqcgcyouhxh');
    console.log('  2. Run validation:');
    console.log('     npm run test-backend\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  }
}

main();
