/**
 * SmartGymScreen.tsx — live gym cockpit.
 *
 * The session is built from the user's own onboarding answers: the focus areas
 * they picked decide which lifts are queued, and their experience level decides
 * the set/rep prescription. Each exercise ships the same slow-motion form loop
 * as the Workout Library, so the cockpit doubles as a form reference
 * between sets.
 *
 * Every number written back goes through dailyTracker (`addCaloriesBurned`,
 * `incrementWorkoutsCompleted`), which mirrors into the 90-day history — the
 * earlier version wrote a flat "1 workout" straight into the history on *every*
 * logged set, resetting the day's total instead of counting up.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedExercisePreview} from '../components/AnimatedExercisePreview';
import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {type FlowExerciseRecord, useFlowExerciseDataset} from '../data/flowExerciseDataset';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {
  addCaloriesBurned,
  flushMirrorToHistory,
  incrementWorkoutsCompleted,
} from '../services/dailyTracker';
import {getWeeklyReport, type WeeklyReport} from '../services/progressTracker';
import {getUserProfile} from '../services/userProfile';
import {workoutTimerService} from '../services/workoutTimerService';

let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  ReactNativeHapticFeedback = null;
}

const triggerHaptic = (type: string = 'impactLight') => {
  try {
    ReactNativeHapticFeedback?.trigger(type, {enableVibrateFallback: true, ignoreAndroidSystemSettings: false});
  } catch {}
};

// ─── Session builder ──────────────────────────────────────────────────────────

type SessionExercise = {
  record: FlowExerciseRecord;
  /** Prescribed number of working sets. */
  sets: number;
  repsTarget: number;
};

/** Dataset targets that answer each onboarding focus area. */
const FOCUS_TARGETS: Record<string, string[]> = {
  arm: ['triceps', 'biceps', 'forearms'],
  shoulder: ['delts', 'traps'],
  chest: ['pectorals', 'serratus'],
  abs: ['abs', 'waist'],
  leg: ['quads', 'glutes', 'hamstrings', 'calves', 'adductors'],
  'full-body': ['cardiovascular', 'quads', 'pectorals', 'lats'],
};

const PRESCRIPTION: Record<string, {sets: number; reps: number}> = {
  novice: {sets: 3, reps: 12},
  beginner: {sets: 3, reps: 12},
  intermediate: {sets: 4, reps: 10},
  advanced: {sets: 4, reps: 8},
};

const MAX_SESSION_EXERCISES = 5;

/**
 * Deterministically builds today's session from the user's profile.
 * Only animated exercises are eligible — the cockpit always shows the form.
 */
function buildSessionPlan(dataset: FlowExerciseRecord[]): SessionExercise[] {
  let focusAreas: string[] = ['full-body'];
  let experience = 'beginner';

  try {
    const profile = getUserProfile();
    if (profile.focusAreas && profile.focusAreas.length > 0) {
      focusAreas = profile.focusAreas;
    }
    experience = profile.fitnessLevel ?? profile.experience ?? 'beginner';
  } catch {
    /* fall through to the defaults */
  }

  const prescription = PRESCRIPTION[experience] ?? PRESCRIPTION.beginner;

  // All exercises are eligible — the RepDB dataset ships a still for every
  // movement, so nothing has to be filtered out on media availability.
  const pool = dataset.length > 0 ? dataset : [];

  const picks: FlowExerciseRecord[] = [];
  const seen = new Set<string>();

  focusAreas.forEach(area => {
    if (picks.length >= MAX_SESSION_EXERCISES) {return;}
    const keywords = FOCUS_TARGETS[area] ?? FOCUS_TARGETS['full-body'];
    pool.forEach(exercise => {
      if (picks.length >= MAX_SESSION_EXERCISES || seen.has(exercise.id)) {return;}
      const haystack = `${exercise.target ?? ''} ${exercise.bodyPart ?? ''}`.toLowerCase();
      if (keywords.some(keyword => haystack.includes(keyword))) {
        seen.add(exercise.id);
        picks.push(exercise);
      }
    });
  });

  // A single-focus answer (e.g. "Abs") can under-fill the queue — top it up so a
  // session is never a one-lift workout.
  if (picks.length < 2) {
    pool.forEach(exercise => {
      if (picks.length >= MAX_SESSION_EXERCISES || seen.has(exercise.id)) {return;}
      seen.add(exercise.id);
      picks.push(exercise);
    });
  }

  return picks.map(record => ({record, sets: prescription.sets, repsTarget: prescription.reps}));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Rounded starting load for a lift, derived from the user's own body weight. */
function defaultLoadFor(weightKg: number): number {
  const base = weightKg > 0 ? weightKg : 72;
  return Math.max(10, Math.round((base * 0.5) / 2.5) * 2.5);
}

/**
 * Rough energy cost of a working set. Volume-load (kg lifted) is the only real
 * input available without a heart-rate strap, so it scales linearly with it.
 */
function kcalForSet(reps: number, weightKg: number): number {
  return Math.round(reps * weightKg * 0.03 * 10) / 10;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

type SetLog = {
  setNum: number;
  reps: number;
  weightKg: number;
};

export function SmartGymScreen() {
  const dataset = useFlowExerciseDataset();

  // Build plan lazily — dataset starts as [] on first render (async load).
  // We rebuild whenever it becomes non-empty for the first time.
  const [plan, setPlan] = useState<SessionExercise[]>([]);
  useEffect(() => {
    if (dataset.length > 0 && plan.length === 0) {
      setPlan(buildSessionPlan(dataset));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [reps, setReps] = useState(() => plan[0]?.repsTarget ?? 10);
  const [weightKg, setWeightKg] = useState(() => defaultLoadFor(getUserProfile().weightKg));
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [restSeconds, setRestSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [workoutPaused, setWorkoutPaused] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [sessionKcal, setSessionKcal] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);

  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const exercise = plan[exerciseIdx];
  const totalSetsInSession = useMemo(
    () => plan.reduce((sum, item) => sum + item.sets, 0),
    [plan],
  );
  const loggedSetCount = useMemo(
    () => plan.slice(0, exerciseIdx).reduce((sum, item) => sum + item.sets, 0) + setLogs.length,
    [plan, exerciseIdx, setLogs.length],
  );

  // ── Workout elapsed timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!workoutStarted || workoutPaused) {
      if (workoutIntervalRef.current) {clearInterval(workoutIntervalRef.current);}
      return undefined;
    }
    workoutIntervalRef.current = setInterval(() => {
      setWorkoutSeconds(s => s + 1);
    }, 1000);
    return () => {
      if (workoutIntervalRef.current) {clearInterval(workoutIntervalRef.current);}
    };
  }, [workoutStarted, workoutPaused]);

  // ── Rest countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isResting || restSeconds <= 0) {
      if (restIntervalRef.current) {clearInterval(restIntervalRef.current);}
      return undefined;
    }
    restIntervalRef.current = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          setIsResting(false);
          triggerHaptic('notificationSuccess');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (restIntervalRef.current) {clearInterval(restIntervalRef.current);}
    };
  }, [isResting, restSeconds]);

  // ── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1.05, duration: 900, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 1, duration: 900, useNativeDriver: true}),
      ]),
    );
    if (isResting) {anim.start();} else {anim.stop(); pulseAnim.setValue(1);}
    return () => anim.stop();
  }, [isResting, pulseAnim]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRest = useCallback((seconds: number, exerciseName: string, nextSet: number, totalSets: number) => {
    setIsResting(true);
    setRestSeconds(seconds);
    workoutTimerService.startRest(seconds, exerciseName, nextSet, totalSets);
  }, []);

  const completeWorkout = useCallback(() => {
    triggerHaptic('notificationSuccess');
    workoutTimerService.stop();
    setIsResting(false);
    setRestSeconds(0);
    setWorkoutStarted(false);
    setWorkoutFinished(true);
    // A finished session is exactly one completed workout — the day's total
    // counts up instead of being overwritten.
    incrementWorkoutsCompleted();
    flushMirrorToHistory();
  }, []);

  const goToExercise = useCallback((index: number) => {
    const next = plan[index];
    if (!next) {return;}
    setExerciseIdx(index);
    setCurrentSet(1);
    setSetLogs([]);
    setReps(next.repsTarget);
  }, [plan]);

  const logSet = useCallback(() => {
    if (!exercise) {return;}
    triggerHaptic('impactMedium');

    const log: SetLog = {setNum: currentSet, reps, weightKg};
    const kcal = kcalForSet(reps, weightKg);
    setSetLogs(prev => [...prev, log]);
    setSessionKcal(prev => Math.round((prev + kcal) * 10) / 10);
    addCaloriesBurned(kcal);

    if (currentSet < exercise.sets) {
      const nextSet = currentSet + 1;
      setCurrentSet(nextSet);
      startRest(90, exercise.record.name, nextSet, exercise.sets);
      return;
    }

    if (exerciseIdx < plan.length - 1) {
      // Cue the transition into the next lift with a longer rest.
      startRest(120, plan[exerciseIdx + 1].record.name, 1, plan[exerciseIdx + 1].sets);
      goToExercise(exerciseIdx + 1);
      return;
    }

    completeWorkout();
  }, [
    exercise,
    currentSet,
    reps,
    weightKg,
    exerciseIdx,
    plan,
    startRest,
    goToExercise,
    completeWorkout,
  ]);

  const loadWeeklyReport = useCallback(() => {
    setWeeklyReport(getWeeklyReport());
    setShowReport(true);
  }, []);

  const totalVolume = setLogs.reduce((sum, log) => sum + log.reps * log.weightKg, 0);

  if (!exercise) {
    // Still loading — dataset hasn't arrived yet
    if (dataset.length === 0) {
      return (
        <View style={[styles.screen, styles.emptyScreen]}>
          <Icon name="barbell-outline" size={28} color={ATHLEO_COLORS.accent} />
          <Text style={styles.emptyTitle}>Loading exercises…</Text>
          <Text style={styles.emptyBody}>Setting up your workout session.</Text>
        </View>
      );
    }
    return (
      <View style={[styles.screen, styles.emptyScreen]}>
        <Icon name="barbell-outline" size={28} color={ATHLEO_COLORS.muted} />
        <Text style={styles.emptyTitle}>No exercises available</Text>
        <Text style={styles.emptyBody}>
          The exercise library could not be loaded, so there is nothing to run yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}>
            <Image
              source={require('../assets/images/weightlifting.png')}
              style={styles.headerGymIcon}
              resizeMode="contain"
            />
            <Text style={styles.eyebrow}>Smart Gym Mode</Text>
          </View>
          <Text style={styles.title}>{exercise.record.name}</Text>
        </View>
        {workoutStarted && (
          <View style={styles.elapsedPill}>
            <Icon name="time-outline" size={12} color={ATHLEO_COLORS.accent} />
            <Text style={styles.elapsedText}>{formatTime(workoutSeconds)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.exerciseMeta}>
        {exercise.record.target} • {exercise.record.equipment} • {exercise.sets} sets × {exercise.repsTarget}
      </Text>

      {/* ── Session progress ── */}
      <View style={styles.sessionBar}>
        <View style={styles.sessionTrack}>
          <View
            style={[
              styles.sessionFill,
              {width: `${Math.min(100, (loggedSetCount / Math.max(1, totalSetsInSession)) * 100)}%`},
            ]}
          />
        </View>
        <Text style={styles.sessionMeta}>
          {loggedSetCount}/{totalSetsInSession} sets • {sessionKcal} kcal
        </Text>
      </View>

      {/* ── Form reference ── */}
      <AppCard style={styles.cockpitCard}>
        <View style={styles.cockpitHeader}>
          <Icon name="body-outline" size={16} color={ATHLEO_COLORS.accent} />
          <Text style={styles.cockpitTitle}>Watch the form</Text>
          <Text style={styles.cockpitHint}>slow motion</Text>
        </View>
        <AnimatedExercisePreview exercise={exercise.record} large />
        {exercise.record.instructions.length > 0 && (
          <Text style={styles.formCue}>{exercise.record.instructions[0]}</Text>
        )}
      </AppCard>

      {/* ── Start / Pause ── */}
      {!workoutStarted && !workoutFinished && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            setWorkoutStarted(true);
            setWorkoutSeconds(0);
            workoutTimerService.startWorkout(exercise.record.name, currentSet, exercise.sets);
            triggerHaptic('impactHeavy');
          }}>
          <Icon name="play-circle" size={20} color={ATHLEO_COLORS.background} />
          <Text style={styles.startButtonText}>START WORKOUT</Text>
        </TouchableOpacity>
      )}

      {workoutStarted && (
        <TouchableOpacity
          style={[styles.startButton, workoutPaused && styles.pausedButton]}
          onPress={() => {
            const nextPaused = !workoutPaused;
            setWorkoutPaused(nextPaused);
            if (nextPaused) {workoutTimerService.pause();} else {workoutTimerService.resume();}
            triggerHaptic('impactLight');
          }}>
          <Icon name={workoutPaused ? 'play' : 'pause'} size={20} color={ATHLEO_COLORS.background} />
          <Text style={styles.startButtonText}>{workoutPaused ? 'RESUME' : 'PAUSE'}</Text>
        </TouchableOpacity>
      )}

      {/* ── Session summary ── */}
      {workoutFinished && (
        <AppCard style={styles.finishCard}>
          <Image
            source={require('../assets/images/weightlifting.png')}
            style={styles.finishImg}
            resizeMode="contain"
          />
          <Text style={styles.finishTitle}>Workout complete</Text>
          <View style={styles.finishGrid}>
            <View style={styles.finishStat}>
              <Text style={styles.finishValue}>{formatTime(workoutSeconds)}</Text>
              <Text style={styles.finishLabel}>Duration</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishValue}>{totalSetsInSession}</Text>
              <Text style={styles.finishLabel}>Sets</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishValue}>{sessionKcal}</Text>
              <Text style={styles.finishLabel}>kcal</Text>
            </View>
          </View>
          <Text style={styles.finishNote}>
            Saved to today's activity. Your weekly report and progress charts now include this session.
          </Text>
        </AppCard>
      )}

      {/* ── Rest Timer ── */}
      <Animated.View style={[styles.restCard, {transform: [{scale: isResting ? pulseAnim : 1}]}]}>
        <View style={styles.restHeader}>
          <Icon name="timer-outline" size={16} color={isResting ? ATHLEO_COLORS.accent : ATHLEO_COLORS.muted} />
          <Text style={[styles.restLabel, isResting && styles.restLabelActive]}>Rest Timer</Text>
          {isResting && <View style={styles.activeDot} />}
        </View>
        <Text style={[styles.restTime, isResting && styles.restTimeActive]}>{formatTime(restSeconds)}</Text>
        <View style={styles.restControls}>
          <TouchableOpacity
            style={styles.restBtn}
            onPress={() => {
              const newSecs = Math.max(0, restSeconds - 15);
              setRestSeconds(newSecs);
              workoutTimerService.startRest(newSecs, exercise.record.name, currentSet, exercise.sets);
              triggerHaptic('impactLight');
            }}>
            <Text style={styles.restBtnText}>-15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restBtn}
            onPress={() => {
              setIsResting(false);
              setRestSeconds(0);
              workoutTimerService.startWorkout(exercise.record.name, currentSet, exercise.sets);
              triggerHaptic('impactLight');
            }}>
            <Text style={styles.restBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restBtn}
            onPress={() => {
              const newSecs = restSeconds + 15;
              setRestSeconds(newSecs);
              workoutTimerService.startRest(newSecs, exercise.record.name, currentSet, exercise.sets);
              triggerHaptic('impactLight');
            }}>
            <Text style={styles.restBtnText}>+15s</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Current Set Card ── */}
      <AppCard style={styles.setCard}>
        <View style={styles.setCardHeader}>
          <Text style={styles.setCardTitle}>Set {currentSet} / {exercise.sets}</Text>
          <View style={styles.volumeBadge}>
            <Text style={styles.volumeText}>{totalVolume > 0 ? `${totalVolume} kg vol` : 'No sets yet'}</Text>
          </View>
        </View>

        <Text style={styles.metricLabel}>Weight (kg)</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity style={styles.counterBtn} onPress={() => {setWeightKg(w => Math.max(0, w - 2.5)); triggerHaptic('impactLight');}}>
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterVal}>{weightKg}</Text>
          <TouchableOpacity style={styles.counterBtn} onPress={() => {setWeightKg(w => w + 2.5); triggerHaptic('impactLight');}}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.metricLabel, {marginTop: 12}]}>Reps</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity style={styles.counterBtn} onPress={() => {setReps(r => Math.max(1, r - 1)); triggerHaptic('impactLight');}}>
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterVal}>{reps}</Text>
          <TouchableOpacity style={styles.counterBtn} onPress={() => {setReps(r => r + 1); triggerHaptic('impactLight');}}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logSetButton, isResting && styles.logSetButtonDisabled]}
          onPress={logSet}
          disabled={isResting || workoutFinished}>
          <Icon name="checkmark-circle" size={18} color={ATHLEO_COLORS.background} />
          <Text style={styles.logSetText}>{isResting ? 'Resting…' : 'LOG SET'}</Text>
        </TouchableOpacity>
      </AppCard>

      {/* ── Logged Sets ── */}
      {setLogs.length > 0 && (
        <AppCard style={styles.historyCard}>
          <Text style={styles.historyTitle}>Logged Sets</Text>
          {setLogs.map((log, i) => (
            <View key={i} style={styles.historyRow}>
              <View style={styles.historySetBadge}>
                <Text style={styles.historySetText}>S{log.setNum}</Text>
              </View>
              <Text style={styles.historyReps}>{log.reps} reps</Text>
              <Text style={styles.historyWeight}>{log.weightKg} kg</Text>
              <Text style={styles.historyVol}>{log.reps * log.weightKg} kg vol</Text>
              <Icon name="checkmark-circle" size={16} color={ATHLEO_COLORS.accent} />
            </View>
          ))}
        </AppCard>
      )}

      {/* ── Session Queue ── */}
      <AppCard style={styles.queueCard}>
        <Text style={styles.historyTitle}>Session Queue</Text>
        {plan.map((item, i) => (
          <TouchableOpacity
            key={item.record.id}
            disabled={workoutStarted}
            onPress={() => goToExercise(i)}
            style={[styles.queueRow, i === exerciseIdx && styles.queueRowActive]}>
            <View style={[styles.queueNum, i === exerciseIdx && styles.queueNumActive]}>
              <Text style={styles.queueNumText}>{i + 1}</Text>
            </View>
            <View style={styles.queueBody}>
              <Text style={[styles.queueName, i === exerciseIdx && styles.queueNameActive]}>
                {item.record.name}
              </Text>
              <Text style={styles.queueMeta}>
                {item.record.target} • {item.sets}×{item.repsTarget}
              </Text>
            </View>
            {i < exerciseIdx && <Icon name="checkmark-circle" size={18} color={ATHLEO_COLORS.accent} />}
            {i === exerciseIdx && <View style={styles.liveDot} />}
          </TouchableOpacity>
        ))}
        {workoutStarted && (
          <Text style={styles.queueLocked}>Start a new session to reorder the queue.</Text>
        )}
      </AppCard>

      {/* ── Weekly Report ── */}
      <AppCard style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <Icon name="bar-chart-outline" size={18} color={ATHLEO_COLORS.accent} />
          <Text style={styles.reportTitle}>Weekly Report</Text>
          <Switch
            value={showReport}
            onValueChange={val => {
              if (val) {loadWeeklyReport();} else {setShowReport(false);}
              triggerHaptic('impactLight');
            }}
            trackColor={{false: '#2A2A2E', true: 'rgba(184,255,77,0.45)'}}
            thumbColor={showReport ? ATHLEO_COLORS.accent : '#6B6E75'}
          />
        </View>

        {showReport && weeklyReport && (
          <View style={styles.reportBody}>
            <View style={styles.reportPeriodRow}>
              <Text style={styles.reportPeriod}>{weeklyReport.weekStart} → {weeklyReport.weekEnd}</Text>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeText}>{weeklyReport.weekGrade}</Text>
              </View>
            </View>
            <View style={styles.reportGrid}>
              {[
                {label: 'Workouts', value: String(weeklyReport.totalWorkouts), icon: 'barbell-outline'},
                {label: 'Avg Steps', value: weeklyReport.avgSteps.toLocaleString(), icon: 'footsteps-outline'},
                {label: 'Avg Calories', value: `${weeklyReport.avgCalories} kcal`, icon: 'nutrition-outline'},
                {label: 'Burned', value: `${weeklyReport.caloriesBurned} kcal`, icon: 'flame-outline'},
                {label: 'Avg Sleep', value: `${Math.floor(weeklyReport.avgSleep / 60)}h ${weeklyReport.avgSleep % 60}m`, icon: 'moon-outline'},
                {label: 'Weight', value: `${weeklyReport.weightChange > 0 ? '+' : ''}${weeklyReport.weightChange} kg`, icon: 'scale-outline'},
                {label: 'Streak', value: `${weeklyReport.streakDays} days`, icon: 'trophy-outline'},
              ].map(item => (
                <View key={item.label} style={styles.reportStat}>
                  <Icon name={item.icon} size={14} color={ATHLEO_COLORS.accent} />
                  <Text style={styles.reportStatValue}>{item.value}</Text>
                  <Text style={styles.reportStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            {weeklyReport.coachBlurb ? (
              <Text style={styles.reportBlurb}>{weeklyReport.coachBlurb}</Text>
            ) : null}
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 110, gap: 14},
  emptyScreen: {alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32},
  emptyTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  emptyBody: {color: ATHLEO_COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12},
  headerCopy: {flex: 1},
  eyebrowRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  headerGymIcon: {width: 15, height: 15, tintColor: ATHLEO_COLORS.accent},
  eyebrow: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase'},
  title: {color: ATHLEO_COLORS.text, fontSize: 24, fontWeight: '800', marginTop: 4, textTransform: 'capitalize'},
  exerciseMeta: {color: ATHLEO_COLORS.muted, fontSize: 12, letterSpacing: 0.5, textTransform: 'capitalize'},
  sessionBar: {gap: 6},
  sessionTrack: {height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden'},
  sessionFill: {height: '100%', borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent},
  sessionMeta: {color: ATHLEO_COLORS.muted, fontSize: 11},
  cockpitCard: {padding: 16, borderRadius: 18},
  cockpitHeader: {flexDirection: 'row', alignItems: 'center', gap: 6},
  cockpitTitle: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700', flex: 1},
  cockpitHint: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase'},
  formCue: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 10},
  elapsedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(184,255,77,0.1)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(184,255,77,0.2)',
  },
  elapsedText: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 13},
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 14,
    shadowColor: ATHLEO_COLORS.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 0},
  },
  pausedButton: {backgroundColor: '#FFB020'},
  startButtonText: {color: ATHLEO_COLORS.background, fontWeight: '800', fontSize: 13, letterSpacing: 1},
  finishCard: {padding: 20, borderRadius: 18, alignItems: 'center', gap: 6, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  finishImg: {width: 50, height: 50, tintColor: ATHLEO_COLORS.accent, marginBottom: 4},
  finishTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
  finishGrid: {flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch'},
  finishStat: {
    flex: 1, alignItems: 'center', gap: 4, backgroundColor: '#0F3820',
    borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)',
  },
  finishValue: {color: ATHLEO_COLORS.accent, fontSize: 20, fontWeight: '900'},
  finishLabel: {color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5},
  finishNote: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 18},
  restCard: {
    backgroundColor: '#0D331D', borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)',
  },
  restHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4},
  restLabel: {color: '#FFFFFF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, flex: 1},
  restLabelActive: {color: ATHLEO_COLORS.accent},
  activeDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: ATHLEO_COLORS.accent},
  restTime: {color: '#FFFFFF', fontSize: 44, fontWeight: '900', marginVertical: 8, textAlign: 'center'},
  restTimeActive: {color: ATHLEO_COLORS.accent},
  restControls: {flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4},
  restBtn: {flex: 1, backgroundColor: '#0F3820', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  restBtnText: {color: '#FFFFFF', fontWeight: '800', fontSize: 14},
  setCard: {padding: 18, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  setCardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
  setCardTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
  volumeBadge: {backgroundColor: 'rgba(184,255,77,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(184,255,77,0.4)'},
  volumeText: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '900'},
  metricLabel: {color: '#FFFFFF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8},
  counterRow: {flexDirection: 'row', alignItems: 'center', gap: 16},
  counterBtn: {width: 48, height: 48, borderRadius: 14, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  counterBtnText: {color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 28},
  counterVal: {color: '#FFFFFF', fontSize: 34, fontWeight: '900', minWidth: 60, textAlign: 'center'},
  logSetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 18,
  },
  logSetButtonDisabled: {backgroundColor: '#143D24', opacity: 0.6},
  logSetText: {color: '#071F12', fontWeight: '900', fontSize: 15, letterSpacing: 1},
  historyCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  historyTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginBottom: 12},
  historyRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(184,255,77,0.2)'},
  historySetBadge: {width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(184,255,77,0.2)', alignItems: 'center', justifyContent: 'center'},
  historySetText: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '900'},
  historyReps: {color: '#FFFFFF', fontWeight: '800', fontSize: 14, flex: 1},
  historyWeight: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 14},
  historyVol: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  queueCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  queueRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 12, paddingHorizontal: 8},
  queueRowActive: {backgroundColor: 'rgba(184,255,77,0.12)', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.45)'},
  queueNum: {width: 28, height: 28, borderRadius: 8, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center'},
  queueNumActive: {backgroundColor: ATHLEO_COLORS.accent},
  queueNumText: {color: '#FFFFFF', fontSize: 13, fontWeight: '900'},
  queueBody: {flex: 1},
  queueName: {color: '#FFFFFF', fontWeight: '800', fontSize: 15, textTransform: 'capitalize'},
  queueNameActive: {color: ATHLEO_COLORS.accent},
  queueMeta: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', marginTop: 2, textTransform: 'capitalize'},
  queueLocked: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', marginTop: 8},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: ATHLEO_COLORS.accent},
  reportCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  reportHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  reportTitle: {color: '#FFFFFF', fontWeight: '800', fontSize: 16, flex: 1},
  reportBody: {marginTop: 14},
  reportPeriodRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
  reportPeriod: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  gradeBadge: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(184,255,77,0.2)', borderWidth: 1, borderColor: 'rgba(184,255,77,0.5)',
  },
  gradeText: {color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 14},
  reportGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  reportStat: {
    width: '30%', backgroundColor: '#0F3820', borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)', alignItems: 'center', gap: 4,
  },
  reportStatValue: {color: '#FFFFFF', fontWeight: '900', fontSize: 15, textAlign: 'center'},
  reportStatLabel: {color: '#E2FCE8', fontSize: 12, fontWeight: '800', textAlign: 'center'},
  reportBlurb: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 12},
});
