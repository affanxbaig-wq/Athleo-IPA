import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from './AnimatedText';
import {ATHLEO_COLORS} from '../theme/theme';
import {triggerHaptic} from '../services/haptics';

export interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
  subLabel?: string;
}

interface SatisfyingBarChartProps {
  data: ChartDataPoint[];
  unit?: string;
  height?: number;
  barColor?: string;
  activeColor?: string;
  showPeakBeacon?: boolean;
  onSelect?: (item: ChartDataPoint, index: number) => void;
}

export function SatisfyingBarChart({
  data,
  unit = '',
  height = 150,
  barColor = ATHLEO_COLORS.accent,
  activeColor = '#FFFFFF',
  showPeakBeacon = true,
  onSelect,
}: SatisfyingBarChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    Math.max(0, data.length - 1),
  );

  // Animated heights for staggered spring entrance
  const barAnimValues = useRef<Animated.Value[]>([]).current;
  const tooltipAnim = useRef(new Animated.Value(1)).current;

  // Max value calculation (protect against division by 0)
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const peakIndex = data.findIndex(d => d.value === maxVal && d.value > 0);

  // Re-initialize anim values if data length changes
  if (barAnimValues.length !== data.length) {
    barAnimValues.length = 0;
    data.forEach(() => barAnimValues.push(new Animated.Value(0)));
  }

  // Trigger staggered spring entrance
  useEffect(() => {
    barAnimValues.forEach(val => val.setValue(0));

    const animations = barAnimValues.map((anim, idx) => {
      return Animated.sequence([
        Animated.delay(idx * 45), // Stagger delay
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: false,
        }),
      ]);
    });

    Animated.parallel(animations).start();
  }, [data, barAnimValues]);

  // Handle bar selection
  const handleBarPress = useCallback(
    (index: number) => {
      triggerHaptic('selection');
      setSelectedIndex(index);

      // Tooltip pop bounce
      tooltipAnim.setValue(0.7);
      Animated.spring(tooltipAnim, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }).start();

      if (data[index]) {
        onSelect?.(data[index], index);
      }
    },
    [data, onSelect, tooltipAnim],
  );

  const selectedItem = data[selectedIndex] ?? data[data.length - 1];

  return (
    <View style={styles.container}>
      {/* Dynamic Floating Selected Value Banner */}
      {selectedItem && (
        <Animated.View
          style={[
            styles.tooltipBanner,
            {
              transform: [{scale: tooltipAnim}],
            },
          ]}
        >
          <View style={styles.tooltipLeft}>
            <Text style={styles.tooltipDate}>
              {selectedItem.date ?? selectedItem.label}
            </Text>
            {selectedIndex === peakIndex && showPeakBeacon && (
              <View style={styles.peakPill}>
                <Icon name="trophy" size={10} color="#FFD700" />
                <Text style={styles.peakPillText}>Peak</Text>
              </View>
            )}
          </View>
          <View style={styles.tooltipRight}>
            <Text style={[styles.tooltipValue, {color: barColor}]}>
              {typeof selectedItem.value === 'number'
                ? selectedItem.value.toLocaleString()
                : selectedItem.value}
              <Text style={styles.tooltipUnit}> {unit}</Text>
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Main Bar Chart Grid */}
      <View style={[styles.chartGrid, {height}]}>
        {/* Subtle Horizontal Reference Gridlines */}
        <View style={styles.gridLineTop} />
        <View style={styles.gridLineMid} />
        <View style={styles.gridLineBottom} />

        {/* Bars Container */}
        <View style={styles.barsRow}>
          {data.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const isPeak = idx === peakIndex && showPeakBeacon;
            const targetRatio = Math.max(0.04, Math.min(1, item.value / maxVal));

            return (
              <TouchableOpacity
                key={`${item.label}-${idx}`}
                style={styles.barCol}
                activeOpacity={0.8}
                onPress={() => handleBarPress(idx)}
              >
                {/* Peak Beacon Star / Glow */}
                {isPeak && (
                  <View style={styles.beaconWrap}>
                    <Icon name="sparkles" size={11} color="#FFD700" />
                  </View>
                )}

                {/* Animated Pillar Body */}
                <View style={styles.pillarSlot}>
                  <Animated.View
                    style={[
                      styles.barPillar,
                      {
                        height: barAnimValues[idx]
                          ? barAnimValues[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', `${targetRatio * 100}%`],
                            })
                          : `${targetRatio * 100}%`,
                        backgroundColor: isSelected
                          ? barColor
                          : `${barColor}55`,
                      },
                      isSelected && styles.barPillarSelected,
                    ]}
                  >
                    {/* Glowing Specular Cap */}
                    <View
                      style={[
                        styles.pillarCap,
                        {
                          backgroundColor: isSelected
                            ? activeColor
                            : 'rgba(255, 255, 255, 0.45)',
                        },
                      ]}
                    />
                  </Animated.View>
                </View>

                {/* Bottom X-Axis Label */}
                <Text
                  style={[
                    styles.axisLabel,
                    isSelected && [styles.axisLabelSelected, {color: barColor}],
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  tooltipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  tooltipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  peakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(184, 255, 77, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ATHLEO_COLORS.accent,
  },
  peakPillText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  tooltipRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tooltipValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tooltipUnit: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '800',
  },
  chartGrid: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLineTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  gridLineMid: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  gridLineBottom: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingBottom: 22,
  },
  barCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingHorizontal: 2,
  },
  beaconWrap: {
    position: 'absolute',
    top: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  pillarSlot: {
    width: '100%',
    maxWidth: 24,
    height: '85%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barPillar: {
    width: '100%',
    borderRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  barPillarSelected: {
    shadowColor: ATHLEO_COLORS.accent,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.65,
    shadowRadius: 8,
  },
  pillarCap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
  axisLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    position: 'absolute',
    bottom: -22,
    textAlign: 'center',
  },
  axisLabelSelected: {
    fontWeight: '900',
    color: ATHLEO_COLORS.accent,
  },
});
