import {Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {appStorage} from './storage';

// ─── Embedded Gemini API Key ──────────────────────────────────────────────────
// Powers the online Athleo AI Coach.
// Internet ON  → Real Gemini cloud AI (intelligent, personalised)
// Internet OFF → Built-in offline sports science engine (instant, <50ms)
const ATHLEO_GEMINI_KEY = 'AIzaSyDDzFbHCHAyoFjOUaTGyvXxcCT-XMvkIJA';

export type CoachContext = {
  goal?: string;
  user_name?: string;
  user_goals?: string;
  recent_activity?: string;
  today?: string;
  past_notes?: string;
  language?: string;
  [key: string]: string | undefined;
};

export type CoachReplyResponse = {
  reply: string;
};

// ─── Gemini & Athleo AI API Config ───────────────────────────────────────────
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const STORAGE_KEY = 'athleo_gemini_api_key';

/**
 * Returns true if the device currently has an active internet connection.
 * This drives the routing decision: Gemini cloud AI vs offline sports science engine.
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Generates a unique Athleo AI key for the user's account.
 * Format: athleo-ai-[seed]-[timestamp]-[randomHash]
 */
export function generateUserApiKey(userIdOrEmail?: string): string {
  const seed = userIdOrEmail
    ? userIdOrEmail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()
    : 'user';
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `athleo-ai-${seed}-${timestamp}-${randomPart}`;
}

/**
 * Ensures an active session key is stored (used for account management only).
 */
export function ensureGeminiApiKey(userIdOrEmail?: string): string {
  const existing = appStorage.getString(STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }
  const autoKey = generateUserApiKey(userIdOrEmail);
  appStorage.setString(STORAGE_KEY, autoKey);
  return autoKey;
}

// Keep these exports for backward compatibility
let _geminiApiKey: string | null = null;

export function setGeminiApiKey(key: string) {
  const trimmed = key.trim() || null;
  _geminiApiKey = trimmed;
  if (trimmed) {
    appStorage.setString(STORAGE_KEY, trimmed);
  }
}

export function getGeminiApiKey(): string | null {
  return ATHLEO_GEMINI_KEY; // Always available
}

// ─── Gemini Cloud REST call ───────────────────────────────────────────────────
async function askGemini(message: string, context: CoachContext): Promise<string> {
  const apiKey = ATHLEO_GEMINI_KEY;

  const langNote =
    context.language === 'ur'
      ? 'Reply in Urdu language only. Roman Urdu is acceptable where helpful.'
      : 'Reply in clear, motivational English.';

  const systemPrompt = [
    `You are Athleo Coach, an elite personal trainer and sports nutritionist embedded in the Athleo fitness app.`,
    `User goal: ${context.user_goals || 'general fitness'}.`,
    `Today: ${context.today || new Date().toISOString().slice(0, 10)}.`,
    `User name: ${context.user_name || 'Athlete'}.`,
    langNote,
    `Be concise (max 200 words), practical, science-backed, and highly motivating.`,
    `If asked for a workout or diet plan, always include sets, reps, and macros where applicable.`,
  ].join(' ');

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {text: `${systemPrompt}\n\nUser: ${message}`},
        ],
      },
    ],
    generationConfig: {
      temperature: 0.78,
      maxOutputTokens: 350,
    },
  };

  const controller = new AbortController();
  // 8s timeout — generous enough for cloud AI
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`gemini_error_${response.status}`);
    }

    const data = await response.json();

    if (data?.error) {
      throw new Error(
        'gemini_api_error: ' +
          (data.error.message || JSON.stringify(data.error)),
      );
    }

    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error(
        'empty_gemini_response: ' + JSON.stringify(data).slice(0, 200),
      );
    }
    return text.trim();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── Offline Sports Intelligence Engine ──────────────────────────────────────
const OFFLINE_KNOWLEDGE_EN: Record<string, string> = {
  muscle:
    `**Muscle Building Plan (Hypertrophy)**\n\n` +
    `🏋️ **Split:** Push/Pull/Legs – 5 days/week\n` +
    `📊 **Weekly Volume:** 12–20 sets per muscle group\n\n` +
    `**Monday – Push (Chest/Shoulders/Triceps)**\n` +
    `• Barbell Bench Press: 4×6–8 reps @ 80% 1RM\n` +
    `• Incline Dumbbell Press: 3×10–12\n` +
    `• Overhead Press: 3×8–10\n` +
    `• Lateral Raises: 3×15\n` +
    `• Tricep Pushdowns: 3×12\n\n` +
    `🥩 **Macros:** 2.2g protein/kg BW · 5g carbs/kg · 1g fat/kg\n` +
    `💊 **Creatine:** 3–5g/day · Sleep 7–9h · Progressive overload is key.`,

  fat:
    `**Fat Loss Protocol (Athleo Method)**\n\n` +
    `🔥 **Deficit:** 400–500 kcal below TDEE\n` +
    `💪 **Training:** 4× weight sessions + 2× LISS cardio (35 min)\n\n` +
    `**Full-Body Circuit (3×/week):**\n` +
    `• Goblet Squats 4×15\n` +
    `• Push-ups 3×Max\n` +
    `• Dumbbell Rows 3×12 each side\n` +
    `• Hip Thrusts 4×15\n` +
    `• Plank 3×45s\n\n` +
    `🥗 **Nutrition:** High protein (2.4g/kg) · Fibre 30g/day\n` +
    `Avoid liquid calories. Eat in a 8-hour window for best results.`,

  endurance:
    `**Endurance Training Plan (12-Week Base Build)**\n\n` +
    `🏃 **Week 1–4:** Zone 2 runs 3×/week (30–45 min @ 60–70% max HR)\n` +
    `**Week 5–8:** +20% weekly volume · Add tempo runs 1×/week\n` +
    `**Week 9–12:** Race-pace intervals 1×/week · Long run 90–120 min\n\n` +
    `**Core Workouts:** Plank, Dead Bug, Copenhagen planks – 3× weekly\n\n` +
    `🥤 **Fuelling:** 60g carbs/hr during runs >60 min\n` +
    `Sleep 8h · Iron & Vitamin D – track levels quarterly.`,

  diet:
    `**Personalised Diet Plan (Athleo Nutrition)**\n\n` +
    `🎯 **Macros Baseline:**\n` +
    `• Protein: 2.0–2.4g per kg bodyweight\n` +
    `• Carbohydrates: 3–5g per kg (training days)\n` +
    `• Fats: 0.8–1.2g per kg\n\n` +
    `**Meal Structure (3,000 kcal example):**\n` +
    `🍳 Breakfast: 5 eggs + oats + banana — 650 kcal\n` +
    `🍗 Lunch: 200g chicken + 300g rice + veggies — 850 kcal\n` +
    `🥜 Pre-Workout: Greek yoghurt + nuts + apple — 400 kcal\n` +
    `🍖 Dinner: 200g salmon + sweet potato + broccoli — 750 kcal\n` +
    `🥛 Snack: Protein shake + banana — 350 kcal\n\n` +
    `💧 Hydration: 35ml per kg bodyweight daily.`,

  gym:
    `**Gym Workout Plan — Intermediate (PPL Split)**\n\n` +
    `**Monday — Push:**\n` +
    `• Bench Press 4×5 (strength)\n` +
    `• Incline DB Press 3×10\n` +
    `• Shoulder Press 3×10\n` +
    `• Lateral Raise 4×15 · Cable Fly 3×12\n\n` +
    `**Wednesday — Pull:**\n` +
    `• Deadlift 4×5\n` +
    `• Weighted Pull-Ups 3×8\n` +
    `• Barbell Rows 3×8\n` +
    `• Face Pulls 3×15 · Hammer Curls 3×12\n\n` +
    `**Friday — Legs:**\n` +
    `• Squat 4×6\n` +
    `• Romanian Deadlift 3×10\n` +
    `• Leg Press 3×15 · Calf Raises 4×20\n\n` +
    `Rest 2–3 min between compound sets.`,

  subscription:
    `**Athleo Membership Plans 🏆**\n\n` +
    `**🆓 Free** — Basic workout logs, nutrition basics, AI guidance\n\n` +
    `**⭐ Pro — £19/month**\n` +
    `✅ Personalised training plans\n` +
    `✅ Meal planning with macros\n` +
    `✅ GPS outdoor run maps\n` +
    `✅ Progress photo vault\n` +
    `✅ Full AI Coach access\n\n` +
    `**💎 Elite — £39/month**\n` +
    `✅ Everything in Pro\n` +
    `✅ Advanced recovery & HRV analytics\n` +
    `✅ Smart Gym AI auto-programming\n` +
    `✅ VIP priority coach support\n` +
    `✅ Biometric performance tracking\n\n` +
    `Start with a 7-day free trial of Pro. No credit card needed.`,

  recovery:
    `**Recovery & Rest Protocol**\n\n` +
    `😴 **Sleep:** 7–9 hours with consistent sleep time\n` +
    `🧊 **Cold Therapy:** 10–15 min cold shower post-session\n` +
    `🧘 **Active Recovery:** Yoga / light walking 20–30 min on rest days\n` +
    `💆 **Foam Rolling:** 10 min targeting glutes, quads, thoracic spine\n\n` +
    `**Key Supplements:**\n` +
    `• Magnesium Glycinate 300mg before bed\n` +
    `• Vitamin D3 2000–4000 IU/day\n` +
    `• Omega-3 1–2g EPA+DHA/day\n\n` +
    `HRV > 60ms = train hard. HRV 40–60ms = moderate. < 40ms = recovery day only.`,

  protein:
    `**High Protein Meal Plan (Athleo)**\n\n` +
    `Target: **2.0–2.2g protein per kg bodyweight**\n\n` +
    `🍳 **Breakfast:** 5 egg whites + 2 whole eggs + oats + Greek yoghurt — 50g\n` +
    `🍗 **Lunch:** 220g grilled chicken breast + quinoa / brown rice + broccoli — 60g\n` +
    `🥛 **Post-Workout:** 1.5 scoops whey isolate + banana + almond milk — 40g\n` +
    `🍖 **Dinner:** 200g lean beef or salmon + sweet potato + asparagus — 55g\n\n` +
    `💡 **Coach Tip:** Distribute protein across 4–5 meals (30–50g per meal) for continuous muscle protein synthesis.`,

  arms:
    `**Arm Growth Protocol (Biceps & Triceps Hypertrophy)**\n\n` +
    `💪 **Frequency:** 2× per week (Triceps represent 60% of total arm volume!)\n\n` +
    `**Biceps (Peak & Thickness):**\n` +
    `• Incline Dumbbell Curls: 3×10–12 (Full stretch on long head)\n` +
    `• Barbell / EZ-Bar Curls: 3×8–10 (Progressive overload)\n` +
    `• Cross-Body Hammer Curls: 3×12–15 (Brachialis for arm thickness)\n\n` +
    `**Triceps (Horseshoe Development):**\n` +
    `• Cable Rope Pushdowns: 4×12–15 (Squeeze at bottom)\n` +
    `• Skull Crushers (EZ-bar): 3×10–12 (Long head stretch)\n` +
    `• Close-Grip Bench Press or Dips: 3×8–10 (Heavy compound mass)`,

  chest:
    `**Complete Chest Architect Plan**\n\n` +
    `🛡️ **Focus:** Upper clavicular head + sternal mid-chest\n\n` +
    `• Incline Dumbbell Press (30° angle): 4×8–10 reps @ RPE 8\n` +
    `• Flat Barbell Bench Press: 3×6–8 reps (Strength foundation)\n` +
    `• Standing Cable Flyes: 3×12–15 (Full stretch + peak contraction hold 2s)\n` +
    `• Weighted Dips / Push-ups: 3×Failure (Burnout finisher)\n\n` +
    `💡 **Form Tip:** Retract your scapulae (pinch shoulder blades together) to take your front delts out of the movement.`,

  back:
    `**V-Taper Back Protocol**\n\n` +
    `🦅 **Focus:** Lat width + upper-back & erector spinal density\n\n` +
    `• Pull-ups / Lat Pulldowns: 4×8–10 (Lead with elbows, pull to upper chest)\n` +
    `• Chest-Supported T-Bar / DB Rows: 3×10–12 (Elbows flared 45° for upper back)\n` +
    `• Single-Arm Dumbbell Row: 3×10 (Deep lat stretch at bottom)\n` +
    `• Conventional Deadlift: 3×5 (Total posterior chain power)\n` +
    `• Face Pulls: 3×15 (Rear delts & rotator cuff longevity)`,

  legs:
    `**Quad & Hamstring Hypertrophy Plan**\n\n` +
    `🦵 **Frequency:** 2× weekly (Leg Day 1: Quad focus · Leg Day 2: Hamstring/Glute focus)\n\n` +
    `• Barbell Back Squats: 4×6–8 (Deep below parallel)\n` +
    `• Romanian Deadlifts (RDL): 4×8–10 (Hinge at hips, huge hamstring stretch)\n` +
    `• Leg Press (Feet shoulder-width): 3×12–15\n` +
    `• Walking Dumbbell Lunges: 3×12 per leg\n` +
    `• Standing / Seated Calf Raises: 4×15–20 (Pause 2s at bottom)`,

  abs:
    `**Core & Six-Pack Protocol**\n\n` +
    `🎯 **Truth:** Visible abs are made in the kitchen (sub-12% body fat for men, sub-20% for women).\n\n` +
    `**Athleo Direct Core Routine (3×/week):**\n` +
    `• Hanging Leg Raises: 3×12–15 (Roll pelvis up, don't just swing legs)\n` +
    `• Cable Rope Woodchoppers: 3×15 each side (Oblique rotation)\n` +
    `• Ab Wheel Rollouts: 3×10–12 (Maximum anti-extension strength)\n` +
    `• RKC Plank: 3×30s (Maximum full-body squeeze)`,

  supplements:
    `**Athleo Science-Backed Supplement Stack**\n\n` +
    `⭐ **Tier 1 (Proven by Gold-Standard Meta-Analyses):**\n` +
    `1. **Creatine Monohydrate:** 5g daily (Boosts ATP, strength +10%, muscle fullness). No loading phase needed.\n` +
    `2. **Whey Protein Isolate:** 1–2 scoops/day to hit total protein goal.\n` +
    `3. **Vitamin D3 (2,000–4,000 IU) + K2:** Hormonal & bone health.\n` +
    `4. **Omega-3 Fish Oil (2g EPA/DHA):** Heart health & joint inflammation.\n\n` +
    `☕ **Optional:** Caffeine / Pre-workout (200mg 30 min before training).`,

  greeting:
    `👋 Hello! I'm your Athleo AI Coach! 💪\n\n` +
    `Your account is fully connected with real-time sports science intelligence.\n\n` +
    `What are we crushing today? Tell me:\n` +
    `• Your main goal (Muscle, Fat Loss, Endurance)\n` +
    `• A specific muscle you want to grow (Chest, Arms, Legs, Back, Abs)\n` +
    `• Or ask for a personalized meal / diet plan!`,
};

const OFFLINE_KNOWLEDGE_UR: Record<string, string> = {
  muscle:
    `**پٹھوں کی تعمیر کا پلان (ہائپرٹروفی)**\n\n` +
    `Push/Pull/Legs split – ہفتے میں 5 دن\n\n` +
    `**پیر – Push (سینہ/کندھے/ٹرائیسپ):**\n` +
    `• Barbell Bench Press: 4×8 reps\n` +
    `• Overhead Press: 3×10\n` +
    `• Lateral Raises: 3×15\n` +
    `• Tricep Pushdowns: 3×12\n\n` +
    `🥩 **Macros:** ہر کلو وزن کے لیے 2.2g پروٹین، 5g carbs، 1g fat\n` +
    `Creatine 5g روزانہ لیں۔ نیند 7-9 گھنٹے لازمی ہے۔`,

  arms:
    `**بائیسپس اور ٹرائیسپس گروتھ پلان (Arms Workout)**\n\n` +
    `💪 **ہفتے میں 2 بار ٹرین کریں:**\n\n` +
    `**Biceps (ڈولے):**\n` +
    `• Incline DB Curls: 3×12 (مکمل کھنچاؤ کے ساتھ)\n` +
    `• Barbell Curls: 3×10 (بھاری وزن)\n` +
    `• Hammer Curls: 3×15 (بازو کی موٹائی کے لیے)\n\n` +
    `**Triceps:**\n` +
    `• Rope Pushdowns: 3×15\n` +
    `• Skull Crushers: 3×10\n` +
    `• Close Grip Bench / Dips: 3×8–10\n\n` +
    `پروٹین کی مقدار پوری رکھیں (1.8-2.2g فی کلو وزن)۔`,

  chest:
    `**سینے کا ورزش پلان (Chest Workout)**\n\n` +
    `🛡️ **پورا سینہ اور اپر چیسٹ:**\n` +
    `• Incline Dumbbell Press: 4×10 (اپر چیسٹ کے لیے بہترین)\n` +
    `• Flat Barbell Bench Press: 3×8\n` +
    `• Cable / DB Flyes: 3×15 (اچھی سٹریچ اور سکوییز)\n` +
    `• Dips یا Push-ups: 3×Max\n\n` +
    `کندھوں کو پیچھے کی طرف لاک رکھیں تاکہ پورا زور سینے پر آئے۔`,

  back:
    `**بیک اور چوڑائی کا پلان (V-Taper Back)**\n\n` +
    `🦅 **بیک ورزش:**\n` +
    `• Pull-ups / Lat Pulldown: 4×10 (کہنیوں سے نیچے کھینچیں)\n` +
    `• Barbell / DB Rows: 3×10\n` +
    `• Single Arm Row: 3×12\n` +
    `• Deadlift: 3×5 (پوری طاقت کے لیے)\n\n` +
    `کمر کو سیدھا رکھیں اور پیٹ کو ٹائٹ رکھیں۔`,

  legs:
    `**ٹانگوں کا ورزش پلان (Leg Day)**\n\n` +
    `🦵 **مضبوط ٹانگیں اور کواڈز:**\n` +
    `• Barbell Squats: 4×8\n` +
    `• Romanian Deadlift (RDL): 3×10 (ہیمسٹرنگز کے لیے)\n` +
    `• Leg Press: 3×15\n` +
    `• Walking Lunges: 3×12 فی ٹانگ\n` +
    `• Calf Raises: 4×20`,

  abs:
    `**Abs اور پیٹ کی چربی کم کرنے کا طریقہ**\n\n` +
    `🎯 **حقیقت:** ایبس کچن میں بنتے ہیں۔ کیلوری ڈیفیسٹ ضروری ہے تاکہ پیٹ کی چربی گھلے۔\n\n` +
    `**Core Workout (ہفتے میں 3 دن):**\n` +
    `• Hanging Leg Raises: 3×15\n` +
    `• Cable Woodchoppers: 3×15\n` +
    `• Plank: 3×45 سیکنڈ\n\n` +
    `میٹھے اور فرائیڈ کھانوں سے پرہیز کریں۔`,

  fat:
    `**چربی اور وزن کم کرنے کا Athleo پلان**\n\n` +
    `🔥 TDEE سے 400-500 kcal کم کھائیں\n` +
    `ہفتے میں 4 gym sessions + 2 cardio sessions (35 منٹ تیز چلنا)\n\n` +
    `**ورزش:**\n` +
    `• Squats 4×15\n` +
    `• Push-ups 3×Max\n` +
    `• Dumbbell Rows 3×12\n` +
    `• Plank 3×45s\n\n` +
    `🥗 زیادہ پروٹین اور سلاد کھائیں۔ میٹھے مشروبات بالکل بند کریں۔`,

  diet:
    `**Athleo خوراک اور ڈائیٹ پلان**\n\n` +
    `🎯 **Macros فی کلو وزن:**\n` +
    `• پروٹین: 2g\n` +
    `• Carbs: 3–4g\n` +
    `• Fat: 1g\n\n` +
    `🍳 **ناشتہ:** 4 انڈے + دلیہ + کیلا\n` +
    `🍗 **دوپہر:** چکن بریسٹ (200g) + چاول + ہری سبزی\n` +
    `🥛 **شام:** پروٹین شیک یا بادام اور دہی\n` +
    `🍖 **رات:** مچھلی یا بیف قیمہ + شکرقندی\n\n` +
    `💧 روزانہ 3 سے 4 لیٹر پانی لازمی پئیں۔`,

  supplements:
    `**ضروری سپلیمنٹس کی تفصیل**\n\n` +
    `1. **Creatine Monohydrate:** 5g روزانہ (طاقت اور پٹھوں کا سائز بڑھانے کے لیے نمبر 1 سپلیمنٹ)\n` +
    `2. **Whey Protein:** دن کا پروٹین ٹارگٹ پورا کرنے کے لیے 1-2 سکوپ\n` +
    `3. **Fish Oil (Omega-3):** جوڑوں اور دل کی صحت کے لیے\n` +
    `4. **Multivitamin / Vitamin D3:** روزانہ ایک گولی`,

  gym:
    `**جم ورک آوٹ پلان (PPL Split)**\n\n` +
    `**پیر – Push (سینہ، شولڈر، ٹرائیسپ)**\n` +
    `**منگل – Pull (کمر، بائیسپ)**\n` +
    `**بدھ – Legs (ٹانگیں، ایبس)**\n` +
    `**جمعرات – آرام**\n` +
    `**جمعہ – Upper Body**\n` +
    `**ہفتہ – Lower Body**\n\n` +
    `Compound exercises کے درمیان 2 منٹ آرام کریں۔`,

  subscription:
    `**Athleo Plans 🏆**\n\n` +
    `🆓 **Free** – بنیادی workout اور nutrition\n\n` +
    `⭐ **Pro – £19/ماہ:**\n` +
    `✅ ذاتی training plan\n✅ Meal planning\n✅ AI Coach\n\n` +
    `💎 **Elite – £39/ماہ:**\n` +
    `✅ سب کچھ Pro میں\n✅ HRV analytics\n✅ VIP support`,

  greeting:
    `👋 وعلیکم السلام / ہیلو! میں آپ کا Athleo AI Coach ہوں۔\n\n` +
    `آپ کا اکاؤنٹ AI کوچ کے ساتھ ایکٹو ہے۔ بتائیں آج آپ کا کیا ہدف ہے؟\n` +
    `• پٹھے اور ڈولے بڑھانے ہیں؟\n` +
    `• وزن اور چربی کم کرنی ہے؟\n` +
    `• ڈائیٹ یا جم ورک آوٹ پلان چاہیے؟`,
};

function getOfflineResponse(message: string, language: string): string {
  const msg = message.toLowerCase();

  const matchKey = (keywords: string[]): boolean =>
    keywords.some(kw => msg.includes(kw));

  const knowledge = language === 'ur' ? OFFLINE_KNOWLEDGE_UR : OFFLINE_KNOWLEDGE_EN;
  const fallbackLang = language === 'ur' ? OFFLINE_KNOWLEDGE_EN : {};

  let key: string | null = null;

  if (matchKey(['hi', 'hello', 'hey', 'salam', 'assalam', 'aoa', 'halo', 'kaisay', 'kaise', 'haal'])) {
    key = 'greeting';
  } else if (matchKey(['bicep', 'tricep', 'arm', 'dole', 'ڈولے', 'بازو'])) {
    key = 'arms';
  } else if (matchKey(['chest', 'pec', 'bench', 'سینہ', 'چیسٹ'])) {
    key = 'chest';
  } else if (matchKey(['back', 'lat', 'pullup', 'deadlift', 'کمر', 'بیک'])) {
    key = 'back';
  } else if (matchKey(['leg', 'squat', 'quad', 'hamstring', 'calf', 'ٹانگ'])) {
    key = 'legs';
  } else if (matchKey(['abs', 'core', 'belly', 'six pack', 'پیٹ'])) {
    key = 'abs';
  } else if (matchKey(['creatine', 'supplement', 'whey', 'powder', 'سپلیمنٹ', 'پروٹین پاؤڈر'])) {
    key = 'supplements';
  } else if (matchKey(['muscle', 'bulking', 'hypertrophy', 'bulk', 'gain', 'پٹھے', 'تعمیر', 'mass'])) {
    key = 'muscle';
  } else if (matchKey(['fat', 'lose', 'weight loss', 'slim', 'cut', 'چربی', 'وزن کم', 'slim down', 'deficit', 'wazan'])) {
    key = 'fat';
  } else if (matchKey(['endurance', 'cardio', 'running', 'marathon', 'stamina', 'استقامت', 'دوڑ'])) {
    key = 'endurance';
  } else if (matchKey(['diet', 'meal', 'food', 'eat', 'nutrition', 'خوراک', 'کھانا', 'ڈائیٹ', 'khana'])) {
    key = 'diet';
  } else if (matchKey(['gym', 'workout', 'exercise', 'training', 'session', 'جم', 'ورک آوٹ', 'kasrat'])) {
    key = 'gym';
  } else if (matchKey(['plan', 'subscription', 'price', 'pro', 'elite', 'upgrade', 'پلان', 'سبسکرپشن'])) {
    key = 'subscription';
  } else if (matchKey(['recover', 'rest', 'sleep', 'sore', 'hrv', 'آرام', 'نیند'])) {
    key = 'recovery';
  } else if (matchKey(['protein', 'پروٹین', 'high protein'])) {
    key = 'protein';
  }

  if (key && knowledge[key]) {
    return knowledge[key];
  }
  if (key && fallbackLang[key]) {
    return fallbackLang[key];
  }

  return language === 'ur'
    ? `میں آپ کا 24/7 AI فٹنس کوچ ہوں! 💪\n\nآپ مجھ سے ان موضوعات پر رہنمائی لے سکتے ہیں:\n• پٹھوں اور ڈولوں کی ورزش (Arms, Chest, Back, Legs)\n• چربی اور وزن کم کرنے کا لائحہ عمل\n• خوراک اور ڈائیٹ چارٹ (Macros & Diet)\n• جم ورک آوٹ سپلٹس (PPL & Full Body)\n• سپلیمنٹس (Creatine, Whey)\n\nبتائیں آپ کس چیز پر کام کرنا چاہتے ہیں؟`
    : `I'm your personalised Athleo AI Coach! 💪\n\nAsk me about:\n• Muscle building & strength protocols\n• Specific body parts (Chest, Arms, Back, Legs, Abs)\n• Fat loss & cutting plans\n• Diet, macros & meal timing\n• Supplements (Creatine, Whey, Vitamins)\n• Recovery & workout splits\n\nWhat is your primary fitness goal right now?`;
}

// ─── Exported askCoach (Network-Aware) ───────────────────────────────────────
export type CoachSource = 'online' | 'offline';

let _lastSource: CoachSource = 'offline';

export function getLastCoachSource(): CoachSource {
  return _lastSource;
}

/**
 * Main AI Coach entry point — network-aware routing:
 *
 *   🌐 Internet ON  → Gemini 1.5 Flash cloud (intelligent, personalised)
 *   📵 Internet OFF → Offline Sports Science Engine (instant, <50ms)
 *
 * If online but Gemini call fails (server error / timeout), gracefully
 * falls back to the offline engine so the user always gets a response.
 */
export async function askCoach(message: string, context: CoachContext = {}): Promise<string> {
  const online = await isNetworkAvailable();

  if (online) {
    try {
      const reply = await askGemini(message, context);
      _lastSource = 'online';
      return reply;
    } catch (err) {
      console.warn('[AICoach] Gemini cloud failed, switching to offline engine:', err);
      // Falls through to offline engine below
    }
  }

  // Offline engine — instant (<50ms), always works
  _lastSource = 'offline';
  return getOfflineResponse(message, context.language ?? 'en');
}

export const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://127.0.0.1:8080';
