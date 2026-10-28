import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from './AnimatedText';
import {ATHLEO_COLORS} from '../theme/theme';
import {triggerHaptic} from '../services/haptics';

interface SatisfyingWaterWaveProps {
  currentMl: number;
  targetMl?: number;
  onAddWater?: (ml: number) => void;
  compact?: boolean;
}

export function SatisfyingWaterWave({
  currentMl,
  targetMl = 3000,
  onAddWater,
  compact = false,
}: SatisfyingWaterWaveProps) {
  // All animations as stable refs — never re-created
  const wavePhase1 = useRef(new Animated.Value(0)).current;
  const wavePhase2 = useRef(new Animated.Value(0)).current;
  const animatedFill = useRef(new Animated.Value(0)).current;
  const containerScale = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(0)).current;

  // 4 hardware-native bubble anims (NO setState, NO re-renders)
  const b1Y = useRef(new Animated.Value(0)).current;
  const b1Op = useRef(new Animated.Value(0)).current;
  const b2Y = useRef(new Animated.Value(0)).current;
  const b2Op = useRef(new Animated.Value(0)).current;
  const b3Y = useRef(new Animated.Value(0)).current;
  const b3Op = useRef(new Animated.Value(0)).current;
  const b4Y = useRef(new Animated.Value(0)).current;
  const b4Op = useRef(new Animated.Value(0)).current;

  const fillRatio = Math.min(1, Math.max(0.04, currentMl / Math.max(1, targetMl)));

  // Smooth spring fill-level when ml changes
  useEffect(() => {
    Animated.spring(animatedFill, {
      toValue: fillRatio,
      friction: 7,
      tension: 55,
      useNativeDriver: false, // height % requires layout driver
    }).start();
  }, [fillRatio, animatedFill]);

  // Continuous wave loops at 60fps (linear easing on native driver)
  useEffect(() => {
    const w1 = Animated.loop(
      Animated.timing(wavePhase1, {toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true}),
    );
    const w2 = Animated.loop(
      Animated.timing(wavePhase2, {toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true}),
    );
    w1.start();
    w2.start();
    return () => { w1.stop(); w2.stop(); };
  }, [wavePhase1, wavePhase2]);

  // Hardware-native staggered bubble loops — ZERO JS setState
  useEffect(() => {
    const makeBubble = (animY: Animated.Value, animOp: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animY, {toValue: -100, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true}),
            Animated.sequence([
              Animated.timing(animOp, {toValue: 0.7, duration: dur * 0.2, useNativeDriver: true}),
              Animated.timing(animOp, {toValue: 0, duration: dur * 0.8, useNativeDriver: true}),
            ]),
          ]),
          Animated.timing(animY, {toValue: 0, duration: 0, useNativeDriver: true}),
        ]),
      );

    const l1 = makeBubble(b1Y, b1Op, 2000, 0);
    const l2 = makeBubble(b2Y, b2Op, 2400, 500);
    const l3 = makeBubble(b3Y, b3Op, 1800, 1000);
    const l4 = makeBubble(b4Y, b4Op, 2200, 1500);

    l1.start(); l2.start(); l3.start(); l4.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); l4.stop(); };
  }, [b1Y, b1Op, b2Y, b2Op, b3Y, b3Op, b4Y, b4Op]);

  const handleQuickAdd = (ml: number) => {
    triggerHaptic('impactMedium');

    // Tactile container bump
    Animated.sequence([
      Animated.timing(containerScale, {toValue: 0.96, duration: 70, useNativeDriver: true}),
      Animated.spring(containerScale, {toValue: 1.04, friction: 4, tension: 160, useNativeDriver: true}),
      Animated.spring(containerScale, {toValue: 1, friction: 5, tension: 120, useNativeDriver: true}),
    ]).start();

    // Splash ring
    splashScale.setValue(0);
    splashOpacity.setValue(0.8);
    Animated.parallel([
      Animated.timing(splashScale, {toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
      Animated.timing(splashOpacity, {toValue: 0, duration: 500, useNativeDriver: true}),
    ]).start();

    onAddWater?.(ml);
  };

  // Wave translations
  const wave1X = wavePhase1.interpolate({inputRange: [0, 1], outputRange: [0, -100]});
  const wave2X = wavePhase2.interpolate({inputRange: [0, 1], outputRange: [-100, 0]});

  const percentage = Math.round(Math.min(100, (currentMl / Math.max(1, targetMl)) * 100));
  const remainingL = Math.max(0, (targetMl - currentMl) / 1000).toFixed(1);

  const vesselHeight = compact ? 100 : 150;

  return (
    <View style={styles.outerContainer}>
      {/* Main Liquid Vessel */}
      <Animated.View
        style={[
          styles.vessel,
          {height: vesselHeight, transform: [{scale: containerScale}]},
        ]}
      >
        {/* Ambient aqua glow */}
        <View style={styles.ambientGlow} />

        {/* Animated Water Level */}
        <Animated.View
          style={[
            styles.liquidFill,
            {
              height: animatedFill.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          {/* Background wave (slow, darker) */}
          <Animated.View style={[styles.waveLayer, {transform: [{translateX: wave2X}]}]}>
            <Svg width={320} height={32} viewBox="0 0 320 32">
              <Defs>
                <LinearGradient id="bWave" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#0077B6" stopOpacity="0.6" />
                  <Stop offset="100%" stopColor="#03045E" stopOpacity="0.9" />
                </LinearGradient>
              </Defs>
              <Path
                d="M0 16 Q 40 0, 80 16 T 160 16 T 240 16 T 320 16 L 320 32 L 0 32 Z"
                fill="url(#bWave)"
              />
            </Svg>
          </Animated.View>

          {/* Foreground wave (fast, bright) */}
          <Animated.View style={[styles.waveLayer, {transform: [{translateX: wave1X}]}]}>
            <Svg width={320} height={32} viewBox="0 0 320 32">
              <Defs>
                <LinearGradient id="fWave" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#48CAE4" stopOpacity="0.92" />
                  <Stop offset="100%" stopColor="#0096C7" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Path
                d="M0 16 Q 40 28, 80 16 T 160 16 T 240 16 T 320 16 L 320 32 L 0 32 Z"
                fill="url(#fWave)"
              />
            </Svg>
          </Animated.View>

          {/* Deep solid fill */}
          <View style={styles.deepFill}>
            {/* Hardware-native bubbles */}
            <Animated.View style={[styles.bubble, {left: '20%', width: 5, height: 5, borderRadius: 3, opacity: b1Op, transform: [{translateY: b1Y}]}]} />
            <Animated.View style={[styles.bubble, {left: '45%', width: 4, height: 4, borderRadius: 2, opacity: b2Op, transform: [{translateY: b2Y}]}]} />
            <Animated.View style={[styles.bubble, {left: '65%', width: 6, height: 6, borderRadius: 3, opacity: b3Op, transform: [{translateY: b3Y}]}]} />
            <Animated.View style={[styles.bubble, {left: '80%', width: 3, height: 3, borderRadius: 2, opacity: b4Op, transform: [{translateY: b4Y}]}]} />
          </View>
        </Animated.View>

        {/* Splash ring on add */}
        <Animated.View
          style={[
            styles.splashRing,
            {
              opacity: splashOpacity,
              transform: [{scale: splashScale}],
            },
          ]}
          pointerEvents="none"
        />

        {/* Glass specular highlights */}
        <View style={styles.specularHighlight} pointerEvents="none" />
        <View style={styles.topRim} pointerEvents="none" />

        {/* Center percentage + volume overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.centerOverlay}>
            <View style={styles.badge}>
              <Icon name="water" size={11} color="#48CAE4" />
              <Text style={styles.pctText}>{percentage}%</Text>
            </View>
            <Text style={styles.volText}>
              {(currentMl / 1000).toFixed(1)}
              <Text style={styles.volUnit}> / {(targetMl / 1000).toFixed(1)}L</Text>
            </Text>
          </View>
        </View>

        {/* Vessel border overlay */}
        <View style={styles.vesselBorderOverlay} pointerEvents="none" />
      </Animated.View>

      {/* Quick Add Buttons — always visible if handler provided */}
      {onAddWater && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => handleQuickAdd(250)}
            activeOpacity={0.75}
          >
            <Icon name="water-outline" size={14} color="#48CAE4" />
            <Text style={styles.addBtnText}>+250 ml</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, styles.addBtnLg]}
            onPress={() => handleQuickAdd(500)}
            activeOpacity={0.75}
          >
            <Icon name="pint-outline" size={15} color="#00B4D8" />
            <Text style={[styles.addBtnText, {color: '#00B4D8'}]}>+500 ml</Text>
          </TouchableOpacity>
        </View>
      )}

      {!compact && (
        <Text style={styles.footer}>
          {percentage >= 100
            ? '✨ Optimal hydration achieved!'
            : `💧 ${remainingL}L remaining to peak recovery`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    width: '100%',
  },
  vessel: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 14, 24, 0.82)',
    borderWidth: 1.2,
    borderColor: 'rgba(72, 202, 228, 0.22)',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    backgroundColor: 'rgba(0, 180, 216, 0.12)',
    borderRadius: 60,
    shadowColor: '#00B4D8',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  liquidFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  waveLayer: {
    position: 'absolute',
    top: -14,
    left: 0,
    width: 320,
    height: 32,
    zIndex: 3,
  },
  deepFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0077B6',
    position: 'relative',
    zIndex: 2,
  },
  bubble: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 3,
  },
  splashRing: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '40%',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(72, 202, 228, 0.6)',
    zIndex: 8,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.032)',
    zIndex: 5,
  },
  topRim: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    zIndex: 6,
  },
  centerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(4, 10, 20, 0.68)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(72, 202, 228, 0.35)',
    marginBottom: 4,
  },
  pctText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  volText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  volUnit: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  vesselBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    zIndex: 9,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F3820',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  addBtnLg: {
    backgroundColor: '#143D24',
    borderColor: ATHLEO_COLORS.accent,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 9,
    textAlign: 'center',
  },
});
