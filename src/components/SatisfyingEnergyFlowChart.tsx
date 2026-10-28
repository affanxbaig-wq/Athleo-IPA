import React, {useCallback, useMemo, useState} from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {LineChart} from 'react-native-gifted-charts';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from './AnimatedText';
import {triggerHaptic} from '../services/haptics';

import {appStorage} from '../services/storage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = Math.max(260, SCREEN_WIDTH - 64);

type MetricType = 'steps' | 'calories' | 'readiness';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildWeeklyMetricData(metric: MetricType, liveVal: number) {
  const result: {value: number; label: string; fullDay: string}[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayOfWeek = d.getDay();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = i === 0;

    let value = 0;
    if (isToday) {
      value = liveVal;
    } else {
      if (metric === 'steps') {
        const stored = parseFloat(appStorage.getString(`steps_${dateKey}`) || '0') || 0;
        value = stored > 0 ? stored : Math.round(7500 + Math.sin(dayOfWeek * 1.5) * 1500);
      } else if (metric === 'calories') {
        const stored = parseFloat(appStorage.getString(`calories_burned_${dateKey}`) || '0') || 0;
        value = stored > 0 ? stored : Math.round(550 + Math.sin(dayOfWeek * 1.2) * 120);
      } else {
        value = Math.min(100, Math.max(65, Math.round(82 + Math.cos(dayOfWeek * 1.1) * 12)));
      }
    }

    result.push({
      value,
      label: DAY_LABELS[dayOfWeek],
      fullDay: isToday ? `Today (${FULL_DAYS[dayOfWeek]})` : FULL_DAYS[dayOfWeek],
    });
  }
  return result;
}

const METRIC_META: Record<MetricType, {label: string; icon: string; color: string; gradientStart: string; unit: string; target: number}> = {
  steps: {
    label: 'Steps',
    icon: 'footsteps',
    color: '#B8FF4D',
    gradientStart: 'rgba(184, 255, 77, 0.38)',
    unit: 'steps',
    target: 10000,
  },
  calories: {
    label: 'Burn',
    icon: 'flame',
    color: '#FF9F0A',
    gradientStart: 'rgba(255, 159, 10, 0.40)',
    unit: 'kcal',
    target: 700,
  },
  readiness: {
    label: 'Energy',
    icon: 'flash',
    color: '#5AC8FF',
    gradientStart: 'rgba(90, 200, 255, 0.40)',
    unit: '%',
    target: 100,
  },
};

interface SatisfyingEnergyFlowChartProps {
  currentSteps?: number;
  currentCalories?: number;
  currentReadiness?: number;
}

export function SatisfyingEnergyFlowChart({
  currentSteps = 0,
  currentCalories = 0,
  currentReadiness = 80,
}: SatisfyingEnergyFlowChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('steps');
  const [selectedIndex, setSelectedIndex] = useState<number>(6); // Default to Today (index 6)

  const config = useMemo(() => {
    const liveVal =
      activeMetric === 'steps' ? currentSteps :
      activeMetric === 'calories' ? currentCalories :
      currentReadiness;

    const data = buildWeeklyMetricData(activeMetric, liveVal);
    const baseMeta = METRIC_META[activeMetric];

    return {
      key: activeMetric,
      ...baseMeta,
      data,
    };
  }, [activeMetric, currentSteps, currentCalories, currentReadiness]);

  const activePoint = config.data[selectedIndex] ?? config.data[4];

  // Formatted chart points for gifted-charts
  const chartPoints = useMemo(() => {
    return config.data.map((item, index) => {
      const isSelected = index === selectedIndex;
      return {
        value: item.value,
        label: item.label,
        labelTextStyle: {
          color: isSelected ? '#FFFFFF' : '#8E8E93',
          fontWeight: isSelected ? ('900' as const) : ('700' as const),
          fontSize: 12,
        },
        customDataPoint: () => (
          <View
            style={[
              styles.beaconDot,
              {
                backgroundColor: isSelected ? '#FFFFFF' : config.color,
                borderColor: config.color,
                transform: [{scale: isSelected ? 1.35 : 1}],
                shadowColor: config.color,
              },
            ]}
          />
        ),
      };
    });
  }, [config, selectedIndex]);

  const handleMetricSwitch = useCallback((type: MetricType) => {
    triggerHaptic('selection');
    setActiveMetric(type);
  }, []);

  return (
    <View style={styles.cardContainer}>
      {/* ── Top Header with Metric Switcher ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.titleBadgeRow}>
            <View style={[styles.glowOrb, {backgroundColor: config.color}]} />
            <Text style={styles.cardTitle}>Weekly Flow</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {activePoint.fullDay}:{' '}
            <Text style={[styles.highlightNumber, {color: config.color}]}>
              {activePoint.value.toLocaleString()} {config.unit}
            </Text>
          </Text>
        </View>

        {/* Minimalist Metric Selector Pills */}
        <View style={styles.toggleRow}>
          {(['steps', 'calories', 'readiness'] as MetricType[]).map(key => {
            const isTabActive = activeMetric === key;
            const itemConf = METRIC_META[key];
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.togglePill,
                  isTabActive && {
                    backgroundColor: 'rgba(184, 255, 77, 0.22)',
                    borderColor: itemConf.color,
                  },
                ]}
                activeOpacity={0.75}
                onPress={() => handleMetricSwitch(key)}>
                <Icon
                  name={itemConf.icon}
                  size={14}
                  color={isTabActive ? itemConf.color : '#8E8E93'}
                />
                <Text
                  style={[
                    styles.toggleLabel,
                    isTabActive && {color: '#FFFFFF', fontWeight: '900'},
                  ]}>
                  {itemConf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Interactive Gifted Smooth Curved Area Chart ── */}
      <View style={styles.chartWrapper}>
        <LineChart
          curved
          isAnimated
          animationDuration={600}
          data={chartPoints}
          width={CHART_WIDTH}
          height={136}
          color={config.color}
          thickness={3}
          startFillColor={config.gradientStart}
          endFillColor="rgba(8, 28, 16, 0.02)"
          startOpacity={0.85}
          endOpacity={0.05}
          areaChart
          initialSpacing={18}
          endSpacing={18}
          spacing={Math.max(28, (CHART_WIDTH - 44) / 7)}
          hideRules
          hideYAxisText
          yAxisColor="transparent"
          xAxisColor="rgba(255, 255, 255, 0.12)"
          dataPointsHeight={8}
          dataPointsWidth={8}
          dataPointsColor={config.color}
          onPress={(item: any, index: number) => {
            triggerHaptic('impactLight');
            setSelectedIndex(index);
          }}
        />
      </View>

      {/* ── Day Selection Ticker ── */}
      <View style={styles.daySelectorRow}>
        {config.data.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <TouchableOpacity
              key={`${item.label}-${idx}`}
              style={[
                styles.dayButton,
                isSelected && {
                  backgroundColor: config.color,
                  borderColor: '#FFFFFF',
                },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedIndex(idx);
              }}>
              <Text
                style={[
                  styles.dayButtonText,
                  isSelected && {color: '#08140B', fontWeight: '900'},
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(12, 38, 22, 0.90)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.30)',
    borderTopColor: 'rgba(184, 255, 77, 0.55)',
    padding: 16,
    marginVertical: 8,
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.20,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glowOrb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#B8FF4D',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    color: '#D4FFB2',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  highlightNumber: {
    fontWeight: '900',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#072010',
    borderRadius: 14,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7, 24, 13, 0.70)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statCol: {
    alignItems: 'center',
  },
  statSmallLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statLargeVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  statUnit: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statStatusBadge: {
    color: '#B8FF4D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  chartWrapper: {
    alignItems: 'center',
    marginVertical: 4,
    overflow: 'hidden',
  },
  beaconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  daySelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#082212',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.25)',
  },
  dayButtonText: {
    color: '#D4FFB2',
    fontSize: 12,
    fontWeight: '800',
  },
});
