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

interface SatisfyingCalorieFlameProps {
  calories: number;
  target?: number;
  size?: number;
  compact?: boolean;
  interactive?: boolean;
  showDetails?: boolean;
  onPress?: () => void;
}

export function SatisfyingCalorieFlame({
  calories,
  target = 600,
  size = 110,
  compact = false,
  interactive = true,
  showDetails = true,
  onPress,
}: SatisfyingCalorieFlameProps) {
  // Wave 1: Breathing vertical stretch
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  // Wave 2: Lateral flicker & sway
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  // Ambient radial aura
  const auraGlow = useRef(new Animated.Value(0.4)).current;
  // Interactive tap pop
  const pressScale = useRef(new Animated.Value(1)).current;

  // 4 Permanent embers with hardware-accelerated loops (NO setState = 60fps locked)
  const ember1Y = useRef(new Animated.Value(0)).current;
  const ember1Op = useRef(new Animated.Value(0)).current;
  const ember2Y = useRef(new Animated.Value(0)).current;
  const ember2Op = useRef(new Animated.Value(0)).current;
  const ember3Y = useRef(new Animated.Value(0)).current;
  const ember3Op = useRef(new Animated.Value(0)).current;
  const ember4Y = useRef(new Animated.Value(0)).current;
  const ember4Op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Organic Flame Breathing (sinusoidal stretch)
    const waveLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim1, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim1, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    // 2. Organic Lateral Sway (flicker)
    const waveLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim2, {
          toValue: 1,
          duration: 950,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim2, {
          toValue: 0,
          duration: 1050,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true,
        }),
      ]),
    );

    // 3. Ambient Aura Breathing
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraGlow, {
          toValue: 0.85,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(auraGlow, {
          toValue: 0.35,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    // 4. Staggered Native Ember Loops
    const makeEmberLoop = (animY: Animated.Value, animOp: Animated.Value, dur: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animY, {
              toValue: -size * 0.75,
              duration: dur,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(animOp, {toValue: 1, duration: dur * 0.25, useNativeDriver: true}),
              Animated.timing(animOp, {toValue: 0, duration: dur * 0.75, useNativeDriver: true}),
            ]),
          ]),
          Animated.timing(animY, {toValue: 0, duration: 0, useNativeDriver: true}),
        ]),
      );
    };

    const l1 = makeEmberLoop(ember1Y, ember1Op, 1400, 0);
    const l2 = makeEmberLoop(ember2Y, ember2Op, 1600, 350);
    const l3 = makeEmberLoop(ember3Y, ember3Op, 1800, 700);
    const l4 = makeEmberLoop(ember4Y, ember4Op, 1500, 1050);

    waveLoop1.start();
    waveLoop2.start();
    auraLoop.start();
    l1.start();
    l2.start();
    l3.start();
    l4.start();

    return () => {
      waveLoop1.stop();
      waveLoop2.stop();
      auraLoop.stop();
      l1.stop();
      l2.stop();
      l3.stop();
      l4.stop();
    };
  }, [waveAnim1, waveAnim2, auraGlow, ember1Y, ember1Op, ember2Y, ember2Op, ember3Y, ember3Op, ember4Y, ember4Op, size]);

  // Tactile interactive stoke
  const handlePress = () => {
    triggerHaptic('impactHeavy');

    Animated.sequence([
      Animated.timing(pressScale, {
        toValue: 0.88,
        duration: 80,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1.15,
        friction: 3.5,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onPress?.();
  };

  // Interpolations
  const scaleY1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1.07],
  });
  const scaleX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 0.96],
  });
  const swayX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-3, 3],
  });
  const scaleY2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });

  const progress = Math.min(1, Math.max(0, calories / Math.max(1, target)));
  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={interactive ? 0.88 : 1}
        onPress={interactive ? handlePress : onPress}
        disabled={!interactive && !onPress}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.flameWrapper,
            {
              width: size,
              height: size * 1.15,
              transform: [{scale: pressScale}],
            },
          ]}
        >
          {/* Ambient Heat Radial Glow */}
          <Animated.View
            style={[
              styles.radialHeatAura,
              {
                width: size * 1.25,
                height: size * 1.25,
                borderRadius: (size * 1.25) / 2,
                opacity: auraGlow,
              },
            ]}
          />

          {/* 4 Hardware Accelerated Rising Embers */}
          <Animated.View
            style={[
              styles.particle,
              {
                left: size * 0.42,
                opacity: ember1Op,
                transform: [{translateY: ember1Y}, {translateX: -8}],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                left: size * 0.52,
                backgroundColor: '#FFAE00',
                opacity: ember2Op,
                transform: [{translateY: ember2Y}, {translateX: 6}],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                left: size * 0.38,
                backgroundColor: '#FFDF00',
                opacity: ember3Op,
                transform: [{translateY: ember3Y}, {translateX: -4}],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                left: size * 0.58,
                backgroundColor: '#FF3B00',
                opacity: ember4Op,
                transform: [{translateY: ember4Y}, {translateX: 10}],
              },
            ]}
          />

          {/* SVG Layer 1: Outer Fire */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{scaleX: scaleX1}, {scaleY: scaleY1}],
              },
            ]}
          >
            <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
              <Defs>
                <LinearGradient id="outerFire" x1="0%" y1="100%" x2="0%" y2="0%">
                  <Stop offset="0%" stopColor="#8A0000" stopOpacity="0.8" />
                  <Stop offset="30%" stopColor="#FF1E00" stopOpacity="0.9" />
                  <Stop offset="70%" stopColor="#FF6B00" stopOpacity="0.95" />
                  <Stop offset="100%" stopColor="#FFAB00" stopOpacity="0.85" />
                </LinearGradient>
              </Defs>
              <Path
                d="M50 8 C62 28, 86 46, 86 72 C86 92, 70 108, 50 108 C30 108, 14 92, 14 72 C14 46, 38 28, 50 8 Z"
                fill="url(#outerFire)"
              />
            </Svg>
          </Animated.View>

          {/* SVG Layer 2: Mid Dynamic Tongue of Fire with Lateral Sway */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{translateX: swayX2}, {scaleY: scaleY2}],
              },
            ]}
          >
            <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
              <Defs>
                <LinearGradient id="midFire" x1="0%" y1="100%" x2="0%" y2="0%">
                  <Stop offset="0%" stopColor="#FF3B00" stopOpacity="0.95" />
                  <Stop offset="45%" stopColor="#FF8500" stopOpacity="0.98" />
                  <Stop offset="85%" stopColor="#FFC800" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#FFE866" stopOpacity="0.9" />
                </LinearGradient>
              </Defs>
              <Path
                d="M50 20 C60 38, 76 54, 76 76 C76 90, 64 102, 50 102 C36 102, 24 90, 24 76 C24 54, 40 38, 50 20 Z"
                fill="url(#midFire)"
              />
            </Svg>
          </Animated.View>

          {/* SVG Layer 3: White-Hot Plasma Core & Solar Spark */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{scaleY: scaleY1}],
              },
            ]}
          >
            <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
              <Defs>
                <LinearGradient id="innerCore" x1="0%" y1="100%" x2="0%" y2="0%">
                  <Stop offset="0%" stopColor="#FF9500" stopOpacity="0.9" />
                  <Stop offset="40%" stopColor="#FFDD00" stopOpacity="1" />
                  <Stop offset="80%" stopColor="#FFF280" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
                </LinearGradient>
              </Defs>
              <Path
                d="M50 44 C56 56, 66 68, 66 82 C66 92, 58 98, 50 98 C42 98, 34 92, 34 82 C34 68, 44 56, 50 44 Z"
                fill="url(#innerCore)"
              />
              <Path
                d="M50 68 C52 74, 56 78, 56 84 C56 88, 53 91, 50 91 C47 91, 44 88, 44 84 C44 78, 48 74, 50 68 Z"
                fill="#FFFFFF"
                opacity={0.92}
              />
            </Svg>
          </Animated.View>

          {/* Interactive Hint */}
          {interactive && !compact && (
            <View style={styles.stokeChip}>
              <Icon name="flame" size={9} color="#FF9900" />
              <Text style={styles.stokeText}>Tap to stoke</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Numerical Calorie Reading */}
      {showDetails && !compact && (
        <View style={styles.metricsBlock}>
          <View style={styles.valRow}>
            <Text style={styles.valText}>{Math.round(calories).toLocaleString()}</Text>
            <Text style={styles.unitText}>kcal</Text>
          </View>
          <Text style={styles.targetSub}>
            {calories >= target
              ? '🔥 Target smashed!'
              : `${Math.round(Math.max(0, target - calories)).toLocaleString()} kcal to burn`}
          </Text>

          {/* Micro Progress Track */}
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, percentage)}%`,
                  backgroundColor: percentage >= 100 ? '#B8FF4D' : '#FF6B00',
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radialHeatAura: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 69, 0, 0.22)',
    shadowColor: '#FF4500',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 28,
  },
  particle: {
    position: 'absolute',
    bottom: '26%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF4500',
    shadowColor: '#FFAE00',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 4,
    zIndex: 4,
  },
  stokeChip: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F3820',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.45)',
    zIndex: 5,
  },
  stokeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricsBlock: {
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  valRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unitText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  targetSub: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  track: {
    width: 110,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#0D331D',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.25)',
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
