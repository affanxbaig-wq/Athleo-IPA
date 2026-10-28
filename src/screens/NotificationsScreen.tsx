import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, StyleSheet, Switch, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';
import {
  updateNotificationPrefs,
  requestNotificationPermission,
  type NotifPrefs,
} from '../services/notificationService';
import {
  detectAndSyncLocation,
  getCachedLocationProfile,
  subscribeLocationProfile,
  type UserLocationProfile,
} from '../services/locationTimezoneService';
import {
  DEFAULT_WORKOUT_EXERCISES,
  fetchScheduleFromSupabase,
  generateLocalReminderPreview,
  getCachedWorkoutSchedule,
  saveAndSyncWorkoutSchedule,
  subscribeWorkoutSchedule,
  type GeneratedReminderSnapshot,
  type SelectedWorkoutExercise,
  type WorkoutScheduleData,
} from '../services/workoutScheduleService';
import {getUserProfile} from '../services/userProfile';
import {triggerHaptic} from '../services/haptics';

interface NotificationsScreenProps {
  navigate?: (tab: TabKey) => void;
}

type NotifKey =
  | 'workoutReminders'
  | 'streakAlerts'
  | 'macroAlerts'
  | 'coachTips'
  | 'achievements'
  | 'communityActivity'
  | 'weeklyInsights'
  | 'restDayReminder';

type NotifGroup = {
  title: string;
  items: {key: NotifKey; label: string; desc: string; icon: string}[];
};

const NOTIF_GROUPS: NotifGroup[] = [
  {
    title: 'Training & Goals',
    items: [
      {key: 'workoutReminders', label: 'Workout Reminders', desc: 'Personalized reminder with goal & exercises', icon: 'barbell-outline'},
      {key: 'restDayReminder', label: 'Rest Day Alert', desc: 'Reminder to recover when scheduled', icon: 'moon-outline'},
      {key: 'streakAlerts', label: 'Streak Alerts', desc: 'Warning before your streak breaks', icon: 'flame-outline'},
    ],
  },
  {
    title: 'Nutrition & Macros',
    items: [
      {key: 'macroAlerts', label: 'Macro Reminders', desc: 'Log meals before day ends', icon: 'nutrition-outline'},
    ],
  },
  {
    title: 'AI Coach & Advice',
    items: [
      {key: 'coachTips', label: 'Coach Tips', desc: 'Personalized fitness insights', icon: 'sparkles-outline'},
      {key: 'weeklyInsights', label: 'Weekly Report', desc: 'Progress summary every Sunday', icon: 'bar-chart-outline'},
    ],
  },
  {
    title: 'Social & Achievements',
    items: [
      {key: 'achievements', label: 'Badges & XP', desc: 'When you earn achievements', icon: 'trophy-outline'},
      {key: 'communityActivity', label: 'Community', desc: 'Likes, comments and challenges', icon: 'people-outline'},
    ],
  },
];

const REMINDER_TIMES = ['06:00 AM', '07:00 AM', '08:00 AM', '12:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const POPULAR_EXERCISES_CATALOG: SelectedWorkoutExercise[] = [
  {id: 'squat', name: 'Barbell Back Squat', bodyPart: 'Legs', equipment: 'Barbell', target: 'Quadriceps', sets: 4, reps: '8-10'},
  {id: 'bench-press', name: 'Barbell Bench Press', bodyPart: 'Chest', equipment: 'Barbell', target: 'Pectorals', sets: 4, reps: '8-10'},
  {id: 'lat-pulldown', name: 'Lat Pulldown', bodyPart: 'Back', equipment: 'Cable', target: 'Lats', sets: 3, reps: '10-12'},
  {id: 'pushup', name: 'Push-up', bodyPart: 'Chest', equipment: 'Bodyweight', target: 'Chest & Core', sets: 3, reps: '12-15'},
  {id: 'plank', name: 'Standard Plank', bodyPart: 'Core', equipment: 'Bodyweight', target: 'Core', sets: 3, reps: '45s'},
  {id: 'deadlift', name: 'Romanian Deadlift', bodyPart: 'Legs', equipment: 'Barbell', target: 'Hamstrings & Glutes', sets: 3, reps: '10-12'},
  {id: 'dumbbell-row', name: 'Dumbbell Row', bodyPart: 'Back', equipment: 'Dumbbell', target: 'Upper Back', sets: 3, reps: '10-12'},
  {id: 'overhead-press', name: 'Overhead Dumbbell Press', bodyPart: 'Shoulders', equipment: 'Dumbbell', target: 'Deltoids', sets: 3, reps: '10-12'},
  {id: 'lunges', name: 'Walking Lunges', bodyPart: 'Legs', equipment: 'Bodyweight', target: 'Quads & Glutes', sets: 3, reps: '12 reps/leg'},
  {id: 'bicep-curl', name: 'Dumbbell Bicep Curl', bodyPart: 'Arms', equipment: 'Dumbbell', target: 'Biceps', sets: 3, reps: '12-15'},
];

export function NotificationsScreen({navigate: _navigate}: NotificationsScreenProps) {
  const [enabled, setEnabled] = useState<Record<NotifKey, boolean>>({
    workoutReminders: true,
    streakAlerts: true,
    macroAlerts: true,
    coachTips: true,
    achievements: true,
    communityActivity: false,
    weeklyInsights: true,
    restDayReminder: false,
  });

  const [schedule, setSchedule] = useState<WorkoutScheduleData>(getCachedWorkoutSchedule());
  const [location, setLocation] = useState<UserLocationProfile>(getCachedLocationProfile());
  const [selectedExercises, setSelectedExercises] = useState<SelectedWorkoutExercise[]>(schedule.selectedExercises || DEFAULT_WORKOUT_EXERCISES);
  const [selectedDays, setSelectedDays] = useState<string[]>(schedule.workoutDays || ['Monday', 'Wednesday', 'Friday']);
  const [selectedTime, setSelectedTime] = useState(schedule.workoutTime || '07:00 AM');

  const [locSyncing, setLocSyncing] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    requestNotificationPermission().then(granted => setPermGranted(granted));
  }, []);

  useEffect(() => {
    const unsubLoc = subscribeLocationProfile(l => setLocation(l));
    const unsubSched = subscribeWorkoutSchedule(s => {
      setSchedule(s);
      setSelectedTime(s.workoutTime);
      setSelectedDays(s.workoutDays);
      setSelectedExercises(s.selectedExercises);
    });

    fetchScheduleFromSupabase();

    return () => {
      unsubLoc();
      unsubSched();
    };
  }, []);

  const profile = getUserProfile();

  // Dynamic live reminder preview based on current state
  const reminderPreview: GeneratedReminderSnapshot = useMemo(() => {
    return generateLocalReminderPreview(
      {
        ...schedule,
        workoutTime: selectedTime,
        workoutDays: selectedDays,
        selectedExercises,
        timezone: location.timezone,
        country: location.country,
        region: location.region,
      },
      profile,
      location,
    );
  }, [schedule, selectedTime, selectedDays, selectedExercises, location, profile]);

  const handleRefreshLocation = async () => {
    triggerHaptic('impactMedium');
    setLocSyncing(true);
    try {
      const updated = await detectAndSyncLocation();
      setLocation(updated);
      setSaveToast(`Location & Timezone synced: ${updated.city ? `${updated.city}, ` : ''}${updated.country} (${updated.timezone})`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      Alert.alert('Location Update', 'Could not access GPS. Using device timezone.');
    } finally {
      setLocSyncing(false);
    }
  };

  const handleToggleDay = (day: string) => {
    triggerHaptic('selection');
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        if (prev.length <= 1) {
          return prev; // keep at least 1 day
        }
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  const handleToggleExercise = (ex: SelectedWorkoutExercise) => {
    triggerHaptic('selection');
    setSelectedExercises(prev => {
      const exists = prev.some(item => item.id === ex.id);
      if (exists) {
        if (prev.length <= 1) {
          Alert.alert('Exercise Routine', 'Please keep at least 1 exercise in your routine.');
          return prev;
        }
        return prev.filter(item => item.id !== ex.id);
      }
      return [...prev, ex];
    });
  };

  const handleSaveAll = async () => {
    triggerHaptic('impactHeavy');
    setSavingSchedule(true);
    try {
      await saveAndSyncWorkoutSchedule({
        workoutTime: selectedTime,
        workoutDays: selectedDays,
        selectedExercises,
        reminderEnabled: enabled.workoutReminders,
        timezone: location.timezone,
        country: location.country,
        region: location.region,
        city: location.city,
      });

      // Also sync Notifee prefs
      const notifPrefs: NotifPrefs = {
        workoutReminders: enabled.workoutReminders,
        streakAlerts: enabled.streakAlerts,
        macroAlerts: enabled.macroAlerts,
        coachTips: enabled.coachTips,
        achievements: enabled.achievements,
        communityActivity: enabled.communityActivity,
        weeklyInsights: enabled.weeklyInsights,
        restDayReminder: enabled.restDayReminder,
        hydrationReminders: true,
        sleepReminder: false,
        sleepReminderHour: 22,
        reminderTime: selectedTime,
      };
      await updateNotificationPrefs(notifPrefs);

      setSaveToast('Workout schedule & reminder saved!');
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.warn('[NotificationsScreen] handleSaveAll failed:', err);
    } finally {
      setSavingSchedule(false);
    }
  };

  const flipToggle = (key: NotifKey) => {
    triggerHaptic('selection');
    setEnabled(prev => {
      const next = {...prev, [key]: !prev[key]};
      updateNotificationPrefs({
        workoutReminders: next.workoutReminders,
        streakAlerts: next.streakAlerts,
        macroAlerts: next.macroAlerts,
        coachTips: next.coachTips,
        achievements: next.achievements,
        communityActivity: next.communityActivity,
        weeklyInsights: next.weeklyInsights,
        restDayReminder: next.restDayReminder,
        hydrationReminders: true,
        sleepReminder: false,
        sleepReminderHour: 22,
        reminderTime: selectedTime,
      });
      return next;
    });
  };

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Preferences & Sync</Text>
          <Text style={styles.title}>Workout Reminders</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {Object.values(enabled).filter(Boolean).length} on
          </Text>
        </View>
      </View>

      {/* Save Success Toast */}
      {saveToast && (
        <View style={styles.toastBanner}>
          <Icon name="checkmark-circle-outline" size={16} color={ATHLEO_COLORS.accent} />
          <Text style={styles.toastText}>{saveToast}</Text>
        </View>
      )}

      {/* Permission notice if explicitly denied */}
      {permGranted === false && (
        <View style={styles.warningBanner}>
          <Icon name="warning-outline" size={16} color="#FFB020" />
          <Text style={styles.warningText}>Notifications disabled in system settings. Tap to enable.</Text>
        </View>
      )}

      {/* 1. Country, Region & Timezone Card */}
      <AppCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconCircle}>
            <Icon name="globe-outline" size={18} color={ATHLEO_COLORS.accent} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.sectionTitle}>Location & Local Timezone</Text>
            <Text style={styles.sectionDesc}>Auto-synced for localized smart reminders</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshLocation}
            disabled={locSyncing}>
            {locSyncing ? (
              <ActivityIndicator size="small" color={ATHLEO_COLORS.accent} />
            ) : (
              <Icon name="refresh-outline" size={18} color={ATHLEO_COLORS.accent} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.locGrid}>
          <View style={styles.locItem}>
            <Text style={styles.locLabel}>Country / Region</Text>
            <Text style={styles.locValue}>
              {location.country ? `${location.country}` : 'Pakistan'}
              {location.region ? ` (${location.region})` : ''}
            </Text>
          </View>

          <View style={styles.locItem}>
            <Text style={styles.locLabel}>Time Zone</Text>
            <View style={styles.tzRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.locValueHighlight}>{location.timezone || 'Asia/Karachi'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.locFooter}>
          <Icon name="navigate-circle-outline" size={14} color={ATHLEO_COLORS.muted} />
          <Text style={styles.locMeta}>
            Status: {location.permissionStatus === 'granted' ? 'GPS High-Accuracy' : 'Device Locale Detection'} • Cloud Synced
          </Text>
        </View>
      </AppCard>

      {/* 2. Live Notification Preview Card */}
      <AppCard style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewBadge}>
            <Icon name="phone-portrait-outline" size={12} color={ATHLEO_COLORS.accent} />
            <Text style={styles.previewBadgeText}>LIVE NOTIFICATION PREVIEW</Text>
          </View>
          <Text style={styles.previewMeta}>Delivered at {selectedTime} ({location.timezone})</Text>
        </View>

        <View style={styles.notifBox}>
          <View style={styles.notifRowTop}>
            <View style={styles.notifAppIcon}>
              <Icon name="barbell" size={14} color="#000" />
            </View>
            <Text style={styles.notifAppName}>ATHLEO FITNESS</Text>
            <Text style={styles.notifDot}>•</Text>
            <Text style={styles.notifTimeAgo}>scheduled</Text>
          </View>
          <Text style={styles.notifTitle}>{reminderPreview.title}</Text>
          <Text style={styles.notifBody}>{reminderPreview.body}</Text>
        </View>

        <View style={styles.previewExpl}>
          <Icon name="information-circle-outline" size={14} color={ATHLEO_COLORS.muted} />
          <Text style={styles.previewExplText}>
            When this reminder fires, it directly tells you your set fitness goal ({reminderPreview.goalSummary.slice(6, 32)}...) and what the app suggests for your training and recovery!
          </Text>
        </View>
      </AppCard>

      {/* 3. Workout Reminder Time */}
      <AppCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconCircle}>
            <Icon name="time-outline" size={18} color={ATHLEO_COLORS.accent} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.sectionTitle}>Workout Reminder Time</Text>
            <Text style={styles.sectionDesc}>Select the exact time you want your reminder</Text>
          </View>
        </View>
        <View style={styles.timeGrid}>
          {REMINDER_TIMES.map(time => (
            <TouchableOpacity
              key={time}
              style={[styles.timeChip, selectedTime === time && styles.timeChipActive]}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedTime(time);
              }}>
              <Text style={[styles.timeChipText, selectedTime === time && styles.timeChipTextActive]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      {/* 4. Workout Days Selector */}
      <AppCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconCircle}>
            <Icon name="calendar-outline" size={18} color={ATHLEO_COLORS.accent} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.sectionTitle}>Workout Days</Text>
            <Text style={styles.sectionDesc}>Days of the week to trigger your reminder</Text>
          </View>
        </View>
        <View style={styles.daysGrid}>
          {WEEKDAYS.map(day => {
            const isSelected = selectedDays.includes(day);
            const shortDay = day.slice(0, 3);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, isSelected && styles.dayChipActive]}
                onPress={() => handleToggleDay(day)}>
                <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                  {shortDay}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      {/* 5. Workout & Fitness Exercises Selection */}
      <AppCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconCircle}>
            <Icon name="fitness-outline" size={18} color={ATHLEO_COLORS.accent} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.sectionTitle}>Workout Routine Exercises</Text>
            <Text style={styles.sectionDesc}>Tap to add or remove exercises included in your reminder</Text>
          </View>
        </View>

        {/* Selected exercises pills */}
        <View style={styles.exercisePillsContainer}>
          {selectedExercises.map(ex => (
            <TouchableOpacity
              key={ex.id}
              style={styles.selectedExercisePill}
              onPress={() => handleToggleExercise(ex)}>
              <Text style={styles.selectedExerciseName}>{ex.name}</Text>
              <View style={styles.pillTargetTag}>
                <Text style={styles.pillTargetText}>{ex.target}</Text>
              </View>
              <Icon name="close-circle" size={16} color={ATHLEO_COLORS.accent} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.catalogHeading}>Add from Exercise Library</Text>
        <View style={styles.catalogGrid}>
          {POPULAR_EXERCISES_CATALOG.map(item => {
            const isIncluded = selectedExercises.some(e => e.id === item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.catalogChip, isIncluded && styles.catalogChipActive]}
                onPress={() => handleToggleExercise(item)}>
                <Icon
                  name={isIncluded ? 'checkmark-circle' : 'add-circle-outline'}
                  size={15}
                  color={isIncluded ? ATHLEO_COLORS.accent : ATHLEO_COLORS.muted}
                />
                <Text style={[styles.catalogChipText, isIncluded && styles.catalogChipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      {/* 6. Save & Synchronize Action Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveAll}
        disabled={savingSchedule}>
        {savingSchedule ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <>
            <Icon name="checkmark-circle-outline" size={20} color="#000" />
            <Text style={styles.saveButtonText}>Save Workout Schedule</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 7. Other Alert Settings */}
      {NOTIF_GROUPS.map(group => (
        <View key={group.title}>
          <Text style={styles.groupLabel}>{group.title}</Text>
          <AppCard style={styles.section}>
            {group.items.map((item, idx) => (
              <View
                key={item.key}
                style={[styles.row, idx < group.items.length - 1 && styles.rowBorder]}>
                <View style={styles.rowIcon}>
                  <Icon name={item.icon} size={18} color={enabled[item.key] ? ATHLEO_COLORS.accent : ATHLEO_COLORS.muted} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={enabled[item.key]}
                  onValueChange={() => flipToggle(item.key)}
                  trackColor={{false: '#2A2A2E', true: 'rgba(184,255,77,0.45)'}}
                  thumbColor={enabled[item.key] ? ATHLEO_COLORS.accent : '#6B6E75'}
                />
              </View>
            ))}
          </AppCard>
        </View>
      ))}

      {/* Quiet Hours */}
      <AppCard style={styles.quietCard}>
        <View style={styles.quietHeader}>
          <Icon name="bed-outline" size={18} color={ATHLEO_COLORS.muted} />
          <View style={styles.quietBody}>
            <Text style={styles.quietTitle}>Quiet Hours</Text>
            <Text style={styles.quietDesc}>No non-critical notifications between 10 PM – 7 AM</Text>
          </View>
          <Switch
            value={true}
            trackColor={{false: '#2A2A2E', true: 'rgba(184,255,77,0.45)'}}
            thumbColor={ATHLEO_COLORS.accent}
          />
        </View>
      </AppCard>

      <Text style={styles.footer}>
        All workout schedules, exercises, and timezones automatically stay synced across your devices.
      </Text>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 120, gap: 14},
  flex1: {flex: 1},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  eyebrow: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6},
  title: {color: ATHLEO_COLORS.text, fontSize: 26, fontWeight: '800'},
  countPill: {
    backgroundColor: 'rgba(184,255,77,0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.2)',
  },
  countText: {color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '800'},
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(184,255,77,0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.3)',
  },
  toastText: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '600', flex: 1},
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,176,32,0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,176,32,0.3)',
  },
  warningText: {color: '#FFB020', fontSize: 12, flex: 1},
  section: {
    backgroundColor: 'rgba(20,20,23,0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    padding: 16,
  },
  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14},
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(184,255,77,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '700'},
  sectionDesc: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  locGrid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  locItem: {flex: 1},
  locLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8},
  locValue: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 3},
  tzRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3},
  onlineDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: ATHLEO_COLORS.accent},
  locValueHighlight: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '700'},
  locFooter: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10},
  locMeta: {color: ATHLEO_COLORS.muted, fontSize: 10},

  /* Live Preview */
  previewCard: {
    backgroundColor: 'rgba(18,22,26,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.3)',
    padding: 16,
    gap: 10,
  },
  previewHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(184,255,77,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewBadgeText: {color: ATHLEO_COLORS.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1},
  previewMeta: {color: ATHLEO_COLORS.muted, fontSize: 10},
  notifBox: {
    backgroundColor: 'rgba(32,36,42,0.98)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notifRowTop: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
  notifAppIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: ATHLEO_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifAppName: {color: '#DDD', fontSize: 10, fontWeight: '800', letterSpacing: 0.8},
  notifDot: {color: '#777', fontSize: 10},
  notifTimeAgo: {color: '#999', fontSize: 10},
  notifTitle: {color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 4},
  notifBody: {color: '#CCC', fontSize: 12, lineHeight: 17},
  previewExpl: {flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2},
  previewExplText: {color: ATHLEO_COLORS.muted, fontSize: 11, flex: 1, lineHeight: 15},

  /* Time Chips */
  timeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timeChipActive: {
    backgroundColor: 'rgba(184,255,77,0.18)',
    borderColor: ATHLEO_COLORS.accent,
  },
  timeChipText: {color: ATHLEO_COLORS.muted, fontSize: 12, fontWeight: '600'},
  timeChipTextActive: {color: ATHLEO_COLORS.accent, fontWeight: '800'},

  /* Days Grid */
  daysGrid: {flexDirection: 'row', justifyContent: 'space-between', gap: 6},
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayChipActive: {
    backgroundColor: 'rgba(184,255,77,0.18)',
    borderColor: ATHLEO_COLORS.accent,
  },
  dayChipText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700'},
  dayChipTextActive: {color: ATHLEO_COLORS.accent, fontWeight: '800'},

  /* Exercise Pills */
  exercisePillsContainer: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  selectedExercisePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(184,255,77,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.3)',
  },
  selectedExerciseName: {color: '#FFF', fontSize: 12, fontWeight: '700'},
  pillTargetTag: {backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6},
  pillTargetText: {color: ATHLEO_COLORS.accent, fontSize: 9, fontWeight: '700'},
  catalogHeading: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: 8},
  catalogGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  catalogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catalogChipActive: {
    backgroundColor: 'rgba(184,255,77,0.08)',
    borderColor: 'rgba(184,255,77,0.25)',
  },
  catalogChipText: {color: ATHLEO_COLORS.muted, fontSize: 11},
  catalogChipTextActive: {color: ATHLEO_COLORS.accent, fontWeight: '700'},

  /* Save Button */
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ATHLEO_COLORS.accent,
    paddingVertical: 15,
    borderRadius: 16,
    marginVertical: 4,
    shadowColor: ATHLEO_COLORS.accent,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonText: {color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5},

  /* Groups & Rows */
  groupLabel: {
    color: ATHLEO_COLORS.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  rowBorder: {borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'},
  rowIcon: {width: 24, alignItems: 'center'},
  rowBody: {flex: 1},
  rowLabel: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '600'},
  rowDesc: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},

  /* Quiet Hours */
  quietCard: {
    backgroundColor: 'rgba(20,20,23,0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    padding: 16,
  },
  quietHeader: {flexDirection: 'row', alignItems: 'center', gap: 12},
  quietBody: {flex: 1},
  quietTitle: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700'},
  quietDesc: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},

  footer: {color: ATHLEO_COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16},
});
