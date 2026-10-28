import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {useGlassScrollHandler} from '../components/GlassNavigationBar';
import {AppleActivityRings} from '../components/AppleActivityRings';
import {SatisfyingEnergyFlowChart} from '../components/SatisfyingEnergyFlowChart';
import {WeeklyConsistencyStrip} from '../components/WeeklyConsistencyStrip';
import {ATHLEO_COLORS, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';
import {
  getSteps,
  getCaloriesConsumed,
  getCaloriesBurned,
  getWaterMl,
  getCalorieGoal,
  getWaterGoalMl,
  getStepsGoal,
  getStreak,
  resetIfNewDay,
  subscribeAll,
  addWaterMl,
} from '../services/dailyTracker';
import {getCachedDisplayName} from '../services/profileSync';
import {triggerHaptic} from '../services/haptics';
import {getCachedWeeklyPlan} from '../services/workoutScheduleService';

interface DashboardScreenProps {
  navigate?: (tab: TabKey) => void;
}

function getDynamicGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {return 'Good Morning';}
  if (hour >= 12 && hour < 17) {return 'Good Afternoon';}
  if (hour >= 17 && hour < 22) {return 'Good Evening';}
  return 'Rest Up';
}

export function DashboardScreen({navigate}: DashboardScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [steps, setSteps] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [_caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [streak, setStreak] = useState(0);
  const [displaySteps, setDisplaySteps] = useState(0);
  const [displayBurn, setDisplayBurn] = useState(0);

  const calorieGoal = useRef(getCalorieGoal()).current;
  const waterGoalMl = useRef(getWaterGoalMl()).current;
  const stepGoal = useRef(getStepsGoal()).current;
  const displayName = useRef(getCachedDisplayName()).current;
  const greeting = useRef(getDynamicGreeting()).current;

  const burnRatio = Math.min(100, calorieGoal > 0 ? (caloriesBurned / calorieGoal) * 100 : 0);
  const stepsRatio = Math.min(100, (steps / stepGoal) * 100);
  const waterRatio = Math.min(100, waterGoalMl > 0 ? (waterMl / waterGoalMl) * 100 : 0);
  const readinessRatio = Math.min(100, Math.round(62 + stepsRatio * 0.18 + waterRatio * 0.12 + Math.min(8, streak)));

  const todayPlan = useMemo(() => {
    try {
      const plan = getCachedWeeklyPlan();
      const jsDay = new Date().getDay();
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      return plan.days[idx] || plan.days[0];
    } catch {
      return null;
    }
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const isMountedRef = useRef(true);

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useGlassScrollHandler(scrollY);

  const refreshAll = useCallback(() => {
    if (!isMountedRef.current) {return;}
    setSteps(getSteps());
    setCaloriesBurned(getCaloriesBurned());
    setCaloriesConsumed(getCaloriesConsumed());
    setWaterMl(getWaterMl());
    setStreak(getStreak());
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    resetIfNewDay();
    refreshAll();

    const unsubscribe = subscribeAll(refreshAll);

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, {toValue: 1, duration: 420, useNativeDriver: true}),
          Animated.timing(slideAnim, {toValue: 0, duration: 450, useNativeDriver: true}),
        ]).start();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth odometer count-up animation
  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 750;
    const initialSteps = displaySteps;
    const targetSteps = steps;
    const initialBurn = displayBurn;
    const targetBurn = caloriesBurned;

    let frameId: number;
    const stepAnim = (timestamp: number) => {
      if (!startTimestamp) { startTimestamp = timestamp; }
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplaySteps(Math.round(initialSteps + (targetSteps - initialSteps) * ease));
      setDisplayBurn(Math.round(initialBurn + (targetBurn - initialBurn) * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(stepAnim);
      }
    };
    frameId = requestAnimationFrame(stepAnim);
    return () => cancelAnimationFrame(frameId);
  // displaySteps/displayBurn are read only as the tween's start point; adding them
  // as deps would restart the count-up on every animation frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, caloriesBurned]);

  // burnRatio / stepsRatio / waterRatio / readinessRatio — defined above near useState

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.content]}>
        <View style={[styles.skeletonBlock, styles.skelWidth120]} />
        <View style={[styles.skeletonBlock, styles.skelWidth250]} />
        <View style={[styles.skeletonBlock, styles.skelWidth100H160]} />
        <View style={[styles.skeletonBlock, styles.skelWidth100H200]} />
      </View>
    );
  }

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.screen}>
      <SmoothScrollView
        style={[styles.scroll, {opacity: fadeAnim}]}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}>

        {/* ── 1. Clean Glass Header ── */}
        <Animated.View style={[styles.headerRow, {transform: [{translateY: slideAnim}]}]}>
          <View style={styles.headerCopy}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>ATHLEO</Text>
              </View>
              <Text style={styles.todayDateText}>{todayDateStr.toUpperCase()}</Text>
            </View>

            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}, {displayName.split(' ')[0]}
            </Text>
            <Text style={styles.subGreeting}>
              {stepsRatio > 70
                ? '🔥 High performance day! You are crushing your goals.'
                : '⚡ Readiness is prime. Ready for today’s session.'}
            </Text>
          </View>

          {/* Streak Flame Pill */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('impactLight');
              navigate?.('challenges');
            }}
            style={styles.streakPill}>
            <Icon name="flame" size={16} color="#FF9F0A" />
            <Text style={styles.streakText}>{streak}d</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 2. Weekly 7-Day Consistency Habit Heatmap ── */}
        <WeeklyConsistencyStrip
          currentStreak={streak}
          onPressDay={() => {
            navigate?.('challenges');
          }}
        />

        {/* ── 2. Unified Hero Biometric Pulse Hub ── */}
        <View style={styles.heroBiometricCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Icon name="pulse" size={20} color="#B8FF4D" />
              <Text style={styles.heroCardTitle}>Daily Performance</Text>
            </View>
            <View style={styles.readinessPill}>
              <View style={styles.readinessDot} />
              <Text style={styles.readinessScoreText}>{readinessRatio}% Energy</Text>
            </View>
          </View>

          <View style={styles.biometricsMainRow}>
            {/* Activity Ring Centerpiece */}
            <View style={styles.ringContainer}>
              <AppleActivityRings
                size={120}
                hideLegend
                move={{
                  ratio: burnRatio / 100,
                  current: caloriesBurned,
                  target: calorieGoal,
                  unit: 'kcal',
                  label: 'Burn',
                  color: '#FF9F0A',
                }}
                exercise={{
                  ratio: Math.min(1, stepsRatio / 100),
                  current: steps,
                  target: stepGoal,
                  unit: 'steps',
                  label: 'Steps',
                  color: '#B8FF4D',
                }}
                stand={{
                  ratio: waterRatio / 100,
                  current: Math.round(waterMl / 100) / 10,
                  target: Math.round(waterGoalMl / 100) / 10,
                  unit: 'L',
                  label: 'Hydrate',
                  color: '#5AC8FF',
                }}
              />
            </View>

            {/* 3 Prominent Stat Items */}
            <View style={styles.vitalsList}>
              {/* Steps */}
              <TouchableOpacity
                style={styles.vitalRow}
                activeOpacity={0.75}
                onPress={() => {
                  triggerHaptic('selection');
                  navigate?.('pedometer');
                }}>
                <View style={[styles.vitalIconBadge, {backgroundColor: 'rgba(184, 255, 77, 0.18)'}]}>
                  <Icon name="footsteps" size={17} color="#B8FF4D" />
                </View>
                <View style={styles.vitalTextWrap}>
                  <Text style={styles.vitalTitle}>Steps</Text>
                  <Text style={styles.vitalValue}>
                    {displaySteps.toLocaleString()}{' '}
                    <Text style={styles.vitalTarget}>/ {stepGoal.toLocaleString()}</Text>
                  </Text>
                </View>
                <Text style={styles.vitalPercent}>{Math.round(stepsRatio)}%</Text>
              </TouchableOpacity>

              {/* Calories Burned */}
              <TouchableOpacity
                style={styles.vitalRow}
                activeOpacity={0.75}
                onPress={() => {
                  triggerHaptic('selection');
                  navigate?.('activity');
                }}>
                <View style={[styles.vitalIconBadge, {backgroundColor: 'rgba(255, 159, 10, 0.18)'}]}>
                  <Icon name="flame" size={17} color="#FF9F0A" />
                </View>
                <View style={styles.vitalTextWrap}>
                  <Text style={styles.vitalTitle}>Active Burn</Text>
                  <Text style={styles.vitalValue}>
                    {displayBurn.toLocaleString()}{' '}
                    <Text style={styles.vitalTarget}>/ {calorieGoal} kcal</Text>
                  </Text>
                </View>
                <Text style={[styles.vitalPercent, {color: '#FF9F0A'}]}>{Math.round(burnRatio)}%</Text>
              </TouchableOpacity>

              {/* Hydration with instant +250ml tap */}
              <View style={styles.vitalRow}>
                <TouchableOpacity
                  style={styles.vitalRowTap}
                  activeOpacity={0.75}
                  onPress={() => {
                    triggerHaptic('selection');
                  }}>
                  <View style={[styles.vitalIconBadge, {backgroundColor: 'rgba(90, 200, 255, 0.18)'}]}>
                    <Icon name="water" size={17} color="#5AC8FF" />
                  </View>
                  <View style={styles.vitalTextWrap}>
                    <Text style={styles.vitalTitle}>Hydration</Text>
                    <Text style={styles.vitalValue}>
                      {(waterMl / 1000).toFixed(1)}L{' '}
                      <Text style={styles.vitalTarget}>/ {(waterGoalMl / 1000).toFixed(1)}L</Text>
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Instant +250ml Button */}
                <TouchableOpacity
                  style={styles.quickAddWaterButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('impactMedium');
                    const updated = addWaterMl(250);
                    setWaterMl(updated);
                  }}>
                  <Icon name="add" size={13} color="#5AC8FF" />
                  <Text style={styles.quickAddWaterText}>250ml</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── 3. Weekly Energy Velocity Flow Chart (Interactive Gifted Chart) ── */}
        <SatisfyingEnergyFlowChart
          currentSteps={steps}
          currentCalories={caloriesBurned}
          currentReadiness={readinessRatio}
        />

        {/* ── 4. Today's Mission / Smart Workout Hero Cockpit Card ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            triggerHaptic('impactLight');
            navigate?.('gym');
          }}
          style={styles.workoutCockpitCard}>
          <Image
            source={require('../assets/images/workout_hero_banner.jpg')}
            style={styles.workoutHeroBg}
            resizeMode="cover"
          />
          <View style={styles.workoutHeroOverlay} />
          <View style={styles.workoutGlow} />
          <View style={styles.workoutContent}>
            <View style={styles.workoutTopRow}>
              <View style={styles.liveBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveBadgeText}>TODAY'S MISSION</Text>
              </View>
              <Text style={styles.workoutDuration}>
                {todayPlan ? `${todayPlan.durationMin} MIN • ${todayPlan.intensity.toUpperCase()}` : '45 MIN • PUSH'}
              </Text>
            </View>

            <Text style={styles.workoutName}>
              {todayPlan?.focus || 'Smart Workout Session'}
            </Text>
            <Text style={styles.workoutDetails}>
              {todayPlan
                ? `${todayPlan.targetMuscles.join(' & ')} • ~${todayPlan.estimatedKcal} kcal burn • ${todayPlan.exercises.length} movements`
                : 'Hypertrophy & Core • Push Intensity • 420 kcal burn target'}
            </Text>

            <View style={styles.workoutActionsRow}>
              <View style={styles.startWorkoutButton}>
                <Icon name="play" size={16} color="#08140B" />
                <Text style={styles.startWorkoutText}>Start Workout</Text>
              </View>

              <TouchableOpacity
                style={styles.aiCoachPill}
                activeOpacity={0.75}
                onPress={() => {
                  triggerHaptic('selection');
                  navigate?.('ai');
                }}>
                <Icon name="sparkles" size={14} color="#B8FF4D" />
                <Text style={styles.aiCoachText}>Ask AI Coach</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── 5. Clean 4-Item Quick Access Shortcuts ── */}
        <View style={styles.shortcutsRow}>
          {[
            {key: 'gym' as TabKey, label: 'Smart Gym', icon: 'flash-outline', color: ATHLEO_COLORS.accent},
            {key: 'outdoor' as TabKey, label: 'Outdoor Run', icon: 'walk-outline', color: '#30D158'},
            {key: 'pedometer' as TabKey, label: 'Steps', icon: 'footsteps-outline', color: '#0A84FF'},
            {key: 'community' as TabKey, label: 'Social', icon: 'people-outline', color: '#BF5AF2'},
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.shortcutTile}
              activeOpacity={0.75}
              onPress={() => {
                triggerHaptic('selection');
                navigate?.(item.key);
              }}>
              <View
                style={[
                  styles.shortcutIconWrap,
                  {backgroundColor: `${item.color}22`, borderColor: `${item.color}60`},
                ]}>
                <Icon name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </SmoothScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#071A0E',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: TAB_BAR_BOTTOM_PADDING + 40,
    gap: 14,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  headerCopy: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  brandBadge: {
    backgroundColor: 'rgba(184, 255, 77, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.45)',
  },
  brandBadgeText: {
    color: '#B8FF4D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  todayDateText: {
    color: '#D4FFB2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subGreeting: {
    color: '#D4FFB2',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 18,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F3820',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 10, 0.45)',
    shadowColor: '#FF9F0A',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  streakText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  // ── Unified Hero Biometric Pulse Hub ──
  heroBiometricCard: {
    backgroundColor: 'rgba(12, 38, 22, 0.90)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    borderTopColor: 'rgba(184, 255, 77, 0.60)',
    padding: 18,
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  readinessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(184, 255, 77, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  readinessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B8FF4D',
  },
  readinessScoreText: {
    color: '#B8FF4D',
    fontSize: 12,
    fontWeight: '900',
  },
  biometricsMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalsList: {
    flex: 1,
    gap: 10,
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 26, 14, 0.70)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vitalRowTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  vitalTextWrap: {
    flex: 1,
  },
  vitalTitle: {
    color: '#D4FFB2',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vitalValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  vitalTarget: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  vitalPercent: {
    color: '#B8FF4D',
    fontSize: 13,
    fontWeight: '900',
  },
  quickAddWaterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(90, 200, 255, 0.16)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 255, 0.45)',
  },
  quickAddWaterText: {
    color: '#5AC8FF',
    fontSize: 11,
    fontWeight: '900',
  },

  // ── Today's Mission / Smart Workout Hero Cockpit Card ──
  workoutCockpitCard: {
    backgroundColor: '#0F3820',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#B8FF4D',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  workoutHeroBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.42,
  },
  workoutHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 26, 14, 0.70)',
  },
  workoutGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(184, 255, 77, 0.15)',
  },
  workoutContent: {
    position: 'relative',
    zIndex: 2,
  },
  workoutTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(184, 255, 77, 0.20)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B8FF4D',
  },
  liveBadgeText: {
    color: '#B8FF4D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  workoutDuration: {
    color: '#D4FFB2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  workoutDetails: {
    color: '#E0FFE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
  },
  workoutActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startWorkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#B8FF4D',
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.40,
    shadowRadius: 10,
    elevation: 8,
  },
  startWorkoutText: {
    color: '#08140B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  aiCoachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8, 24, 14, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(184, 255, 77, 0.45)',
  },
  aiCoachText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── 5. Clean 4-Item Quick Access Shortcuts ──
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutTile: {
    flex: 1,
    backgroundColor: 'rgba(12, 38, 22, 0.85)',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(184, 255, 77, 0.25)',
  },
  shortcutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ── Skeletons ──
  skeletonBlock: {
    backgroundColor: '#0F3820',
    borderRadius: 14,
  },
  skelWidth120: {width: 120, height: 20},
  skelWidth250: {width: 250, height: 36, marginTop: 8},
  skelWidth100H160: {width: '100%', height: 160, marginTop: 20},
  skelWidth100H200: {width: '100%', height: 200, marginTop: 14},
});
