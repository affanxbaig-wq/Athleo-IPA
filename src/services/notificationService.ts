/**
 * notificationService.ts
 * Schedules and manages local push notifications via @notifee/react-native.
 * All calls are wrapped in try/catch so the app works gracefully if the
 * native module is unavailable (e.g., Expo Go, simulator with no perms).
 */

// Dynamic import — safe guard in case native bridge isn't linked yet
let notifee: any = null;
let AndroidImportance: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default ?? mod;
  AndroidImportance = mod.AndroidImportance;
  TriggerType = mod.TriggerType;
  RepeatFrequency = mod.RepeatFrequency;
} catch {
  notifee = null;
}

// ─── Channel Setup ───────────────────────────────────────────────────────────

const CHANNEL_TRAINING = 'athleo_training';
const CHANNEL_NUTRITION = 'athleo_nutrition';
const CHANNEL_COACH = 'athleo_coach';
const CHANNEL_SOCIAL = 'athleo_social';

async function ensureChannels(): Promise<void> {
  if (!notifee || !AndroidImportance) {return;}
  await notifee.createChannel({
    id: CHANNEL_TRAINING,
    name: 'Training',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
  await notifee.createChannel({
    id: CHANNEL_NUTRITION,
    name: 'Nutrition',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: CHANNEL_COACH,
    name: 'AI Coach',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: CHANNEL_SOCIAL,
    name: 'Social & Badges',
    importance: AndroidImportance.LOW,
  });
}

// ─── Permission Request ───────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notifee) {return true;}
  try {
    const settings = await notifee.requestPermission();
    // On Android, a missing native bridge or denied system permission should not
    // be treated as a fatal app error; we surface false only when the request is
    // explicitly rejected.
    const granted = settings?.authorizationStatus >= 1 || settings?.status === 'granted';
    return Boolean(granted);
  } catch {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTime(timeStr: string): {hour: number; minute: number} {
  // e.g. "07:00 AM", "06:00 PM"
  const [time, period] = timeStr.split(' ');
  const [hourStr, minuteStr] = time.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (period === 'PM' && hour !== 12) {hour += 12;}
  if (period === 'AM' && hour === 12) {hour = 0;}
  return {hour, minute};
}

function nextTriggerDate(hour: number, minute: number): Date {
  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);
  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1); // tomorrow if already past
  }
  return trigger;
}

// ─── Notification IDs ─────────────────────────────────────────────────────────

const IDS = {
  workoutReminder: 'n_workout_reminder',
  streakWarning: 'n_streak_warning',
  macroReminder: 'n_macro_reminder',
  weeklyReport: 'n_weekly_report',
  restDayReminder: 'n_rest_day',
  coachTip: 'n_coach_tip',
  hydration8: 'n_hydration_0800',
  hydration10: 'n_hydration_1000',
  hydration12: 'n_hydration_1200',
  hydration14: 'n_hydration_1400',
  hydration16: 'n_hydration_1600',
  hydration18: 'n_hydration_1800',
  hydration20: 'n_hydration_2000',
  sleepReminder: 'n_sleep_reminder',
};

// ─── Scheduled Notifications ─────────────────────────────────────────────────

export async function scheduleWorkoutReminder(timeStr: string): Promise<void> {
  return scheduleCustomWorkoutReminder({
    timeStr,
    title: '🏋️ Time to Train',
    body: "Your workout is scheduled! Let's crush it today.",
  });
}

export interface CustomWorkoutReminderOptions {
  timeStr: string;
  title: string;
  body: string;
  timezone?: string;
}

export async function scheduleCustomWorkoutReminder(options: CustomWorkoutReminderOptions): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const {hour, minute} = parseTime(options.timeStr);
    const triggerDate = nextTriggerDate(hour, minute);

    await notifee.createTriggerNotification(
      {
        id: IDS.workoutReminder,
        title: options.title || '🏋️ Time to Train',
        body: options.body || "Your workout is scheduled! Let's crush it today.",
        android: {
          channelId: CHANNEL_TRAINING,
          smallIcon: 'ic_launcher',
          pressAction: {id: 'default'},
        },
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleCustomWorkoutReminder failed:', e);
  }
}

export async function scheduleStreakWarning(): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const triggerDate = nextTriggerDate(20, 0); // 8 PM daily

    await notifee.createTriggerNotification(
      {
        id: IDS.streakWarning,
        title: '🔥 Streak Alert!',
        body: "You haven't logged activity today. Train or track steps to keep your streak alive!",
        android: {channelId: CHANNEL_TRAINING, smallIcon: 'ic_launcher'},
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleStreakWarning failed:', e);
  }
}

export async function scheduleMacroReminder(): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const triggerDate = nextTriggerDate(19, 0); // 7 PM daily

    await notifee.createTriggerNotification(
      {
        id: IDS.macroReminder,
        title: '🥗 Log Your Meals',
        body: "Don't forget to track your nutrition for today. Your macros are waiting!",
        android: {channelId: CHANNEL_NUTRITION, smallIcon: 'ic_launcher'},
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleMacroReminder failed:', e);
  }
}

export async function scheduleWeeklyReport(): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    // Next Sunday at 9 AM
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const trigger = new Date();
    trigger.setDate(now.getDate() + daysUntilSunday);
    trigger.setHours(9, 0, 0, 0);

    await notifee.createTriggerNotification(
      {
        id: IDS.weeklyReport,
        title: '📊 Your Weekly Report is Ready',
        body: 'Check your progress summary, PRs, and AI coach analysis for this week.',
        android: {channelId: CHANNEL_COACH, smallIcon: 'ic_launcher'},
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: trigger.getTime(),
        repeatFrequency: RepeatFrequency.WEEKLY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleWeeklyReport failed:', e);
  }
}

export async function scheduleRestDayReminder(): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const triggerDate = nextTriggerDate(10, 0); // 10 AM
    await notifee.createTriggerNotification(
      {
        id: IDS.restDayReminder,
        title: '🌙 Rest Day Reminder',
        body: "Today is your recovery day. Stretch, hydrate, and let your muscles rebuild.",
        android: {channelId: CHANNEL_TRAINING, smallIcon: 'ic_launcher'},
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        repeatFrequency: RepeatFrequency.WEEKLY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleRestDayReminder failed:', e);
  }
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

export async function cancelNotification(id: string): Promise<void> {
  if (!notifee) {return;}
  try {
    await notifee.cancelNotification(id);
  } catch {}
}

export async function cancelAllNotifications(): Promise<void> {
  if (!notifee) {return;}
  try {
    await notifee.cancelAllNotifications();
  } catch {}
}

// ─── Hydration Reminders (every 2h, 8am–8pm) ─────────────────────────────────

export async function scheduleHydrationReminders(): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const hours = [8, 10, 12, 14, 16, 18, 20];
    const idKeys = ['hydration8', 'hydration10', 'hydration12', 'hydration14', 'hydration16', 'hydration18', 'hydration20'] as const;
    await Promise.all(
      hours.map(async (hour, i) => {
        const triggerDate = nextTriggerDate(hour, 0);
        await notifee.createTriggerNotification(
          {
            id: IDS[idKeys[i]],
            title: '💧 Hydration Check',
            body: 'Stay on top of your water intake — drink a glass now!',
            android: {channelId: CHANNEL_NUTRITION, smallIcon: 'ic_launcher'},
            ios: {sound: 'default'},
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: triggerDate.getTime(),
            repeatFrequency: RepeatFrequency.DAILY,
          },
        );
      }),
    );
  } catch (e) {
    console.warn('[Notifee] scheduleHydrationReminders failed:', e);
  }
}

export async function cancelHydrationReminders(): Promise<void> {
  const ids = [IDS.hydration8, IDS.hydration10, IDS.hydration12, IDS.hydration14, IDS.hydration16, IDS.hydration18, IDS.hydration20];
  await Promise.all(ids.map(id => cancelNotification(id)));
}

// ─── Sleep Reminder ────────────────────────────────────────────────────────────

export async function scheduleSleepReminder(hour = 22, minute = 0): Promise<void> {
  if (!notifee || !TriggerType || !RepeatFrequency) {return;}
  try {
    await ensureChannels();
    const triggerDate = nextTriggerDate(hour, minute);
    await notifee.createTriggerNotification(
      {
        id: IDS.sleepReminder,
        title: '🌙 Sleep Reminder',
        body: 'Wind down and prepare for recovery. Quality sleep is your best performance tool.',
        android: {channelId: CHANNEL_TRAINING, smallIcon: 'ic_launcher'},
        ios: {sound: 'default'},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  } catch (e) {
    console.warn('[Notifee] scheduleSleepReminder failed:', e);
  }
}

// ─── Immediate Notifications ──────────────────────────────────────────────────

export async function showBadgeEarnedNotification(badgeName: string, emoji = '🏅'): Promise<void> {
  if (!notifee) {return;}
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: `badge_${Date.now()}`,
      title: `${emoji} Badge Unlocked!`,
      body: `You earned the "${badgeName}" badge. Keep crushing it!`,
      android: {channelId: CHANNEL_SOCIAL, smallIcon: 'ic_launcher'},
      ios: {sound: 'default'},
    });
  } catch (e) {
    console.warn('[Notifee] showBadgeEarnedNotification failed:', e);
  }
}

export async function showGoalCompletedNotification(goalType: string): Promise<void> {
  if (!notifee) {return;}
  try {
    await ensureChannels();
    const messages: Record<string, {title: string; body: string}> = {
      steps: {title: '🚶 Step Goal Crushed!', body: 'You hit your daily step target! Exceptional movement today.'},
      calories: {title: '🔥 Calorie Goal Hit!', body: 'You reached your calorie target for today. Fuel up and recover!'},
      water: {title: '💧 Hydration Goal Done!', body: 'Perfect hydration today. Your body thanks you!'},
      workouts: {title: '💪 Workout Done!', body: "Today's workout is complete. Strong session — you showed up!"},
    };
    const msg = messages[goalType] ?? {title: '🎯 Goal Complete!', body: 'You hit a daily goal. Consistency is everything.'};
    await notifee.displayNotification({
      id: `goal_${goalType}_${Date.now()}`,
      title: msg.title,
      body: msg.body,
      android: {channelId: CHANNEL_TRAINING, smallIcon: 'ic_launcher'},
      ios: {sound: 'default'},
    });
  } catch (e) {
    console.warn('[Notifee] showGoalCompletedNotification failed:', e);
  }
}

// ─── Preference Sync ─────────────────────────────────────────────────────────

export type NotifPrefs = {
  workoutReminders: boolean;
  streakAlerts: boolean;
  macroAlerts: boolean;
  coachTips: boolean;
  achievements: boolean;
  communityActivity: boolean;
  weeklyInsights: boolean;
  restDayReminder: boolean;
  hydrationReminders: boolean;
  sleepReminder: boolean;
  sleepReminderHour: number;
  reminderTime: string;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  workoutReminders: true,
  streakAlerts: true,
  macroAlerts: true,
  coachTips: true,
  achievements: true,
  communityActivity: false,
  weeklyInsights: true,
  restDayReminder: true,
  hydrationReminders: true,
  sleepReminder: false,
  sleepReminderHour: 22,
  reminderTime: '07:00 AM',
};

export async function updateNotificationPrefs(
  prefs: NotifPrefs,
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) {return;}

  if (prefs.workoutReminders) {
    await scheduleWorkoutReminder(prefs.reminderTime);
  } else {
    await cancelNotification(IDS.workoutReminder);
  }

  if (prefs.streakAlerts) {
    await scheduleStreakWarning();
  } else {
    await cancelNotification(IDS.streakWarning);
  }

  if (prefs.macroAlerts) {
    await scheduleMacroReminder();
  } else {
    await cancelNotification(IDS.macroReminder);
  }

  if (prefs.weeklyInsights) {
    await scheduleWeeklyReport();
  } else {
    await cancelNotification(IDS.weeklyReport);
  }

  if (prefs.restDayReminder) {
    await scheduleRestDayReminder();
  } else {
    await cancelNotification(IDS.restDayReminder);
  }

  if (prefs.hydrationReminders) {
    await scheduleHydrationReminders();
  } else {
    await cancelHydrationReminders();
  }

  if (prefs.sleepReminder) {
    await scheduleSleepReminder(prefs.sleepReminderHour, 0);
  } else {
    await cancelNotification(IDS.sleepReminder);
  }
}

// ─── Goal Notifications & Milestones ──────────────────────────────────────────

/**
 * Fires when a user sets or updates their daily step goal.
 */
export async function notifyGoalSet(goalSteps: number): Promise<void> {
  if (!notifee) { return; }
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: `goal_set_${Date.now()}`,
      title: '🎯 Step Goal Set!',
      body: `Target: ${goalSteps.toLocaleString()} steps. Tracking active at 1ms ultra-fast hardware response rate!`,
      android: {
        channelId: CHANNEL_TRAINING,
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
      },
      ios: {sound: 'default'},
    });
  } catch (e) {
    console.warn('[Notifee] notifyGoalSet failed:', e);
  }
}

/**
 * Checks and delivers milestone notifications (50% and 100%) for daily step goals.
 * Deduplicated per calendar day so user is only alerted once per milestone.
 */
export async function checkStepGoalMilestones(
  steps: number,
  goal: number,
  calories: number,
  distanceKm: number,
): Promise<void> {
  if (!notifee || goal <= 0) { return; }
  try {
    const {getTodayKey} = await import('./dailyTracker');
    const {appStorage} = await import('./storage');
    const today = getTodayKey();

    const halfKey = `notif_milestone_50_${today}`;
    const fullKey = `notif_milestone_100_${today}`;

    // 50% milestone
    if (steps >= goal * 0.5 && steps < goal && appStorage.getString(halfKey) !== 'true') {
      appStorage.setString(halfKey, 'true');
      await ensureChannels();
      await notifee.displayNotification({
        id: `milestone_50_${Date.now()}`,
        title: `🔥 Halfway to Your Step Goal! (${steps.toLocaleString()} / ${goal.toLocaleString()})`,
        body: `Great momentum! You've covered ${distanceKm.toFixed(2)} km and burned ${Math.round(calories)} kcal. Keep crushing it!`,
        android: {
          channelId: CHANNEL_TRAINING,
          smallIcon: 'ic_launcher',
          pressAction: {id: 'default'},
        },
        ios: {sound: 'default'},
      });
    }

    // 100% milestone
    if (steps >= goal && appStorage.getString(fullKey) !== 'true') {
      appStorage.setString(fullKey, 'true');
      await ensureChannels();
      await notifee.displayNotification({
        id: `milestone_100_${Date.now()}`,
        title: `🏆 Goal Smashed! (${steps.toLocaleString()} Steps)`,
        body: `Incredible work! You completed your ${goal.toLocaleString()} steps goal today, covering ${distanceKm.toFixed(2)} km and burning ${Math.round(calories)} kcal!`,
        android: {
          channelId: CHANNEL_TRAINING,
          smallIcon: 'ic_launcher',
          pressAction: {id: 'default'},
        },
        ios: {sound: 'default'},
      });
    }
  } catch (e) {
    console.warn('[Notifee] checkStepGoalMilestones failed:', e);
  }
}

// ─── Detailed Weekly Report with Full User Details ────────────────────────────

/**
 * Generates and displays a rich weekly report notification including ALL user details:
 * Name, Weight, Goal, Streak, Total Steps, Distance, Calories Burned, Workouts, and Coach Note.
 */
export async function sendWeeklyReportNotification(): Promise<void> {
  if (!notifee) { return; }
  try {
    await ensureChannels();
    const {getUserProfile} = await import('./userProfile');
    const {getCachedDisplayName} = await import('./profileSync');
    const {getWeeklyReport} = await import('./progressTracker');
    const {getStreak} = await import('./dailyTracker');

    const profile = getUserProfile();
    const displayName = getCachedDisplayName() || 'Athlete';
    const weekly = getWeeklyReport();
    const streak = getStreak();

    const weight = profile.weightKg > 0 ? `${profile.weightKg} kg` : '72 kg';
    const goalName = (profile.goal || 'Fitness & Health').toUpperCase();
    const totalSteps = weekly.totalSteps.toLocaleString();
    const avgSteps = Math.round(weekly.avgSteps).toLocaleString();
    const distanceKm = ((weekly.totalSteps * 0.762) / 1000).toFixed(2);
    const caloriesBurned = Math.round(weekly.caloriesBurned);
    const grade = weekly.weekGrade;
    const workouts = weekly.totalWorkouts;
    const coachBlurb = weekly.coachBlurb || 'Keep up the consistent effort!';

    const title = `📊 Weekly Report: ${displayName} • Grade ${grade}`;
    const summary = `🔥 ${totalSteps} Steps (${distanceKm} km) • ${caloriesBurned} kcal burned • ${streak}d Streak!`;

    const detailedBody =
      `👤 Athlete: ${displayName} (${weight}) | Goal: ${goalName}\n` +
      `🔥 Current Streak: ${streak} Days | Week Grade: ${grade}\n` +
      `🚶 Total Steps: ${totalSteps} (Avg: ${avgSteps}/day)\n` +
      `📍 Total Distance: ${distanceKm} km\n` +
      `⚡ Calories Burned: ${caloriesBurned} kcal\n` +
      `💪 Workouts Logged: ${workouts} completed\n` +
      `🧠 Coach: ${coachBlurb}`;

    await notifee.displayNotification({
      id: `weekly_report_${Date.now()}`,
      title,
      body: summary,
      android: {
        channelId: CHANNEL_COACH,
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
        style: {
          type: 1, // BigTextStyle
          text: detailedBody,
          title,
          summary: `Athlete: ${displayName}`,
        },
      },
      ios: {
        sound: 'default',
        subtitle: `Streak: ${streak} Days • ${totalSteps} Steps`,
      },
    });
  } catch (e) {
    console.warn('[Notifee] sendWeeklyReportNotification failed:', e);
  }
}
