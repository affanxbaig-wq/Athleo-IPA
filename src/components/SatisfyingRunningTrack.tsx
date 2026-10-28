import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from './AnimatedText';
import {ATHLEO_COLORS} from '../theme/theme';

interface SatisfyingRunningTrackProps {
  speedKmh: number;
  distanceKm: number;
  paceMinPerKm?: number;
  isRunning: boolean;
  cadenceStepsPerMin?: number;
}

export function SatisfyingRunningTrack({
  speedKmh,
  distanceKm,
  isRunning,
  cadenceStepsPerMin = 160,
}: SatisfyingRunningTrackProps) {
  // Speed line continuous track motion
  const trackOffset = useRef(new Animated.Value(0)).current;
  const runnerBob = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(1)).current;

  // Track animation speed dynamically scaled to speedKmh
  const effectiveSpeed = isRunning ? Math.max(4, speedKmh) : 0;
  // duration: 500ms when fast (15 km/h), 1200ms when slow (5 km/h)
  const animDuration = effectiveSpeed > 0 ? Math.max(350, Math.round(18000 / effectiveSpeed)) : 2000;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const trackLoop = Animated.loop(
      Animated.timing(trackOffset, {
        toValue: 1,
        duration: animDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    // Runner vertical bounce (simulates athletic stride recoil)
    const bobDuration = Math.max(220, Math.round(60000 / (cadenceStepsPerMin || 160)));
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(runnerBob, {
          toValue: -6,
          duration: bobDuration / 2,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(runnerBob, {
          toValue: 0,
          duration: bobDuration / 2,
          easing: Easing.in(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    // Cadence concentric radar pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, {
          toValue: 1.35,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    );

    trackLoop.start();
    bobLoop.start();
    pulseLoop.start();

    return () => {
      trackLoop.stop();
      bobLoop.stop();
      pulseLoop.stop();
    };
  }, [isRunning, animDuration, cadenceStepsPerMin, trackOffset, runnerBob, pulseRing]);

  // Dash lines translateY interpolation
  const dashTranslateY = trackOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 30],
  });

  // Dynamic pace zone color
  const getZoneColor = (speed: number) => {
    if (!isRunning || speed <= 0) { return ATHLEO_COLORS.muted; }
    if (speed < 6) { return '#3AB4FF'; }      // Zone 1: Light Recovery
    if (speed < 9.5) { return '#B8FF4D'; }    // Zone 2: Aerobic Endurance (Athleo Lime)
    if (speed < 12) { return '#FFB020'; }     // Zone 3: Tempo / Steady
    if (speed < 15) { return '#FF6B00'; }     // Zone 4: Threshold
    return '#FF3B30';                         // Zone 5: Peak Sprint
  };

  const zoneColor = getZoneColor(speedKmh);

  return (
    <View style={styles.container}>
      {/* 3D-Curved Perspective Neon Track */}
      <View style={styles.trackCard}>
        {/* Ambient stadium track glow */}
        <View style={[styles.trackGlow, {shadowColor: zoneColor}]} />

        <Svg width="100%" height={130} viewBox="0 0 320 130" style={styles.svgTrack}>
          <Defs>
            <LinearGradient id="trackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#0B0E14" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#151A24" stopOpacity="0.95" />
            </LinearGradient>

            <LinearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <Stop offset="70%" stopColor={zoneColor} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={zoneColor} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Perspective Track Surface (trapezoid narrowing toward horizon) */}
          <Path
            d="M 110 10 L 210 10 L 290 125 L 30 125 Z"
            fill="url(#trackGrad)"
          />

          {/* Outer Neon Boundary Rails */}
          <Line x1="110" y1="10" x2="30" y2="125" stroke="url(#railGrad)" strokeWidth="2.5" />
          <Line x1="210" y1="10" x2="290" y2="125" stroke="url(#railGrad)" strokeWidth="2.5" />

          {/* Inner Lane Markers */}
          <Line x1="135" y1="10" x2="95" y2="125" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="6,8" />
          <Line x1="185" y1="10" x2="225" y2="125" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="6,8" />
        </Svg>

        {/* Animated Center Stride Dashes (flowing down the track) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.movingCenterStrip,
            {
              transform: [{translateY: isRunning ? dashTranslateY : 0}],
            },
          ]}
        >
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.strideDash,
                {
                  opacity: (i + 1) * 0.16,
                  width: 3 + i * 1.5,
                  height: 10 + i * 4,
                  backgroundColor: zoneColor,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Center Animated Runner Silhouette & Stride Rings */}
        <View style={styles.runnerCenterWrap} pointerEvents="none">
          {/* Cadence Pulse Wave */}
          {isRunning && (
            <Animated.View
              style={[
                styles.pulseWave,
                {
                  borderColor: zoneColor,
                  transform: [{scale: pulseRing}],
                  opacity: pulseRing.interpolate({
                    inputRange: [1, 1.35],
                    outputRange: [0.6, 0],
                  }),
                },
              ]}
            />
          )}

          {/* Athletic Runner Avatar with vertical bob */}
          <Animated.View
            style={[
              styles.runnerPill,
              {
                borderColor: `${zoneColor}88`,
                backgroundColor: 'rgba(12, 16, 24, 0.92)',
                transform: [{translateY: runnerBob}],
              },
            ]}
          >
            <Icon
              name="walk"
              size={22}
              color={zoneColor}
            />
          </Animated.View>
        </View>

        {/* Real-time Dynamic Kinetic HUD Stats */}
        <View style={styles.hudOverlay} pointerEvents="none">
          <View style={styles.hudLeft}>
            <Text style={styles.hudLabel}>LIVE SPEED</Text>
            <Text style={[styles.hudValue, {color: zoneColor}]}>
              {speedKmh.toFixed(1)}
              <Text style={styles.hudUnit}> km/h</Text>
            </Text>
          </View>

          <View style={styles.hudRight}>
            <Text style={styles.hudLabel}>DISTANCE</Text>
            <Text style={styles.hudValue}>
              {distanceKm.toFixed(2)}
              <Text style={styles.hudUnit}> km</Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trackCard: {
    width: '100%',
    height: 130,
    borderRadius: 20,
    backgroundColor: '#0A0C10',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackGlow: {
    position: 'absolute',
    bottom: -15,
    width: '80%',
    height: 30,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.65,
    shadowRadius: 28,
  },
  svgTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  movingCenterStrip: {
    position: 'absolute',
    top: 5,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
  },
  strideDash: {
    borderRadius: 2,
    marginVertical: 4,
  },
  runnerCenterWrap: {
    position: 'absolute',
    bottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  pulseWave: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  runnerPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 6,
  },
  hudLeft: {
    alignItems: 'flex-start',
  },
  hudRight: {
    alignItems: 'flex-end',
  },
  hudLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hudValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  hudUnit: {
    color: ATHLEO_COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
