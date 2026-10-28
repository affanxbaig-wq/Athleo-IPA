/**
 * CustomWorkoutBuilderScreen.tsx — build, edit and save your own routine.
 *
 * This screen used to be a picture of a workout: a hardcoded
 * "Hypertrophy Push & Delts B", three hardcoded set rows, and "Add Lift" /
 * "Add Set" / "Superset" buttons wired to nothing. It now builds a real plan
 * from the bundled exercise dataset, keeps live totals, persists to MMKV via
 * `customWorkoutService`, and can log the finished session into today's
 * activity so Progress / Weekly report actually move.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {PrimaryButton} from '../components/PrimaryButton';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {type FlowExerciseRecord, useFlowExerciseDataset} from '../data/flowExerciseDataset';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {addCaloriesBurned, flushMirrorToHistory, incrementWorkoutsCompleted} from '../services/dailyTracker';
import {
  createCustomEntry,
  createCustomSet,
  createEmptyWorkout,
  deleteCustomWorkout,
  estimateWorkout,
  loadCustomWorkouts,
  saveCustomWorkout,
  type CustomExerciseEntry,
  type CustomSet,
  type CustomSetType,
  type CustomWorkout,
} from '../services/customWorkoutService';
import {getUserProfile} from '../services/userProfile';
import {triggerHaptic} from '../services/haptics';

/** Standard MET value for resistance training — the same formula Outdoor Run uses. */
const STRENGTH_MET = 6;
const REST_OPTIONS = [45, 60, 90, 120, 180];
const SET_TYPES: CustomSetType[] = ['Warm', 'Work', 'Drop'];
const PICKER_LIMIT = 40;

const LOAD_STEP_KG = 2.5;
const REP_STEP = 1;

type SetPatch = Partial<Pick<CustomSet, 'type' | 'reps' | 'loadKg' | 'restSec'>>;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}k` : String(kg);
}

export function CustomWorkoutBuilderScreen() {
  const [draft, setDraft] = useState<CustomWorkout>(() => createEmptyWorkout());
  const [saved, setSaved] = useState<CustomWorkout[]>(() => loadCustomWorkouts());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [bodyFilter, setBodyFilter] = useState('All');
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const dataset = useFlowExerciseDataset();

  const bodyParts = useMemo(() => {
    const unique = new Set<string>();
    dataset.forEach((exercise: FlowExerciseRecord) => {
      if (exercise.bodyPart) {unique.add(exercise.bodyPart);}
    });
    return ['All', ...Array.from(unique).sort()];
  }, [dataset]);

  const pickerResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return dataset
      .filter((exercise: FlowExerciseRecord) => {
        if (bodyFilter !== 'All' && exercise.bodyPart !== bodyFilter) {return false;}
        if (!query) {return true;}
        return `${exercise.name} ${exercise.target} ${exercise.equipment}`.toLowerCase().includes(query);
      })
      .slice(0, PICKER_LIMIT);
  }, [dataset, searchText, bodyFilter]);

  const estimate = useMemo(() => estimateWorkout(draft), [draft]);

  const updateSets = useCallback((entryId: string, updater: (sets: CustomSet[]) => CustomSet[]) => {
    setDraft(current => ({
      ...current,
      entries: current.entries.map(entry =>
        entry.id === entryId ? {...entry, sets: updater(entry.sets)} : entry,
      ),
    }));
  }, []);

  const patchSet = useCallback(
    (entryId: string, setId: string, patch: SetPatch) => {
      updateSets(entryId, sets =>
        sets.map(set => (set.id === setId ? {...set, ...patch} : set)),
      );
    },
    [updateSets],
  );

  const addExercise = useCallback((exercise: FlowExerciseRecord) => {
    triggerHaptic('impactLight');
    setDraft(current => ({
      ...current,
      entries: [
        ...current.entries,
        createCustomEntry({
          exerciseId: exercise.id,
          name: exercise.name,
          target: exercise.target,
          bodyPart: exercise.bodyPart,
        }),
      ],
    }));
    setPickerVisible(false);
    setSearchText('');
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setDraft(current => ({
      ...current,
      entries: current.entries.filter(entry => entry.id !== entryId),
    }));
  }, []);

  const addSet = useCallback((entry: CustomExerciseEntry) => {
    const last = entry.sets[entry.sets.length - 1];
    updateSets(entry.id, sets => [
      ...sets,
      createCustomSet({reps: last?.reps ?? 10, loadKg: last?.loadKg ?? 0, restSec: last?.restSec ?? 90}),
    ]);
  }, [updateSets]);

  const removeSet = useCallback((entryId: string, setId: string) => {
    updateSets(entryId, sets => (sets.length <= 1 ? sets : sets.filter(set => set.id !== setId)));
  }, [updateSets]);

  const handleSave = useCallback(() => {
    if (draft.entries.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one lift before saving this session.');
      return;
    }
    triggerHaptic('notificationSuccess');
    const next = saveCustomWorkout(draft);
    setSaved(next);
    setDraft(createEmptyWorkout());
    Alert.alert('Session saved', `"${next[0].title}" is now in your saved workouts.`);
  }, [draft]);

  const loadIntoDraft = useCallback((workout: CustomWorkout) => {
    // Fresh ids so editing a loaded plan can never mutate the saved copy in place.
    setDraft({
      ...workout,
      entries: workout.entries.map(entry => ({
        ...entry,
        id: `${entry.id}-edit-${Date.now().toString(36)}`,
        sets: entry.sets.map(set => ({...set, id: `${set.id}-edit`})),
      })),
    });
    setLoggedId(null);
  }, []);

  const removeSaved = useCallback((workout: CustomWorkout) => {
    Alert.alert('Delete workout', `Remove "${workout.title}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setSaved(deleteCustomWorkout(workout.id)),
      },
    ]);
  }, []);

  /** Real accounting: MET-based burn, one workout on today's total, then mirror. */
  const logToToday = useCallback(
    (workout: CustomWorkout) => {
      const workoutEstimate = estimateWorkout(workout);
      const weightKg = getUserProfile().weightKg || 72;
      const kcal = Math.round(STRENGTH_MET * weightKg * (workoutEstimate.estimatedMinutes / 60));

      Alert.alert(
        'Log this session',
        `"${workout.title}"\n${workoutEstimate.totalSets} sets • ~${workoutEstimate.estimatedMinutes} min\n\nThis adds ~${kcal} kcal and 1 workout to today.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Log it',
            onPress: () => {
              addCaloriesBurned(kcal);
              incrementWorkoutsCompleted();
              flushMirrorToHistory();
              triggerHaptic('notificationSuccess');
              setLoggedId(workout.id);
            },
          },
        ],
      );
    },
    [],
  );

  return (
    <View style={styles.wrapper}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <Image source={require('../assets/images/weightlifting.png')} style={styles.headerIcon} resizeMode="contain" />
              <Text style={styles.eyebrow}>Build your own</Text>
            </View>
            <Text style={styles.title}>Workout Builder</Text>
          </View>
        </View>

        {/* Draft header + live totals */}
        <AppCard style={styles.heroCard}>
          <Text style={styles.muted}>Workout title</Text>
          <TextInput
            value={draft.title}
            onChangeText={value => setDraft(current => ({...current, title: value}))}
            placeholder="e.g. Push Day A"
            placeholderTextColor={ATHLEO_COLORS.muted}
            style={styles.titleInput}
            maxLength={48}
          />
          <View style={styles.pillRow}>
            <View style={styles.pillAccent}>
              <Text style={styles.pillTextAccent}>{draft.entries.length} LIFTS</Text>
            </View>
            {estimate.averageLoadKg > 0 ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>AVG {estimate.averageLoadKg} KG</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Est. time</Text>
              <Text style={styles.statValue}>
                {estimate.estimatedMinutes}
                <Text style={styles.unit}>Min</Text>
              </Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={styles.statValueAccent}>{estimate.totalSets}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValueSecondary}>
                {formatVolume(estimate.totalVolumeKg)}
                <Text style={styles.unit}>kg</Text>
              </Text>
            </View>
          </View>
        </AppCard>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setPickerVisible(true)}>
            <Icon name="add" size={16} color={ATHLEO_COLORS.accent} />
            <Text style={styles.actionTextAccent}>Add Lift</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setDraft(createEmptyWorkout())}>
            <Icon name="refresh" size={15} color={ATHLEO_COLORS.muted} />
            <Text style={styles.actionText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {draft.entries.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Image
              source={require('../assets/images/weightlifting.png')}
              style={styles.emptyImg}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No lifts yet</Text>
            <Text style={styles.emptyBody}>
              Tap "Add Lift" to pull an exercise from the library — 650 movements with real target
              muscles, equipment data and step-by-step instructions. Set your reps, load and rest, then save the session.
            </Text>
          </AppCard>
        ) : (
          draft.entries.map((entry, index) => (
            <AppCard key={entry.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseNameWrap}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.exerciseTextWrap}>
                    <Text style={styles.exerciseName}>{entry.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {entry.target} • {entry.bodyPart}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => removeEntry(entry.id)}>
                  <Icon name="trash-outline" size={16} color={ATHLEO_COLORS.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Set</Text>
                <Text style={[styles.tableCell, styles.center]}>Type</Text>
                <Text style={[styles.tableCell, styles.center]}>Reps</Text>
                <Text style={[styles.tableCell, styles.center]}>Load</Text>
                <Text style={[styles.tableCell, styles.right]}>Rest</Text>
              </View>

              {entry.sets.map((set, setIndex) => (
                <View key={set.id} style={styles.setBlock}>
                  <View style={styles.setRow}>
                    <Text style={styles.setId}>{setIndex + 1}</Text>
                    <View style={styles.typeWrap}>
                      {SET_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.typeChip, set.type === type && styles.typeChipActive]}
                          onPress={() => patchSet(entry.id, set.id, {type})}>
                          <Text
                            style={[
                              styles.typeChipText,
                              set.type === type && styles.typeChipTextActive,
                            ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => removeSet(entry.id, set.id)}>
                      <Icon name="close" size={14} color={ATHLEO_COLORS.muted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepperRow}>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          patchSet(entry.id, set.id, {reps: clampNumber(set.reps - REP_STEP, 1, 100)})
                        }>
                        <Icon name="remove" size={14} color={ATHLEO_COLORS.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>
                        {set.reps}
                        <Text style={styles.stepUnit}> reps</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          patchSet(entry.id, set.id, {reps: clampNumber(set.reps + REP_STEP, 1, 100)})
                        }>
                        <Icon name="add" size={14} color={ATHLEO_COLORS.text} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          patchSet(entry.id, set.id, {
                            loadKg: clampNumber(set.loadKg - LOAD_STEP_KG, 0, 500),
                          })
                        }>
                        <Icon name="remove" size={14} color={ATHLEO_COLORS.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepValueAccent}>
                        {set.loadKg}
                        <Text style={styles.stepUnit}> kg</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          patchSet(entry.id, set.id, {
                            loadKg: clampNumber(set.loadKg + LOAD_STEP_KG, 0, 500),
                          })
                        }>
                        <Icon name="add" size={14} color={ATHLEO_COLORS.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.restRow}>
                    <Text style={styles.restLabel}>Rest</Text>
                    {REST_OPTIONS.map(option => (
                      <TouchableOpacity
                        key={option}
                        style={[styles.restChip, set.restSec === option && styles.restChipActive]}
                        onPress={() => patchSet(entry.id, set.id, {restSec: option})}>
                        <Text
                          style={[
                            styles.restChipText,
                            set.restSec === option && styles.restChipTextActive,
                          ]}>
                          {option}s
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.inlineButton} onPress={() => addSet(entry)}>
                <Icon name="add" size={14} color={ATHLEO_COLORS.accent} />
                <Text style={styles.inlineButtonText}>Add Set</Text>
              </TouchableOpacity>
            </AppCard>
          ))
        )}

        <PrimaryButton
          label="Save Session"
          onPress={handleSave}
          disabled={draft.entries.length === 0}
        />

        {/* Saved workouts */}
        <Text style={styles.sectionLabel}>Saved Workouts</Text>
        {saved.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Icon name="bookmark-outline" size={26} color={ATHLEO_COLORS.muted} />
            <Text style={styles.emptyBody}>
              Saved sessions appear here. Nothing is hardcoded — everything on this page is yours.
            </Text>
          </AppCard>
        ) : (
          saved.map(workout => {
            const workoutEstimate = estimateWorkout(workout);
            return (
              <AppCard key={workout.id} style={styles.savedCard}>
                <View style={styles.savedHeader}>
                  <View style={styles.exerciseTextWrap}>
                    <Text style={styles.savedTitle}>{workout.title}</Text>
                    <Text style={styles.savedMeta}>
                      {workout.entries.length} lifts • {workoutEstimate.totalSets} sets •{' '}
                      {workoutEstimate.estimatedMinutes} min
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => removeSaved(workout)}>
                    <Icon name="trash-outline" size={16} color={ATHLEO_COLORS.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.savedActions}>
                  <TouchableOpacity
                    style={styles.savedButton}
                    onPress={() => loadIntoDraft(workout)}>
                    <Icon name="create-outline" size={14} color={ATHLEO_COLORS.text} />
                    <Text style={styles.savedButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.savedButton, styles.savedButtonAccent]}
                    onPress={() => logToToday(workout)}>
                    <Icon
                      name={loggedId === workout.id ? 'checkmark' : 'flash-outline'}
                      size={14}
                      color={ATHLEO_COLORS.background}
                    />
                    <Text style={styles.savedButtonTextAccent}>
                      {loggedId === workout.id ? 'Logged' : 'Log to Today'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </AppCard>
            );
          })
        )}
      </SmoothScrollView>

      {/* Exercise picker */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add a lift</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Icon name="close" size={22} color={ATHLEO_COLORS.muted} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search 650 exercises..."
              placeholderTextColor={ATHLEO_COLORS.muted}
              style={styles.pickerSearch}
            />

            <SmoothScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {bodyParts.map(part => (
                <TouchableOpacity
                  key={part}
                  style={[styles.filterChip, bodyFilter === part && styles.filterChipActive]}
                  onPress={() => setBodyFilter(part)}>
                  <Text
                    style={[styles.filterChipText, bodyFilter === part && styles.filterChipTextActive]}>
                    {part}
                  </Text>
                </TouchableOpacity>
              ))}
            </SmoothScrollView>

            <SmoothScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
              {pickerResults.map(exercise => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.pickerRow}
                  onPress={() => addExercise(exercise)}>
                  <View style={styles.exerciseTextWrap}>
                    <Text style={styles.pickerName}>{exercise.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {exercise.target} • {exercise.equipment}
                    </Text>
                  </View>
                  <Icon name="add-circle-outline" size={20} color={ATHLEO_COLORS.accent} />
                </TouchableOpacity>
              ))}
              {pickerResults.length === 0 ? (
                <Text style={styles.pickerEmpty}>No exercise matches that search.</Text>
              ) : null}
            </SmoothScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 128, gap: ATHLEO_SPACING.md},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerCopy: {flex: 1},
  eyebrowRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  headerIcon: {width: 15, height: 15, tintColor: ATHLEO_COLORS.accent},
  eyebrow: {color: ATHLEO_COLORS.muted, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase'},
  title: {color: ATHLEO_COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5},

  heroCard: {padding: 16, borderRadius: 18},
  muted: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase'},
  titleInput: {
    color: ATHLEO_COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: ATHLEO_COLORS.hairline,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12},
  pillAccent: {backgroundColor: ATHLEO_COLORS.accentDim, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999},
  pillTextAccent: {color: ATHLEO_COLORS.accent, fontSize: 10, letterSpacing: 1, fontWeight: '700'},
  pill: {backgroundColor: ATHLEO_COLORS.surfaceRaised, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999},
  pillText: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700'},

  statGrid: {flexDirection: 'row', marginTop: 16, backgroundColor: '#111314', borderRadius: 12, padding: 8, gap: 8},
  statCell: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8},
  statCellBorder: {borderLeftWidth: 1, borderRightWidth: 1, borderColor: ATHLEO_COLORS.hairline},
  statLabel: {color: ATHLEO_COLORS.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase'},
  statValue: {color: ATHLEO_COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 4},
  statValueAccent: {color: ATHLEO_COLORS.accent, fontSize: 22, fontWeight: '800', marginTop: 4},
  statValueSecondary: {color: ATHLEO_COLORS.accentSoft, fontSize: 22, fontWeight: '800', marginTop: 4},
  unit: {fontSize: 10, color: ATHLEO_COLORS.muted, fontWeight: '600'},

  actionRow: {flexDirection: 'row', gap: 8},
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionText: {color: ATHLEO_COLORS.text, fontWeight: '700', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase'},
  actionTextAccent: {color: ATHLEO_COLORS.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase'},

  emptyCard: {padding: 24, borderRadius: 18, alignItems: 'center', gap: 8},
  emptyImg: {width: 48, height: 48, tintColor: ATHLEO_COLORS.accent, marginBottom: 4},
  emptyTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  emptyBody: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center'},

  exerciseCard: {padding: 16, borderRadius: 18},
  exerciseHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
  exerciseNameWrap: {flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8},
  exerciseTextWrap: {flex: 1},
  badge: {backgroundColor: ATHLEO_COLORS.surfaceRaised, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  badgeText: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 11},
  exerciseName: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  exerciseMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2, textTransform: 'capitalize'},
  iconBtn: {padding: 6},

  tableHeader: {flexDirection: 'row', paddingHorizontal: 6, marginBottom: 6},
  tableCell: {flex: 1, color: ATHLEO_COLORS.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase'},
  center: {textAlign: 'center'},
  right: {textAlign: 'right'},

  setBlock: {
    backgroundColor: '#17191A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  setRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  setId: {color: ATHLEO_COLORS.text, fontWeight: '800', fontSize: 15, width: 22},
  typeWrap: {flexDirection: 'row', gap: 6, flex: 1},
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
  },
  typeChipActive: {backgroundColor: ATHLEO_COLORS.accentDim, borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  typeChipText: {color: ATHLEO_COLORS.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase'},
  typeChipTextActive: {color: ATHLEO_COLORS.accent},

  stepperRow: {flexDirection: 'row', gap: 10, marginTop: 10},
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111314',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {color: ATHLEO_COLORS.text, fontWeight: '800', fontSize: 15},
  stepValueAccent: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 15},
  stepUnit: {fontSize: 10, color: ATHLEO_COLORS.muted, fontWeight: '600'},

  restRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10},
  restLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginRight: 2},
  restChip: {paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: ATHLEO_COLORS.surfaceRaised},
  restChipActive: {backgroundColor: ATHLEO_COLORS.accentDim, borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  restChipText: {color: ATHLEO_COLORS.muted, fontSize: 10, fontWeight: '700'},
  restChipTextActive: {color: ATHLEO_COLORS.accent},

  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
    marginTop: 2,
  },
  inlineButtonText: {color: ATHLEO_COLORS.accent, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6},

  sectionLabel: {color: ATHLEO_COLORS.text, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', marginTop: 6},

  savedCard: {padding: 14, borderRadius: 18},
  savedHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  savedTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  savedMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 3},
  savedActions: {flexDirection: 'row', gap: 8, marginTop: 12},
  savedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
  },
  savedButtonAccent: {backgroundColor: ATHLEO_COLORS.accent},
  savedButtonText: {color: ATHLEO_COLORS.text, fontWeight: '700', fontSize: 12, textTransform: 'uppercase'},
  savedButtonTextAccent: {color: ATHLEO_COLORS.background, fontWeight: '800', fontSize: 12, textTransform: 'uppercase'},

  pickerBackdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)'},
  pickerSheet: {
    backgroundColor: ATHLEO_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  pickerHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  pickerTitle: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800'},
  pickerSearch: {
    color: ATHLEO_COLORS.text,
    fontSize: 14,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  filterRow: {gap: 6, paddingVertical: 12},
  filterChip: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: ATHLEO_COLORS.surfaceRaised},
  filterChipActive: {backgroundColor: ATHLEO_COLORS.accentDim, borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  filterChipText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize'},
  filterChipTextActive: {color: ATHLEO_COLORS.accent},
  pickerList: {maxHeight: 360},
  pickerListContent: {gap: 6, paddingBottom: 12},
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerName: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700'},
  pickerMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2, textTransform: 'capitalize'},
  pickerEmpty: {color: ATHLEO_COLORS.muted, fontSize: 12, textAlign: 'center', paddingVertical: 20},
});
