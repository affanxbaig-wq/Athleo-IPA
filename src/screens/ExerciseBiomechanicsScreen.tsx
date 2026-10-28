/**
 * ExerciseBiomechanicsScreen.tsx — Technique Guide.
 *
 * Previously a fixed mock-up: one hardcoded "Barbell RDL", two Unsplash photos,
 * a fabricated hip-hinge angle of "76.4°", three camera-angle buttons and a
 * pause button that did nothing. There is no pose-estimation camera in this app,
 * so none of that could ever have been real.
 *
 * What is real: the exercise is picked from the bundled 650-movement dataset,
 * the animation is the same slow-motion form loop the Workout Library uses, the
 * play/pause and speed controls actually drive it, the pose readout comes from
 * the keyframe the animation is on, and the target muscles / cues are the
 * dataset's own fields. Nothing is synthesised.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Modal, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedExercisePreview} from '../components/AnimatedExercisePreview';
import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {type FlowExerciseRecord, useFlowExerciseDataset} from '../data/flowExerciseDataset';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {triggerHaptic} from '../services/haptics';

const PICKER_LIMIT = 40;

/** Speeds the learner can actually pick: half speed, standard slow-mo, full flow. */
const SPEEDS = [
  {value: 0.5, label: '0.5x'},
  {value: 1, label: '1x'},
  {value: 2, label: '2x'},
];

/** Names we'd rather open on, so the guide starts on a recognisable lift. */
const PREFERRED_DEFAULTS = ['barbell squat', 'push-up', 'deadlift', 'bench press', 'plank'];

const prettyToken = (value: string) => value.replace(/[_-]+/g, ' ').trim();

function pickDefaultExercise(dataset: FlowExerciseRecord[]): FlowExerciseRecord | null {
  const animated = dataset.filter(exercise => (exercise.animation?.frames?.length ?? 0) > 1);
  if (animated.length === 0) {
    return dataset[0] ?? null;
  }
  for (const preferred of PREFERRED_DEFAULTS) {
    const match = animated.find(exercise => exercise.name.toLowerCase().includes(preferred));
    if (match) {return match;}
  }
  return animated[0];
}

/** Mirrors the shared preview's timing so the HUD can state the real hold time. */
function poseHoldSeconds(exercise: FlowExerciseRecord, speed: number): number {
  const raw = exercise.animation?.frameDurationMs ?? 2400;
  const base = Math.max(3200, Math.min(7000, raw * 18));
  return Math.round((base / Math.max(0.25, speed)) / 100) / 10;
}

export function ExerciseBiomechanicsScreen() {
  const dataset = useFlowExerciseDataset();
  const [exercise, setExercise] = useState<FlowExerciseRecord | null>(() => pickDefaultExercise(dataset));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [bodyFilter, setBodyFilter] = useState('All');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [cueIndex, setCueIndex] = useState(0);

  const bodyParts = useMemo(() => {
    const unique = new Set<string>();
    dataset.forEach(item => {
      if (item.bodyPart) {unique.add(item.bodyPart);}
    });
    return ['All', ...Array.from(unique).sort()];
  }, [dataset]);

  const pickerResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return dataset
      .filter(item => {
        if (bodyFilter !== 'All' && item.bodyPart !== bodyFilter) {return false;}
        if (!query) {return true;}
        return `${item.name} ${item.target} ${item.equipment}`.toLowerCase().includes(query);
      })
      .slice(0, PICKER_LIMIT);
  }, [dataset, searchText, bodyFilter]);

  const cues = exercise?.instructions ?? [];

  // Every exercise restarts the readout at its first keyframe and first cue.
  useEffect(() => {
    setFrameIndex(0);
    setCueIndex(0);
  }, [exercise?.id]);

  /**
   * The animation reports the pose it just moved to, so the HUD shows the real
   * keyframe and walks the follow-along cue list in step with it.
   */
  const handleFrameChange = useCallback(
    (index: number) => {
      setFrameIndex(index);
      setCueIndex(current => (cues.length > 0 ? (current + 1) % cues.length : 0));
    },
    [cues.length],
  );

  const selectExercise = useCallback((next: FlowExerciseRecord) => {
    triggerHaptic('impactLight');
    setExercise(next);
    setPickerVisible(false);
    setSearchText('');
    setPlaying(true);
    setSpeed(1);
  }, []);

  if (!exercise) {
    return (
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Technique Guide</Text>
        <AppCard style={styles.emptyCard}>
          <Icon name="body-outline" size={28} color={ATHLEO_COLORS.muted} />
          <Text style={styles.emptyBody}>The exercise library could not be loaded on this device.</Text>
        </AppCard>
      </SmoothScrollView>
    );
  }

  const frameCount = exercise.animation?.frames?.length ?? 0;
  const hasAnimation = frameCount > 1;

  return (
    <View style={styles.wrapper}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Learn the movement</Text>
            <Text style={styles.title}>Technique Guide</Text>
          </View>
        </View>

        <AppCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.badge}>Form Lab</Text>
            <Text style={styles.metaLabel}>{exercise.equipment || 'No equipment'}</Text>
          </View>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.subtitle}>
            {prettyToken(exercise.bodyPart)} • {prettyToken(exercise.movementPattern)}
          </Text>

          <View style={styles.metricGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Primary target</Text>
              <Text style={styles.metricValueAccent}>{prettyToken(exercise.target)}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Pose hold</Text>
              <Text style={styles.metricValue}>{poseHoldSeconds(exercise, speed)}s</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Keyframes</Text>
              <Text style={styles.metricValue}>{frameCount}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.changeButton} onPress={() => setPickerVisible(true)}>
            <Icon name="search" size={15} color={ATHLEO_COLORS.accent} />
            <Text style={styles.changeButtonText}>Change exercise</Text>
          </TouchableOpacity>
        </AppCard>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Slow-motion demo</Text>
          <Text style={styles.livePill}>
            {hasAnimation ? `Pose ${Math.min(frameIndex + 1, frameCount)} of ${frameCount}` : 'No animation'}
          </Text>
        </View>

        <View style={styles.hudCard}>
          <AnimatedExercisePreview
            exercise={exercise}
            large
            speed={speed}
            paused={!playing}
            onFrameChange={handleFrameChange}
          />
          <View style={styles.hudControls} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => setPlaying(current => !current)}
              accessibilityLabel={playing ? 'Pause demo' : 'Play demo'}>
              <Icon
                name={playing ? 'pause' : 'play'}
                size={16}
                color={ATHLEO_COLORS.background}
              />
            </TouchableOpacity>
            <View style={styles.speedRow}>
              {SPEEDS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.speedChip, speed === option.value && styles.speedChipActive]}
                  onPress={() => setSpeed(option.value)}>
                  <Text
                    style={[
                      styles.speedChipText,
                      speed === option.value && styles.speedChipTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {hasAnimation ? (
          <Text style={styles.hudNote}>
            The demo holds each keyframe so you can copy the position. 0.5x gives you twice as long
            per pose, 2x shows the whole rep flow.
          </Text>
        ) : (
          <Text style={styles.hudNote}>
            This movement has no bundled animation — follow the written cues below.
          </Text>
        )}

        <AppCard style={styles.cuesCard}>
          <View style={styles.cardTitleRow}>
            <Icon name="list-outline" size={16} color={ATHLEO_COLORS.accent} />
            <Text style={styles.cardTitle}>Follow-along cues</Text>
          </View>
          {cues.length === 0 ? (
            <Text style={styles.emptyBody}>No cues are listed for this movement.</Text>
          ) : (
            cues.map((cue, index) => (
              <View
                key={`${exercise.id}-cue-${index}`}
                style={[styles.cueRow, index === cueIndex && styles.cueRowActive]}>
                <View style={[styles.cueIndex, index === cueIndex && styles.cueIndexActive]}>
                  <Text
                    style={[
                      styles.cueIndexText,
                      index === cueIndex && styles.cueIndexTextActive,
                    ]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.cueText, index === cueIndex && styles.cueTextActive]}>
                  {cue}
                </Text>
              </View>
            ))
          )}
        </AppCard>

        <AppCard style={styles.targetCard}>
          <View style={styles.cardTitleRow}>
            <Icon name="body-outline" size={16} color={ATHLEO_COLORS.accent} />
            <Text style={styles.cardTitle}>Muscles worked</Text>
          </View>

          <Text style={styles.targetLabel}>Primary</Text>
          <View style={styles.primaryChip}>
            <Text style={styles.primaryChipText}>{prettyToken(exercise.target)}</Text>
          </View>

          <Text style={[styles.targetLabel, styles.targetLabelSpaced]}>Secondary</Text>
          {exercise.secondaryMuscles.length === 0 ? (
            <Text style={styles.emptyBody}>No secondary muscles listed for this movement.</Text>
          ) : (
            <View style={styles.chipRow}>
              {exercise.secondaryMuscles.map(muscle => (
                <View key={`${exercise.id}-${muscle}`} style={styles.muscleChip}>
                  <Text style={styles.muscleChipText}>{prettyToken(muscle)}</Text>
                </View>
              ))}
            </View>
          )}
        </AppCard>
      </SmoothScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose an exercise</Text>
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
              {pickerResults.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerRow,
                    item.id === exercise.id && styles.pickerRowActive,
                  ]}
                  onPress={() => selectExercise(item)}>
                  <View style={styles.pickerTextWrap}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {prettyToken(item.target)} • {item.equipment}
                    </Text>
                  </View>
                  {item.id === exercise.id ? (
                    <Icon name="checkmark-circle" size={20} color={ATHLEO_COLORS.accent} />
                  ) : null}
                </TouchableOpacity>
              ))}
              {pickerResults.length === 0 ? (
                <Text style={styles.pickerEmpty}>No exercise matches that search.</Text>
              ) : null}
            </SmoothScrollView>
          </View>
        </View>
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
  eyebrow: {color: ATHLEO_COLORS.muted, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase'},
  title: {color: ATHLEO_COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5},

  heroCard: {padding: 16, borderRadius: 18},
  heroHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  badge: {
    backgroundColor: ATHLEO_COLORS.accentDim,
    color: ATHLEO_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1},
  exerciseName: {color: ATHLEO_COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 12},
  subtitle: {color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 8, textTransform: 'capitalize'},
  metricGrid: {flexDirection: 'row', gap: 8, marginTop: 16},
  metricCell: {flex: 1, backgroundColor: ATHLEO_COLORS.surfaceRaised, borderRadius: 12, padding: 10},
  metricLabel: {color: ATHLEO_COLORS.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase'},
  metricValue: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800', marginTop: 6, textTransform: 'capitalize'},
  metricValueAccent: {color: ATHLEO_COLORS.accent, fontSize: 16, fontWeight: '800', marginTop: 6, textTransform: 'capitalize'},

  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
  },
  changeButtonText: {color: ATHLEO_COLORS.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase'},

  sectionHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  sectionLabel: {color: ATHLEO_COLORS.text, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700'},
  livePill: {color: ATHLEO_COLORS.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700'},

  hudCard: {borderRadius: 18, backgroundColor: '#111315', paddingBottom: 56, overflow: 'hidden'},
  hudControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ATHLEO_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedRow: {flexDirection: 'row', gap: 6},
  speedChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(17,19,20,0.85)',
  },
  speedChipActive: {backgroundColor: ATHLEO_COLORS.accent},
  speedChipText: {color: ATHLEO_COLORS.text, fontSize: 11, fontWeight: '800'},
  speedChipTextActive: {color: ATHLEO_COLORS.background},
  hudNote: {color: ATHLEO_COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: -4},

  cuesCard: {padding: 16, borderRadius: 18},
  cardTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  cardTitle: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800'},
  cueRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10},
  cueRowActive: {backgroundColor: ATHLEO_COLORS.accentDim},
  cueIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cueIndexActive: {backgroundColor: ATHLEO_COLORS.accent},
  cueIndexText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '800'},
  cueIndexTextActive: {color: ATHLEO_COLORS.background},
  cueText: {color: ATHLEO_COLORS.muted, fontSize: 13, lineHeight: 19, flex: 1},
  cueTextActive: {color: ATHLEO_COLORS.text, fontWeight: '600'},

  targetCard: {padding: 16, borderRadius: 18},
  targetLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase'},
  targetLabelSpaced: {marginTop: 16},
  primaryChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.accent,
  },
  primaryChipText: {color: ATHLEO_COLORS.background, fontWeight: '800', fontSize: 12, textTransform: 'capitalize'},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
  },
  muscleChipText: {color: ATHLEO_COLORS.text, fontSize: 11, fontWeight: '600', textTransform: 'capitalize'},

  emptyCard: {padding: 20, borderRadius: 18, alignItems: 'center', gap: 8},
  emptyBody: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18},

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
  pickerRowActive: {borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  pickerTextWrap: {flex: 1},
  pickerName: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700'},
  pickerMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2, textTransform: 'capitalize'},
  pickerEmpty: {color: ATHLEO_COLORS.muted, fontSize: 12, textAlign: 'center', paddingVertical: 20},
});
