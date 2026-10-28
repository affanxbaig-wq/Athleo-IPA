/**
 * AppleActivityRings — the "Activity" disk on the home screen.
 *
 * Rebuilt on the Kinetic Obsidian palette:
 *   • no more iOS system red/green/teal — the three arcs are driven by the
 *     colours the caller passes (lime / aqua / amber by default down at the
 *     Dashboard call-site), and the gradient's second stop is *derived* from
 *     that colour instead of being hard-coded,
 *   • the centre readout and every figure use Space Grotesk (the spec's metric
 *     face) while the labels stay on Montserrat,
 *   • the dated opaque disc behind the centre label is gone — the disk is now
 *     open, with a soft radial glow and hairline tracks.
 *
 * Perf notes: each arc animates `strokeDashoffset`, which is a layout-ish SVG
 * prop and therefore MUST stay on the JS driver (`useNativeDriver: false`).
 */

import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, RadialGradient, Stop} from 'react-native-svg';

import {ATHLEO_COLORS} from '../theme/theme';
import {ATHLEO_FAMILY} from '../theme/typography';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface ActivityRingData {
  /** 0–1 fill ratio */
  ratio: number;
  current: number;
  target: number;
  unit: string;
  label: string;
  color: string;
  /** Optional — derived as a 14% wash of `color` when omitted. */
  trackColor?: string;
}

interface AppleActivityRingsProps {
  move: ActivityRingData;
  exercise: ActivityRingData;
  stand: ActivityRingData;
  /** Size in logical pixels, defaults to 200 */
  size?: number;
  hideLegend?: boolean;
  hideCenterText?: boolean;
  centerIcon?: string;
  centerLabelText?: string;
}

/* ─── Colour helpers ──────────────────────────────────────────────────────── */

/** #RRGGBB → [r,g,b] (falls back to the accent for anything unparseable). */
function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(c => c + c)
          .join('')
      : clean;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(int)) {
    return [184, 255, 77];
  }
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Darkens a colour towards black — used for the gradient's second stop. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const mix = (channel: number) => Math.max(0, Math.round(channel * (1 - amount)));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ─── Animated arc ────────────────────────────────────────────────────────── */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ArcProps {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  ratio: number;
  gradientId: string;
  trackColor: string;
  delay?: number;
}

function ActivityRingArc({
  cx, cy, radius, strokeWidth, ratio, gradientId, trackColor, delay = 0,
}: ArcProps) {
  const circumference = 2 * Math.PI * radius;
  const animRatio = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animRatio, {
      toValue: Math.min(1, Math.max(0, ratio)),
      duration: 1150,
      delay,
      useNativeDriver: false,
    }).start();
  }, [animRatio, delay, ratio]);

  const dashOffset = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <>
      {/* Hairline track */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      {/* Animated fill arc */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        // @ts-ignore animated strokeDashoffset
        strokeDashoffset={dashOffset}
        rotation={-90}
        origin={`${cx}, ${cy}`}
      />
    </>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export function AppleActivityRings({
  move,
  exercise,
  stand,
  size = 200,
  hideLegend = false,
  hideCenterText = false,
  centerLabelText,
}: AppleActivityRingsProps) {
  const strokeWidth = size * 0.066;
  const gap = strokeWidth * 1.32;
  const cx = size / 2;
  const cy = size / 2;

  const outerR = size / 2 - strokeWidth / 2 - 2;
  const middleR = outerR - strokeWidth - gap;
  const innerR = middleR - strokeWidth - gap;

  // Clamp center text to fit inside innerR with a comfortable margin
  const maxCenterWidth = innerR * 1.6; // available px across the inner ring
  const centerFontSize = Math.min(
    Math.max(11, Math.round(size * 0.17)),
    Math.round(maxCenterWidth / 2.2),
  );
  const centerCaptionSize = Math.max(7, Math.round(size * 0.055));

  const gradients = useMemo(
    () => ({
      move: [move.color, shade(move.color, 0.32)],
      exercise: [exercise.color, shade(exercise.color, 0.3)],
      stand: [stand.color, shade(stand.color, 0.3)],
    }),
    [move.color, exercise.color, stand.color],
  );

  // Track washes stay locked to each ring's own colour so a palette change at
  // the call-site can never leave a mismatched grey groove behind.
  const tracks = useMemo(
    () => ({
      move: move.trackColor ?? withAlpha(move.color, 0.14),
      exercise: exercise.trackColor ?? withAlpha(exercise.color, 0.14),
      stand: stand.trackColor ?? withAlpha(stand.color, 0.14),
    }),
    [move.color, move.trackColor, exercise.color, exercise.trackColor, stand.color, stand.trackColor],
  );

  const pct = Math.max(0, Math.round(move.ratio * 100));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.disk, {width: size, height: size, overflow: 'hidden'}]}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Soft ambient bloom behind the outermost ring */}
            <RadialGradient id="athleoBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={move.color} stopOpacity="0.16" />
              <Stop offset="70%" stopColor={move.color} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={move.color} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="athleoArcMove" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradients.move[0]} />
              <Stop offset="100%" stopColor={gradients.move[1]} />
            </LinearGradient>
            <LinearGradient id="athleoArcExercise" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={gradients.exercise[0]} />
              <Stop offset="100%" stopColor={gradients.exercise[1]} />
            </LinearGradient>
            <LinearGradient id="athleoArcStand" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={gradients.stand[0]} />
              <Stop offset="100%" stopColor={gradients.stand[1]} />
            </LinearGradient>
          </Defs>

          <Circle cx={cx} cy={cy} r={outerR + strokeWidth} fill="url(#athleoBloom)" />

          <ActivityRingArc
            cx={cx} cy={cy} radius={outerR}
            strokeWidth={strokeWidth}
            ratio={move.ratio}
            gradientId="athleoArcMove"
            trackColor={tracks.move}
            delay={0}
          />
          <ActivityRingArc
            cx={cx} cy={cy} radius={middleR}
            strokeWidth={strokeWidth}
            ratio={exercise.ratio}
            gradientId="athleoArcExercise"
            trackColor={tracks.exercise}
            delay={130}
          />
          <ActivityRingArc
            cx={cx} cy={cy} radius={innerR}
            strokeWidth={strokeWidth}
            ratio={stand.ratio}
            gradientId="athleoArcStand"
            trackColor={tracks.stand}
            delay={260}
          />
        </Svg>

        {!hideCenterText && (
          <View style={styles.centerLabel} pointerEvents="none">
            <Text
              style={[
                styles.centerValue,
                {fontSize: centerFontSize, lineHeight: Math.round(centerFontSize * 1.1)},
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {pct}%
            </Text>
            <Text
              style={[
                styles.centerCaption,
                {fontSize: centerCaptionSize, marginTop: Math.max(1, Math.round(size * 0.018))},
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {centerLabelText ?? move.label.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {!hideLegend && (
        <View style={styles.legend}>
          <RingLegend color={move.color} label={move.label} current={move.current} target={move.target} unit={move.unit} />
          <View style={styles.legendDivider} />
          <RingLegend color={exercise.color} label={exercise.label} current={exercise.current} target={exercise.target} unit={exercise.unit} />
          <View style={styles.legendDivider} />
          <RingLegend color={stand.color} label={stand.label} current={stand.current} target={stand.target} unit={stand.unit} />
        </View>
      )}
    </View>
  );
}

interface LegendProps {
  color: string;
  label: string;
  current: number;
  target: number;
  unit: string;
}

function RingLegend({color, label, current, target, unit}: LegendProps) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendHeader}>
        <View style={[styles.legendDot, {backgroundColor: color, shadowColor: color}]} />
        <Text style={[styles.legendLabel, {color}]} numberOfLines={1}>{label.toUpperCase()}</Text>
      </View>
      {/* Value and target sit on their own lines so all three columns are the
          same height — a combined "1,234 / 8,000 steps" wrapped unevenly. */}
      <Text style={styles.legendValue} numberOfLines={1}>
        {current.toLocaleString()}
      </Text>
      <Text style={styles.legendTarget} numberOfLines={1}>
        / {target.toLocaleString()}
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 22,
    width: '100%',
  },
  disk: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  centerValue: {
    color: ATHLEO_COLORS.text,
    fontFamily: ATHLEO_FAMILY.metricBold,
    fontSize: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  centerPercent: {
    color: ATHLEO_COLORS.muted,
    fontFamily: ATHLEO_FAMILY.metricSemiBold,
    fontSize: 12,
    letterSpacing: 0,
  },
  centerCaption: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
  },
  legendItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 3,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDivider: {
    width: 1.5,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(184, 255, 77, 0.25)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 5,
    elevation: 3,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  legendValue: {
    color: '#FFFFFF',
    fontFamily: ATHLEO_FAMILY.metricSemiBold,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  legendTarget: {
    color: '#E2FCE8',
    fontFamily: ATHLEO_FAMILY.metric,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
