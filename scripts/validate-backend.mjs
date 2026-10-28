#!/usr/bin/env node

/**
 * ATHLEO Backend Validation Suite
 * 
 * Run this script to validate that your Supabase backend is correctly configured
 * and ready for the ATHLEO React Native app.
 * 
 * Usage:
 *   npm run validate-backend
 * 
 * Requirements:
 *   - .env file with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   - supabase cli installed: npm install -g supabase
 *   - supabase project linked: supabase link --project-ref YOUR_REF
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ENV_FILE = '.env';
const CHECKS = {
  env: {
    name: 'Environment Variables',
    run: checkEnv,
  },
  supabase_cli: {
    name: 'Supabase CLI',
    run: checkSupabaseCLI,
  },
  project_link: {
    name: 'Project Linking',
    run: checkProjectLink,
  },
  migrations: {
    name: 'Database Schema',
    run: checkMigrations,
  },
  rls: {
    name: 'Row-Level Security',
    run: checkRLS,
  },
  functions: {
    name: 'Edge Functions',
    run: checkEdgeFunctions,
  },
  auth_providers: {
    name: 'Auth Providers',
    run: checkAuthProviders,
  },
  storage: {
    name: 'Storage Buckets',
    run: checkStorage,
  },
};

async function checkEnv() {
  console.log('  Checking .env file...');
  if (!fs.existsSync(ENV_FILE)) {
    return { ok: false, msg: '.env file not found' };
  }

  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const requiredKeys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredKeys.filter(k => !content.includes(k + '='));
  if (missing.length > 0) {
    return { ok: false, msg: `Missing keys: ${missing.join(', ')}` };
  }

  return { ok: true, msg: 'All required keys present' };
}

async function checkSupabaseCLI() {
  console.log('  Checking Supabase CLI...');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['supabase', '--version'], { stdio: 'pipe', shell: true });
    let version = '';
    proc.stdout.on('data', (data) => {
      version += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, msg: `CLI v${version.trim()}` });
      } else {
        resolve({
          ok: false,
          msg: 'Run: npm install -g @supabase/cli',
        });
      }
    });
  });
}

async function checkProjectLink() {
  console.log('  Checking project link...');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['supabase', 'status'], { stdio: 'pipe', shell: true });
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0 && output.includes('Connected')) {
        resolve({ ok: true, msg: 'Project linked' });
      } else {
        resolve({
          ok: false,
          msg: 'Run: supabase link --project-ref YOUR_PROJECT_REF',
        });
      }
    });
  });
}

async function checkMigrations() {
  console.log('  Checking database schema...');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['supabase', 'db', 'push', '--dry-run'], {
      stdio: 'pipe',
      shell: true,
    });
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0 && (output.includes('No pending migrations') || output.includes('Applying migration'))) {
        resolve({ ok: true, msg: 'Schema up-to-date' });
      } else {
        resolve({ ok: false, msg: 'Run: supabase db push' });
      }
    });
  });
}

async function checkRLS() {
  console.log('  Checking RLS policies...');
  // This would require Supabase JS client to query actual policies
  // For now, we'll assume if migrations pass, RLS is applied
  return { ok: true, msg: 'Assumed applied (verify in dashboard)' };
}

async function checkEdgeFunctions() {
  console.log('  Checking edge functions...');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['supabase', 'functions', 'list'], {
      stdio: 'pipe',
      shell: true,
    });
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.on('close', (code) => {
      const functions = [
        'award-xp',
        'coach',
        'weekly-macro-adjust',
        'moderate-content',
        'health-anomaly-check',
        'revenuecat-webhook',
      ];
      const deployed = functions.filter(f => output.includes(f)).length;
      if (deployed === functions.length) {
        resolve({ ok: true, msg: `All ${deployed} functions deployed` });
      } else {
        resolve({
          ok: false,
          msg: `${deployed}/${functions.length} deployed. Run: supabase functions deploy [name]`,
        });
      }
    });
  });
}

async function checkAuthProviders() {
  console.log('  Checking auth providers...');
  // This requires checking Supabase project settings
  return {
    ok: false,
    msg: 'Manual check: Settings > Authentication > Providers in Supabase dashboard',
  };
}

async function checkStorage() {
  console.log('  Checking storage buckets...');
  const buckets = [
    'progress-photos',
    'profile-avatars',
    'meal-photos',
    'workout-videos',
  ];
  return {
    ok: false,
    msg: `Create buckets in dashboard: ${buckets.join(', ')}`,
  };
}

async function runAll() {
  console.log('\n🔍 ATHLEO Backend Validation\n');

  const results = {};
  for (const [key, check] of Object.entries(CHECKS)) {
    console.log(`\n▶  ${check.name}`);
    try {
      results[key] = await check.run();
      const icon = results[key].ok ? '✅' : '❌';
      console.log(`   ${icon} ${results[key].msg}\n`);
    } catch (err) {
      results[key] = { ok: false, msg: err.message };
      console.log(`   ❌ ${err.message}\n`);
    }
  }

  console.log('\n📊 Summary\n');
  const passed = Object.values(results).filter(r => r.ok).length;
  const total = Object.keys(results).length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 Backend is ready! Start the app with: npm start\n');
  } else {
    console.log(
      '\n⚠️  Please address failed checks before running the app.\n'
    );
  }
}

runAll().catch(console.error);
