/**
 * AnimatedExercisePreview.tsx
 * Slow-motion form preview for a single exercise.
 *
 * Shared by the Workout Library (grid + detail modal), Smart Gym Mode and the
 * Biomechanics guide, so the exact same "learn the correct form" preview
 * appears wherever an exercise is shown.
 *
 * FORM-READING SLOW-MOTION
 * The RepDB dataset ships the two ends of one repetition as stills — `start`
 * and `peak`. Cross-fading between them reads as motion, and holding each pose
 * for several seconds stretches a single rep out far enough to copy.
 *
 * Rendering is delegated to AdaptiveExerciseMedia, which drives the cross-fade
 * on the native driver: the OS compositor runs it at the display's refresh
 * rate (120 Hz on high-end hardware, 60 Hz elsewhere) without a JS frame.
 * The timing constants below mirror ExerciseBiomechanicsScreen's HUD readout.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {resolveExerciseFrameUris, resolveExerciseImageUri} from '../data/exerciseMedia';
import {type FlowExerciseRecord} from '../data/flowExerciseDataset';
import {ATHLEO_COLORS} from '../theme/theme';
import {AdaptiveExerciseMedia} from './AdaptiveExerciseMedia';
import {AnimatedText as Text} from './AnimatedText';

/**
 * Deterministic 0..span offset derived from an id.
 *
 * Every preview used to start its loop on the same tick, so a page of 20 cards
 * flipped pose in perfect unison. Offsetting each card's first hand-off keeps
 * the list out of phase without any random values (so a re-render can't
 * reshuffle it).
 */
const hashPhase = (id: string, span: number) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100003;
  }
  return hash % Math.max(1, span);
};



/** Frames of motion for one exercise, as absolute CDN URIs. */
export const getExercisePreviewSources = (
  exercise: FlowExerciseRecord,
): string[] => {
  const frames = resolveExerciseFrameUris(exercise.animation?.frames);
  if (frames.length > 0) { return frames; }
  const still = resolveExerciseImageUri(exercise.imageFile);
  return still ? [still] : [];
};

export interface AnimatedExercisePreviewProps {
  exercise: FlowExerciseRecord;
  /** Taller clip used by the detail modal and the gym cockpit. */
  large?: boolean;
  /**
   * Playback multiplier. 1 is the standard slow-motion; 0.5 holds every pose
   * twice as long so a learner can copy the position mid-movement; 2 plays the
   * rep back at speed to see the whole flow.
   */
  speed?: number;
  /**
   * Freezes the preview on the pose it is currently showing. The loop is kept
   * alive (rather than torn down) so resuming continues from the same pose
   * instead of snapping back to the first keyframe.
   */
  paused?: boolean;
  /**
   * Fires with the pose index currently on top. Lets a parent HUD show the
   * real pose the animation is on instead of a made-up number.
   */
  onFrameChange?: (frameIndex: number) => void;
}

export function AnimatedExercisePreview({
  exercise,
  large = false,
  speed = 0.75,
  paused = false,
  onFrameChange,
}: AnimatedExercisePreviewProps) {
  // Held in a ref so a parent re-render never restarts the animation loop.
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const sources = useMemo(() => getExercisePreviewSources(exercise), [exercise]);

  const [mediaFailed, setMediaFailed] = useState(false);
  useEffect(() => {
    setMediaFailed(false);
  }, [exercise.id]);

  const handleFrameChange = useCallback((index: number) => {
    onFrameChangeRef.current?.(index);
  }, []);

  const handleError = useCallback(() => setMediaFailed(true), []);

  if (sources.length === 0 || mediaFailed) {
    return (
      <View style={[styles.clip, styles.placeholder, large && styles.clipLarge]}>
        <Icon name="barbell-outline" size={large ? 44 : 32} color={ATHLEO_COLORS.accent} />
        <Text style={styles.placeholderName} numberOfLines={1}>{exercise.name}</Text>
        <Text style={styles.placeholderMeta}>
          {(exercise.target || exercise.bodyPart || 'Strength').toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    // overflow:hidden clips the animation so the preview can never spill over
    // the card boundary and cover the button below it.
    <View style={[styles.clip, large && styles.clipLarge]}>
      <AdaptiveExerciseMedia
        frames={sources}
        width="100%"
        height="100%"
        borderRadius={large ? 18 : 12}
        speed={speed}
        phaseOffsetMs={hashPhase(exercise.id, 800)}
        paused={paused}
        onFrameChange={handleFrameChange}
        onError={handleError}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    marginTop: 8,
    height: 170,
    borderRadius: 12,
    backgroundColor: '#111315',
    overflow: 'hidden',
  },
  clipLarge: {height: 240, borderRadius: 18},
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#101315',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    gap: 4,
  },
  placeholderName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  placeholderMeta: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
