/**
 * AdaptiveExerciseMedia.tsx
 * Renders exercise movements in lifelike, slow-motion form.
 *
 * BIOMECHANICAL SLOW-MOTION REPETITION ENGINE
 * ───────────────────────────────────────────
 * Exercises ship with two key poses — `start` and `peak` (the extremities of a rep).
 * Rather than a jerky slideshow that freezes for seconds and then snaps, this engine
 * models the physical physics of a living repetition:
 *
 *   1. Concentric Phase (~1,550 ms):
 *      Smooth, decelerating muscular contraction from start into peak pose.
 *      Peak pose overlays the start pose with zero alpha-dip (no flickering darkness).
 *      A subtle 2.8% breathing expansion simulates muscle bellies swelling under tension.
 *   2. Peak Squeeze Hold (~350 ms):
 *      Brief natural pause at peak contraction (lockout/apex).
 *   3. Eccentric Phase (~1,650 ms):
 *      Controlled, slow-motion lowering back to starting position.
 *   4. Bottom Reset (~300 ms):
 *      Brief turnaround before the next repetition begins.
 *
 * Runs 100% on the native driver (60/120 Hz) with zero JS thread drops.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import {toFallbackMediaUri} from '../data/exerciseMedia';
import {isHighEndDevice} from '../services/deviceCapability';

// ── Device tier ─────────────────────────────────────────────────────────────

export const getAdaptiveExerciseFps = (): 60 | 120 =>
  isHighEndDevice() ? 120 : 60;

// ── Component ──────────────────────────────────────────────────────────────

export interface AdaptiveExerciseMediaProps {
  /** Single media source. Ignored when `frames` is provided. */
  uri?: string;
  /**
   * Ordered stills of one repetition, as already-resolved absolute URIs.
   * Two or more are smoothly animated in a slow-motion rep loop; one is shown statically.
   */
  frames?: string[];
  /** Width of the player — a number (px) or '100%'. */
  width?: number | `${number}%`;
  /** Height of the player — a number (px) or '100%'. */
  height?: number | `${number}%`;
  /** Border radius. */
  borderRadius?: number;
  /**
   * Animation budget. Defaults to 120 on high-end devices, 60 otherwise.
   */
  targetFps?: number;
  /** Force a device tier instead of detecting one. */
  highEnd?: boolean;
  /** Speed multiplier (default 1.0; e.g. 0.5 = ultra slow-motion form check). */
  speed?: number;
  /** Duration of concentric phase in ms (default: ~1550ms / speed). */
  concentricMs?: number;
  /** Duration of eccentric phase in ms (default: ~1650ms / speed). */
  eccentricMs?: number;
  /** Milliseconds held at peak contraction (default: ~350ms / speed). */
  holdMs?: number;
  /** Legacy cross-fade duration parameter (supported for backwards compatibility). */
  fadeMs?: number;
  /**
   * Extra delay before the very first hand-off, derived from the exercise id.
   * Keeps a grid of cards from repeating in robotic lockstep.
   */
  phaseOffsetMs?: number;
  /**
   * Freezes the loop on the pose it is currently showing.
   */
  paused?: boolean;
  /** Fires with the index of the still now active (0 = start, 1 = peak). */
  onFrameChange?: (frameIndex: number) => void;
  /** Called once the first frame has loaded. */
  onLoad?: () => void;
  /** Called when every source (including the fallback host) failed. */
  onError?: () => void;
  /** Resize mode (default: 'contain'). */
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}

export function AdaptiveExerciseMedia({
  uri,
  frames,
  width = '100%',
  height = '100%',
  borderRadius = 0,
  targetFps,
  highEnd,
  speed = 1,
  concentricMs,
  eccentricMs,
  holdMs,
  fadeMs,
  phaseOffsetMs = 0,
  paused = false,
  onFrameChange,
  onLoad,
  onError,
  resizeMode = 'contain',
}: AdaptiveExerciseMediaProps) {
  const deviceHighEnd = highEnd ?? isHighEndDevice();
  const effectiveFps = targetFps ?? (deviceHighEnd ? 120 : 60);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const framesKey = ((frames && frames.length > 0 ? frames : uri ? [uri] : []) as string[])
    .filter(Boolean)
    .join('|');

  const sources = useMemo(
    () => (framesKey ? framesKey.split('|') : []),
    [framesKey],
  );

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useFallbackHost, setUseFallbackHost] = useState(false);

  useEffect(() => {
    setUseFallbackHost(false);
    setLoaded(false);
    setFailed(false);
  }, [framesKey]);

  const resolvedSources = useMemo(() => {
    if (!useFallbackHost) { return sources; }
    return sources.map(source => toFallbackMediaUri(source) || source);
  }, [sources, useFallbackHost]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (!useFallbackHost && sources.some(source => toFallbackMediaUri(source))) {
      setUseFallbackHost(true);
      return;
    }
    setFailed(true);
    onError?.();
  }, [sources, useFallbackHost, onError]);

  // Biomechanical progress: 0.0 (start pose) -> 1.0 (peak pose)
  const repProgress = useRef(new Animated.Value(0)).current;

  // Single frame entrance fade
  const singleFadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sources.length === 1 && loaded) {
      Animated.timing(singleFadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [sources.length, loaded, singleFadeAnim]);

  // Realistic repetition timing derived from human movement pacing
  const sp = Math.max(0.2, speed);
  const actualConcentric = Math.round(
    (concentricMs ?? (fadeMs && fadeMs > 800 ? fadeMs : 1550)) / sp
  );
  const actualEccentric = Math.round(
    (eccentricMs ?? (fadeMs && fadeMs > 800 ? fadeMs * 1.05 : 1650)) / sp
  );
  const actualPeakHold = Math.round(
    (holdMs && holdMs < 1200 ? holdMs : 350) / sp
  );
  const actualStartHold = Math.round(
    (holdMs && holdMs < 1200 ? Math.round(holdMs * 0.85) : 300) / sp
  );

  // Easing curve: smooth, natural muscle acceleration & deceleration
  const repEasing = useMemo(
    () => Easing.bezier(0.42, 0.0, 0.58, 1.0),
    [],
  );

  // Biological breathing & expansion transform
  const scale = useMemo(
    () =>
      repProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.028],
      }),
    [repProgress],
  );

  const translateY = useMemo(
    () =>
      repProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -2],
      }),
    [repProgress],
  );

  // Repetition Loop for 2 frames
  useEffect(() => {
    if (sources.length !== 2) { return undefined; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeAnim: Animated.CompositeAnimation | null = null;

    const runConcentric = () => {
      if (cancelled) return;
      if (pausedRef.current) {
        timer = setTimeout(runConcentric, 200);
        return;
      }

      activeAnim = Animated.timing(repProgress, {
        toValue: 1,
        duration: actualConcentric,
        easing: repEasing,
        useNativeDriver: true,
      });

      activeAnim.start(({finished}) => {
        if (!finished || cancelled) return;
        onFrameChangeRef.current?.(1);

        timer = setTimeout(() => {
          if (cancelled) return;
          runEccentric();
        }, actualPeakHold);
      });
    };

    const runEccentric = () => {
      if (cancelled) return;
      if (pausedRef.current) {
        timer = setTimeout(runEccentric, 200);
        return;
      }

      activeAnim = Animated.timing(repProgress, {
        toValue: 0,
        duration: actualEccentric,
        easing: repEasing,
        useNativeDriver: true,
      });

      activeAnim.start(({finished}) => {
        if (!finished || cancelled) return;
        onFrameChangeRef.current?.(0);

        timer = setTimeout(() => {
          if (cancelled) return;
          runConcentric();
        }, actualStartHold);
      });
    };

    // Initial stagger offset
    const initialDelay = phaseOffsetMs;
    if (initialDelay > 0) {
      timer = setTimeout(runConcentric, initialDelay);
    } else {
      runConcentric();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (activeAnim) activeAnim.stop();
      repProgress.stopAnimation();
    };
  }, [
    sources.length,
    framesKey,
    actualConcentric,
    actualEccentric,
    actualPeakHold,
    actualStartHold,
    phaseOffsetMs,
    repEasing,
    repProgress,
  ]);

  // Multi-frame (>2) opacities
  const multiOpacities = useMemo(
    () => sources.length > 2 ? sources.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources.length > 2 ? framesKey : ''],
  );

  useEffect(() => {
    if (sources.length <= 2) { return undefined; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentIdx = 0;

    multiOpacities.forEach((val, i) => val.setValue(i === 0 ? 1 : 0));
    onFrameChangeRef.current?.(0);

    const stepDuration = Math.round(1200 / sp);
    const holdDuration = Math.round(300 / sp);

    const advanceMulti = () => {
      if (cancelled) return;
      if (pausedRef.current) {
        timer = setTimeout(advanceMulti, 200);
        return;
      }

      const nextIdx = (currentIdx + 1) % multiOpacities.length;
      const from = multiOpacities[currentIdx];
      const to = multiOpacities[nextIdx];
      currentIdx = nextIdx;

      Animated.parallel([
        Animated.timing(from, {
          toValue: 0,
          duration: stepDuration,
          easing: repEasing,
          useNativeDriver: true,
        }),
        Animated.timing(to, {
          toValue: 1,
          duration: stepDuration,
          easing: repEasing,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (!finished || cancelled) return;
        onFrameChangeRef.current?.(nextIdx);
        timer = setTimeout(advanceMulti, holdDuration);
      });
    };

    timer = setTimeout(advanceMulti, Math.max(100, phaseOffsetMs));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      multiOpacities.forEach(v => v.stopAnimation());
    };
  }, [sources.length, framesKey, sp, phaseOffsetMs, repEasing, multiOpacities]);

  const is120FpsFlagship = effectiveFps >= 120;

  const androidLayerProps = Platform.OS === 'android' && is120FpsFlagship
    ? {renderToHardwareTextureAndroid: true}
    : {};

  const containerStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.container,
        {width: width as number, height: height as number, borderRadius},
      ]),
    [width, height, borderRadius],
  );

  if (resolvedSources.length === 0 || failed) {
    return <View style={containerStyle} />;
  }

  // ── Two-frame Repetition (Concentric & Eccentric) ─────────────────────────
  if (sources.length === 2 && resolvedSources.length >= 2) {
    return (
      <View style={containerStyle}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            is120FpsFlagship ? {transform: [{scale}, {translateY}]} : undefined,
          ]}
          {...androidLayerProps}>
          {/* Base Frame (Start Pose): stays solid at bottom, zero alpha dip */}
          <Image
            source={{
              uri: resolvedSources[0],
              cache: 'force-cache',
              priority: 'high',
            } as any}
            style={[StyleSheet.absoluteFillObject, {borderRadius}]}
            resizeMode={resizeMode}
            onLoad={handleLoad}
            onError={handleError}
          />

          {/* Peak Frame (Contraction Pose): smoothly fades in and out with organic breathing */}
          <Animated.Image
            source={{
              uri: resolvedSources[1],
              cache: 'force-cache',
              priority: 'high',
            } as any}
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius,
                opacity: repProgress,
              },
            ]}
            resizeMode={resizeMode}
          />
        </Animated.View>
      </View>
    );
  }

  // ── Single Frame (Static) ────────────────────────────────────────────────
  if (sources.length === 1 && resolvedSources.length >= 1) {
    return (
      <View style={containerStyle}>
        <Animated.Image
          source={{
            uri: resolvedSources[0],
            cache: 'force-cache',
            priority: 'high',
          } as any}
          style={[
            StyleSheet.absoluteFillObject,
            {borderRadius, opacity: singleFadeAnim},
          ]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          {...androidLayerProps}
        />
      </View>
    );
  }

  // ── Multi-frame (>2 frames) ──────────────────────────────────────────────
  return (
    <View style={containerStyle}>
      {resolvedSources.map((source, index) => (
        <Animated.Image
          key={`${framesKey}-${index}`}
          source={{
            uri: source,
            cache: 'force-cache',
            priority: 'normal',
          } as any}
          style={[
            StyleSheet.absoluteFillObject,
            {borderRadius, opacity: multiOpacities[index] || 0},
          ]}
          resizeMode={resizeMode}
          onLoad={index === 0 ? handleLoad : undefined}
          onError={index === 0 ? handleError : undefined}
          {...androidLayerProps}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
