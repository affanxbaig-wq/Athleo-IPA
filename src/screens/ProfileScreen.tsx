/**
 * ProfileScreen.tsx — the athlete's own page.
 *
 * Every number on this screen is read from a live source:
 *   • body metrics + goals + plan come from the saved onboarding profile
 *     (`services/userProfile`), so editing the profile updates them instantly;
 *   • today's activity comes from `services/dailyTracker`, the same store the
 *     dashboard and pedometer write into.
 *
 * UI: rebuilt in the Apple Fitness idiom — a large title, a centred identity
 * card, an activity-ring centrepiece, grouped inset rows and a tinted app-grid.
 * The data flow, handlers and theme tokens are unchanged.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {AppleActivityRings} from '../components/AppleActivityRings';
import {PressableScale} from '../components/PressableScale';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {ATHLEO_FAMILY} from '../theme/typography';
import {ProfileXPPanel} from './ProfileXPPanel';
import {type TabKey} from '../navigation/AppNavigator';
import {signOut} from '../services/auth';
import {isSupabaseConfigured} from '../config/supabase';
import {getCachedDisplayName} from '../services/profileSync';
import {
  getCalorieGoal,
  getCaloriesBurned,
  getSteps,
  getStepsGoal,
  getStreak,
  getWaterGoalMl,
  getWaterMl,
  getWorkoutsCompleted,
} from '../services/dailyTracker';
import {getBmi, getUserProfile, subscribeToProfile, type UserProfile} from '../services/userProfile';
import {appStorage} from '../services/storage';

interface ProfileScreenProps {
  navigate?: (tab: TabKey) => void;
  onSignOut?: () => void;
}

const GOAL_LABELS: Record<string, string> = {
  fat: 'Lose Weight',
  muscle: 'Build Muscle',
  strength: 'Build Strength',
  endurance: 'Endurance',
  flexibility: 'Flexibility',
  wellness: 'Keep Fit',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Very Active',
  athlete: 'Athlete',
};

const featureTiles = [
  {key: 'gym' as TabKey, label: 'Smart Gym', icon: 'flame-outline', color: '#FF6B35'},
  {key: 'outdoor' as TabKey, label: 'Outdoor Run', icon: 'walk-outline', color: '#3AB4FF'},
  {key: 'pedometer' as TabKey, label: 'Pedometer', icon: 'footsteps-outline', color: '#B8FF4D'},
  {key: 'recovery' as TabKey, label: 'Recovery & HRV', icon: 'pulse-outline', color: '#FF6B6B'},
  {key: 'builder' as TabKey, label: 'Build Workout', icon: 'construct-outline', color: '#C87AFF'},
  {key: 'technique' as TabKey, label: 'Form Check', icon: 'body-outline', color: '#6AE28D'},
  {key: 'community' as TabKey, label: 'Community', icon: 'people-outline', color: '#5AC8FF'},
  {key: 'challenges' as TabKey, label: 'Challenges', icon: 'trophy-outline', color: '#FFD700'},
  {key: 'settings' as TabKey, label: 'Settings', icon: 'settings-outline', color: '#8A8C90'},
  {key: 'notifications' as TabKey, label: 'Notifications', icon: 'notifications-outline', color: '#FFB020'},
];

/** One row of an iOS-style grouped list: label on the left, value on the right. */
interface InfoRowProps {
  label: string;
  value: string;
  first?: boolean;
  valueAccent?: boolean;
  onPress?: () => void;
}

function InfoRow({label, value, first, valueAccent, onPress}: InfoRowProps) {
  const body = (
    <>
      <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.infoRight}>
        <Text
          style={[styles.infoValue, valueAccent && styles.infoValueAccent]}
          numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Icon name="chevron-forward" size={15} color={ATHLEO_COLORS.muted} /> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <PressableScale
        style={[styles.infoRow, !first && styles.infoRowTop]}
        onPress={onPress}>
        {body}
      </PressableScale>
    );
  }

  return <View style={[styles.infoRow, !first && styles.infoRowTop]}>{body}</View>;
}

export function ProfileScreen({navigate, onSignOut}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(getCachedDisplayName());
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [streak, setStreak] = useState(getStreak());
  const [steps, setSteps] = useState(getSteps());
  const [stepsGoal, setStepsGoal] = useState(getStepsGoal());
  const [caloriesBurned, setCaloriesBurned] = useState(getCaloriesBurned());
  const [calorieGoal, setCalorieGoal] = useState(getCalorieGoal());
  const [waterMl, setWaterMl] = useState(getWaterMl());
  const [waterGoalMl, setWaterGoalMl] = useState(getWaterGoalMl());
  const [workoutsToday, setWorkoutsToday] = useState(getWorkoutsCompleted());

  // Refresh on mount and whenever the profile store changes (e.g. right after
  // the Edit Profile screen saves).
  useEffect(() => {
    const sync = () => {
      setDisplayName(getCachedDisplayName());
      setProfile(getUserProfile());
      setStreak(getStreak());
      setSteps(getSteps());
      setStepsGoal(getStepsGoal());
      setCaloriesBurned(getCaloriesBurned());
      setCalorieGoal(getCalorieGoal());
      setWaterMl(getWaterMl());
      setWaterGoalMl(getWaterGoalMl());
      setWorkoutsToday(getWorkoutsCompleted());
    };

    sync();
    return subscribeToProfile(sync);
  }, []);

  const goalLabel = profile.goal ? GOAL_LABELS[profile.goal] ?? 'Keep Fit' : 'Set Your Goal';
  const bmi = useMemo(() => getBmi(profile), [profile]);
  const bmiBand = useMemo(() => bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese', [bmi]);

  // Display ratios for the activity rings (pure presentation of the live store).
  const burnRatio = calorieGoal > 0 ? Math.min(1, caloriesBurned / calorieGoal) : 0;
  const stepsRatio = stepsGoal > 0 ? Math.min(1, steps / stepsGoal) : 0;
  const waterRatio = waterGoalMl > 0 ? waterMl / waterGoalMl : 0;

  const goalRows = useMemo(() => [
    {label: 'Primary Goal', value: goalLabel},
    {
      label: 'Training Days',
      value: profile.workoutFrequency ? `${profile.workoutFrequency} days / week` : 'Not set',
    },
    {
      label: 'Target Weight',
      value: profile.targetWeightKg ? `${Math.round(profile.targetWeightKg)} kg` : 'Not set',
    },
  ], [goalLabel, profile.workoutFrequency, profile.targetWeightKg]);

  const planRows = useMemo(() => [
    {label: 'Fitness Level', value: profile.fitnessLevel ?? profile.experience ?? 'Not set'},
    {
      label: 'Daily Activity',
      value: profile.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel : 'Not set',
    },
    {
      label: 'Focus Areas',
      value: profile.focusAreas?.length ? profile.focusAreas.join(', ') : 'Not set',
    },
    {
      label: 'Injuries',
      value: profile.injuries?.filter(item => item !== 'None').length
        ? profile.injuries.filter(item => item !== 'None').join(', ')
        : 'None',
    },
  ], [profile.fitnessLevel, profile.experience, profile.activityLevel, profile.focusAreas, profile.injuries]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear all local MMKV state
            appStorage.clearAll();
          } catch {}
          try {
            if (isSupabaseConfigured()) {
              await signOut();
            }
          } catch {}
          onSignOut?.();
        },
      },
    ]);
  }, [onSignOut]);

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Large title header ─────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Athlete Profile</Text>
          <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.8}
            onPress={() => navigate?.('notifications')}>
            <Icon name="notifications-outline" size={20} color={ATHLEO_COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.8}
            onPress={() => navigate?.('settings')}>
            <Icon name="settings-outline" size={20} color={ATHLEO_COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Identity card ──────────────────────────────────────────────── */}
      <AppCard style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            {profile.avatarUrl ? (
              <Image source={{uri: profile.avatarUrl}} style={styles.avatar} />
            ) : (
              <Image source={require('../assets/images/coach_leo.jpg')} style={styles.avatar} />
            )}
          </View>
          <TouchableOpacity
            style={styles.avatarBadge}
            activeOpacity={0.85}
            onPress={() => navigate?.('editProfile')}>
            <Icon name="camera" size={13} color={ATHLEO_COLORS.background} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroGoal} animate delay={60}>{goalLabel}</Text>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Icon name="flash" size={11} color={ATHLEO_COLORS.accent} />
            <Text style={styles.chipText}>Active</Text>
          </View>
          <View style={styles.chipSoft}>
            <Text style={styles.chipSoftText}>
              {streak > 0 ? `${streak}-Day Streak` : 'Start Your Streak'}
            </Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{streak}</Text>
            <Text style={styles.heroStatKey}>Streak</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{steps.toLocaleString()}</Text>
            <Text style={styles.heroStatKey}>Steps</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{workoutsToday}</Text>
            <Text style={styles.heroStatKey}>Workouts</Text>
          </View>
        </View>
      </AppCard>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <PressableScale style={styles.primaryCta} onPress={() => navigate?.('editProfile')}>
        <Icon name="create-outline" size={18} color={ATHLEO_COLORS.background} />
        <Text style={styles.primaryCtaText}>Edit Profile</Text>
      </PressableScale>

      <View style={styles.quickRow}>
        <PressableScale style={styles.quickBtn} onPress={() => navigate?.('settings')}>
          <Icon name="settings-outline" size={17} color={ATHLEO_COLORS.text} />
          <Text style={styles.quickBtnText}>Settings</Text>
        </PressableScale>
        <PressableScale style={styles.quickBtn} onPress={() => navigate?.('notifications')}>
          <Icon name="notifications-outline" size={17} color={ATHLEO_COLORS.text} />
          <Text style={styles.quickBtnText}>Alerts</Text>
        </PressableScale>
      </View>

      {/* ── Today at a glance ──────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Today</Text>
      <AppCard style={styles.activityCard}>
        <AppleActivityRings
          size={168}
          move={{
            ratio: burnRatio,
            current: caloriesBurned,
            target: calorieGoal,
            unit: 'kcal',
            label: 'Burn',
            color: '#FF9F0A',
          }}
          exercise={{
            ratio: stepsRatio,
            current: steps,
            target: stepsGoal,
            unit: 'steps',
            label: 'Steps',
            color: '#B8FF4D',
          }}
          stand={{
            ratio: waterRatio,
            current: Math.round(waterMl / 100) / 10,
            target: Math.round(waterGoalMl / 100) / 10,
            unit: 'L',
            label: 'Hydrate',
            color: '#5AC8FF',
          }}
        />
      </AppCard>

      {/* ── Body metrics ───────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Body</Text>
      <View style={styles.metricsRow}>
        <AppCard style={styles.metricTile}>
          <Text style={styles.metricLabel}>Height</Text>
          <Text style={styles.metricValue}>
            {Math.round(profile.heightCm)}<Text style={styles.metricUnit}> cm</Text>
          </Text>
        </AppCard>
        <AppCard style={styles.metricTile}>
          <Text style={styles.metricLabel}>Weight</Text>
          <Text style={styles.metricValue}>
            {Math.round(profile.weightKg)}<Text style={styles.metricUnit}> kg</Text>
          </Text>
        </AppCard>
        <AppCard style={styles.metricTile}>
          <Text style={styles.metricLabel}>BMI</Text>
          <Text style={styles.metricValue}>{bmi.toFixed(1)}</Text>
          <Text style={styles.metricHint} numberOfLines={1}>{bmiBand}</Text>
        </AppCard>
      </View>

      {/* ── Goals ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Goals</Text>
      <AppCard style={styles.infoCard}>
        {goalRows.map((row, index) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            first={index === 0}
            valueAccent
          />
        ))}
      </AppCard>

      {/* ── Plan snapshot — read straight from the onboarding answers ──── */}
      <Text style={styles.sectionLabel}>Your Plan</Text>
      <AppCard style={styles.infoCard}>
        {planRows.map((row, index) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            first={index === 0}
          />
        ))}
        <PressableScale
          style={styles.planFooter}
          onPress={() => navigate?.('editProfile')}>
          <Text style={styles.planFooterText}>Update these answers</Text>
          <Icon name="chevron-forward" size={15} color={ATHLEO_COLORS.accent} />
        </PressableScale>
      </AppCard>

      {/* ── XP & Levels ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Progress</Text>
      <ProfileXPPanel />

      {/* ── Explore ────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Explore</Text>
      <View style={styles.featureGrid}>
        {featureTiles.map(tile => (
          <PressableScale
            key={tile.key}
            style={styles.featureTile}
            onPress={() => navigate?.(tile.key)}>
            <View
              style={[
                styles.featureIcon,
                {backgroundColor: `${tile.color}1F`, borderColor: `${tile.color}55`},
              ]}>
              <Icon name={tile.icon} size={20} color={tile.color} />
            </View>
            <Text style={styles.featureLabel} numberOfLines={2}>{tile.label}</Text>
          </PressableScale>
        ))}
      </View>

      {/* ── Sign Out ───────────────────────────────────────────────────── */}
      <PressableScale style={styles.signOutRow} onPress={handleSignOut}>
        <Icon name="log-out-outline" size={18} color={ATHLEO_COLORS.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </PressableScale>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING + 16, gap: ATHLEO_SPACING.md},

  /* Header */
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'},
  headerCopy: {flex: 1, paddingRight: 12},
  eyebrow: {
    color: ATHLEO_COLORS.muted,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.7,
  },
  title: {color: ATHLEO_COLORS.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5},
  headerActions: {flexDirection: 'row', gap: 8},
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(13,44,25,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },

  /* Identity card */
  heroCard: {alignItems: 'center', paddingVertical: 22, borderRadius: 24},
  avatarWrap: {width: 104, height: 104, alignItems: 'center', justifyContent: 'center'},
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ATHLEO_COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 0},
    elevation: 6,
  },
  avatar: {width: 92, height: 92, borderRadius: 46},
  avatarFallback: {
    backgroundColor: ATHLEO_COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {color: ATHLEO_COLORS.accent, fontSize: 34, fontWeight: '800'},
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ATHLEO_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: ATHLEO_COLORS.background,
  },
  heroGoal: {
    color: ATHLEO_COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    letterSpacing: -0.2,
  },
  chipRow: {flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center'},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ATHLEO_COLORS.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {color: ATHLEO_COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase'},
  chipSoft: {
    backgroundColor: ATHLEO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  chipSoftText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase'},
  heroDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: ATHLEO_COLORS.hairline,
    marginTop: 18,
    marginBottom: 14,
    opacity: 0.7,
  },
  heroStats: {flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center'},
  heroStat: {flex: 1, alignItems: 'center'},
  heroStatValue: {
    color: ATHLEO_COLORS.text,
    fontFamily: ATHLEO_FAMILY.metricBold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  heroStatKey: {
    color: ATHLEO_COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 5,
    opacity: 0.75,
  },
  heroStatDivider: {width: 1, height: 30, backgroundColor: ATHLEO_COLORS.hairline, opacity: 0.7},

  /* Actions */
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: ATHLEO_COLORS.accent,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 0},
    elevation: 6,
  },
  primaryCtaText: {color: ATHLEO_COLORS.background, fontWeight: '900', fontSize: 16, letterSpacing: 0.4},
  quickRow: {flexDirection: 'row', gap: 10},
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(13,44,25,0.92)',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  quickBtnText: {color: ATHLEO_COLORS.text, fontWeight: '700', fontSize: 14},

  /* Section label */
  sectionLabel: {
    color: ATHLEO_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 6,
    marginLeft: 6,
    marginBottom: -6,
    opacity: 0.7,
  },

  /* Activity rings */
  activityCard: {paddingVertical: 22, paddingHorizontal: 16, borderRadius: 24},

  /* Body metrics */
  metricsRow: {flexDirection: 'row', gap: 10},
  metricTile: {flex: 1, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center'},
  metricLabel: {
    color: ATHLEO_COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  metricValue: {
    color: ATHLEO_COLORS.text,
    fontFamily: ATHLEO_FAMILY.metricBold,
    fontSize: 22,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  metricUnit: {fontFamily: ATHLEO_FAMILY.metric, fontSize: 12, color: ATHLEO_COLORS.muted},
  metricHint: {color: ATHLEO_COLORS.accent, fontSize: 11, fontWeight: '700', marginTop: 6, letterSpacing: 0.4},

  /* Grouped list */
  infoCard: {padding: 0, borderRadius: 20},
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 52,
  },
  infoRowTop: {borderTopWidth: 1, borderTopColor: ATHLEO_COLORS.hairline},
  infoLabel: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '600', flexShrink: 0},
  infoRight: {flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '60%'},
  infoValue: {color: ATHLEO_COLORS.muted, fontSize: 14, fontWeight: '700', textAlign: 'right'},
  infoValueAccent: {color: ATHLEO_COLORS.accent},
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: ATHLEO_COLORS.hairline,
  },
  planFooterText: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '700'},

  /* Explore grid */
  featureGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10},
  featureTile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(13,44,25,0.92)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureLabel: {color: ATHLEO_COLORS.text, fontSize: 12.5, fontWeight: '700', flex: 1},

  /* Sign out */
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,90,95,0.07)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,90,95,0.22)',
    marginTop: 4,
  },
  signOutText: {color: ATHLEO_COLORS.danger, fontWeight: '700', fontSize: 14},
});
