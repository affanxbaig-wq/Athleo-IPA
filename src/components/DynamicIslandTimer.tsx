/**
 * DynamicIslandTimer — Persistent floating workout/rest timer
 *
 * Fix C4: Replaced height/width/borderRadius Animated interpolation
 * (useNativeDriver: false) with scaleX/scaleY transform approach
 * (useNativeDriver: true). This eliminates the Android RCT shadow-tree
 * rebuild crash caused by animating layout properties during active sessions.
 *
 * Fix R6: EXPANDED_WIDTH is now derived from screen dimensions at module load
 * time, capped to 340 so it never overflows on narrow or split-screen Android.
 * Collapsed scale factors are recomputed accordingly.
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {
  workoutTimerService,
  WorkoutTimerState,
} from '../services/workoutTimerService';
import {ATHLEO_COLORS} from '../theme/theme';

let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  ReactNativeHapticFeedback = null;
}

const triggerHaptic = (type: string = 'impactLight') => {
  try {
    ReactNativeHapticFeedback?.trigger(type, {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {}
};

interface DynamicIslandTimerProps {
  onNavigate?: (tabKey: any) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Fixed expanded dimensions — the pill is always rendered at these dimensions.
 * When "collapsed", we scale it using scaleX/scaleY transforms so we do NOT
 * animate layout props, enabling useNativeDriver: true throughout.
 *
 * R6 Fix: cap EXPANDED_WIDTH to screen width minus 32px margin so the pill
 * never overflows on narrow or split-screen Android displays.
 */
const SCREEN_WIDTH    = Dimensions.get('window').width;
const EXPANDED_WIDTH  = Math.min(340, SCREEN_WIDTH - 32);
const EXPANDED_HEIGHT = 110;
const COLLAPSED_SCALE_X = Math.min(210, SCREEN_WIDTH - 64) / EXPANDED_WIDTH;
const COLLAPSED_SCALE_Y = 42 / EXPANDED_HEIGHT;
const EXPANDED_RADIUS  = 28;

export const DynamicIslandTimer: React.FC<DynamicIslandTimerProps> = ({
  onNavigate,
}) => {
  const [timerState, setTimerState] = useState<WorkoutTimerState>(
    workoutTimerService.getState()
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // All animation values — useNativeDriver: true throughout
  const scaleXAnim  = useRef(new Animated.Value(COLLAPSED_SCALE_X)).current;
  const scaleYAnim  = useRef(new Animated.Value(COLLAPSED_SCALE_Y)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = workoutTimerService.subscribe(state => {
      setTimerState(state);
    });
    return () => unsubscribe();
  }, []);

  // Pulse animation when timer is active
  useEffect(() => {
    if (timerState.mode !== 'idle') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [pulseAnim, timerState.mode]);

  // Expand/collapse using scaleX + scaleY — native driver safe
  useEffect(() => {
    const targetScaleX = isExpanded ? 1 : COLLAPSED_SCALE_X;
    const targetScaleY = isExpanded ? 1 : COLLAPSED_SCALE_Y;

    Animated.parallel([
      Animated.spring(scaleXAnim, {
        toValue: targetScaleX,
        bounciness: 8,
        speed: 18,
        useNativeDriver: true,
      }),
      Animated.spring(scaleYAnim, {
        toValue: targetScaleY,
        bounciness: 8,
        speed: 18,
        useNativeDriver: true,
      }),
      // Fade content so it doesn't clip weirdly during scale
      Animated.timing(contentOpacity, {
        toValue: isExpanded ? 1 : 0.95,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleXAnim, scaleYAnim, contentOpacity, isExpanded]);

  if (timerState.mode === 'idle') {
    return null;
  }

  const isRest = timerState.mode === 'rest';
  const accentColor = isRest ? '#FF9F0A' : ATHLEO_COLORS.accent;

  const toggleExpand = () => {
    triggerHaptic('selection');
    setIsExpanded(prev => !prev);
  };

  return (
    <View style={styles.islandContainer} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={toggleExpand}>
        <Animated.View
          style={[
            styles.islandPill,
            {
              borderColor: isRest
                ? 'rgba(255, 159, 10, 0.4)'
                : 'rgba(184, 255, 77, 0.35)',
              transform: [
                { scaleX: scaleXAnim },
                { scaleY: scaleYAnim },
              ],
            },
          ]}>

          {/* Glass specular top highlight */}
          <View style={styles.specularBar} />

          {/* Content — always rendered, opacity-faded when scaling */}
          <Animated.View style={[styles.contentWrapper, { opacity: contentOpacity }]}>
            {!isExpanded ? (
              /* Compact Dynamic Island Pill */
              <View style={styles.compactRow}>
                <Animated.View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isRest
                        ? 'rgba(255,159,10,0.18)'
                        : 'rgba(184,255,77,0.18)',
                      transform: [{scale: pulseAnim}],
                    },
                  ]}>
                  <Icon
                    name={isRest ? 'hourglass-outline' : 'flame'}
                    size={15}
                    color={accentColor}
                  />
                </Animated.View>

                <View style={styles.compactCenter}>
                  <Text style={styles.compactTitle} numberOfLines={1}>
                    {isRest ? 'REST TIMER' : 'ACTIVE GYM'}
                  </Text>
                  <Text style={[styles.compactTimer, {color: accentColor}]}>
                    {isRest
                      ? `${timerState.restRemainingSeconds}s`
                      : formatTime(timerState.elapsedSeconds)}
                  </Text>
                </View>

                <View style={styles.compactRight}>
                  <Text style={styles.setTag}>
                    S{timerState.currentSet}/{timerState.totalSets}
                  </Text>
                </View>
              </View>
            ) : (
              /* Expanded Dynamic Island Modal */
              <View style={styles.expandedContent}>
                <View style={styles.expandedHeader}>
                  <View style={styles.expandedTitleRow}>
                    <Icon
                      name={isRest ? 'hourglass-outline' : 'barbell-outline'}
                      size={16}
                      color={accentColor}
                    />
                    <Text style={styles.expandedTitle} numberOfLines={1}>
                      {timerState.exerciseName || 'Smart Gym Session'}
                    </Text>
                  </View>
                  <Text style={styles.expandedSetPill}>
                    Set {timerState.currentSet} of {timerState.totalSets}
                  </Text>
                </View>

                <View style={styles.expandedTimeRow}>
                  <Text style={[styles.expandedClock, {color: accentColor}]}>
                    {isRest
                      ? `${timerState.restRemainingSeconds}s REST`
                      : formatTime(timerState.elapsedSeconds)}
                  </Text>
                  <Text style={styles.expandedStatus}>
                    {timerState.isPaused
                      ? 'Paused'
                      : isRest
                      ? 'Breathe & Recover'
                      : 'Session Active'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => {
                      triggerHaptic('impactMedium');
                      if (timerState.isPaused) {
                        workoutTimerService.resume();
                      } else {
                        workoutTimerService.pause();
                      }
                    }}>
                    <Icon
                      name={timerState.isPaused ? 'play' : 'pause'}
                      size={15}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionBtnText}>
                      {timerState.isPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, {backgroundColor: accentColor}]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setIsExpanded(false);
                      onNavigate?.('gym');
                    }}>
                    <Icon name="open-outline" size={15} color="#000000" />
                    <Text style={styles.actionBtnPrimaryText}>Go to Gym</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => {
                      triggerHaptic('notificationWarning');
                      workoutTimerService.stop();
                      setIsExpanded(false);
                    }}>
                    <Icon name="close" size={15} color="#FF453A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  islandContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  /**
   * Fixed at EXPANDED dimensions — scaling via transform, not layout changes.
   * This is why we can use useNativeDriver: true throughout.
   */
  islandPill: {
    width: EXPANDED_WIDTH,
    height: EXPANDED_HEIGHT,
    borderRadius: EXPANDED_RADIUS,
    backgroundColor: '#071F12',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.45)',
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 20,
    overflow: 'hidden',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  specularBar: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  compactTimer: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  compactRight: {
    backgroundColor: '#0F3820',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.35)',
  },
  setTag: {
    color: ATHLEO_COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  expandedContent: {
    paddingVertical: 4,
    flex: 1,
    justifyContent: 'space-between',
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expandedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  expandedTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  expandedSetPill: {
    color: '#E2FCE8',
    fontSize: 12,
    fontWeight: '700',
  },
  expandedTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  expandedClock: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  expandedStatus: {
    color: '#E2FCE8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0F3820',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBtnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 14,
  },
  actionBtnPrimaryText: {
    color: '#071F12',
    fontSize: 13,
    fontWeight: '900',
  },
  actionBtnDanger: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 69, 58, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
