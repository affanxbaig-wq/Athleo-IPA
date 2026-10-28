import React, {useEffect, useMemo, useState} from 'react';
import {Dimensions, GestureResponderEvent, StyleSheet, TouchableOpacity, View} from 'react-native';
import Svg, {Circle, Line, Path, Text as SvgText} from 'react-native-svg';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {bodyMeasurementData, getRangeData, weightHistory} from '../data/athleoProgress';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

const rangeOptions = ['1W', '1M', '3M', '1Y', 'All'] as const;
type RangeKey = (typeof rangeOptions)[number];

export function ProgressWeightScreen() {
  const [selectedRange, setSelectedRange] = useState<RangeKey>('1M');

  const filtered = useMemo(() => getRangeData(weightHistory, selectedRange), [selectedRange]);
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(0, filtered.length - 1));

  useEffect(() => {
    setActiveIndex(prev => {
      if (filtered.length === 0) {return 0;}
      if (prev >= filtered.length || prev < 0) {return Math.max(0, filtered.length - 1);}
      return prev;
    });
  }, [filtered.length]);

  const currentWeight = filtered[filtered.length - 1]?.value ?? 72.0;
  const previousWeight = filtered[0]?.value ?? currentWeight;
  const delta = currentWeight - previousWeight;
  const goalWeight = 70;

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, Math.min(420, screenWidth - 2 * ATHLEO_SPACING.lg - 32));
  const chartHeight = 200;
  const margin = {top: 20, right: 16, bottom: 30, left: 16};

  const minY = Math.min(...filtered.map(item => item.value), goalWeight) - 0.8;
  const maxY = Math.max(...filtered.map(item => item.value), goalWeight) + 0.8;
  const rangeY = maxY - minY || 1;

  const points = filtered.map((point, index) => {
    const x = margin.left + (index / Math.max(1, filtered.length - 1)) * (chartWidth - margin.left - margin.right);
    const y = margin.top + ((maxY - point.value) / rangeY) * (chartHeight - margin.top - margin.bottom);
    return {x, y, ...point};
  });



  const smoothedPath = points.reduce((acc, point, index) => {
    if (index === 0) {return `M ${point.x} ${point.y}`;}
    const prev = points[index - 1];
    const cx = (prev.x + point.x) / 2;
    return `${acc} Q ${prev.x} ${prev.y} ${cx} ${(prev.y + point.y) / 2} T ${point.x} ${point.y}`;
  }, '');

  const goalY = margin.top + ((maxY - goalWeight) / rangeY) * (chartHeight - margin.top - margin.bottom);

  const handleTouch = (event: GestureResponderEvent) => {
    const elementX = event?.nativeEvent?.locationX;
    if (elementX == null || Number.isNaN(elementX) || points.length === 0) {return;}

    const denominator = chartWidth - margin.left - margin.right;
    const raw = denominator > 0 ? (elementX - margin.left) / denominator : 0;
    const normalized = Math.max(0, Math.min(1, raw));
    const index = Math.min(points.length - 1, Math.max(0, Math.round(normalized * (points.length - 1))));
    setActiveIndex(index);
  };

  const activeX = points[activeIndex]?.x ?? chartWidth / 2;
  const activeDate = points[activeIndex]?.date ?? filtered[filtered.length - 1]?.date;
  const activeValue = points[activeIndex]?.value ?? currentWeight;

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppCard style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.label}>Current Weight</Text>
            <Text style={styles.weight}>{currentWeight.toFixed(1)} kg</Text>
          </View>
          {delta !== 0 ? (
            <View style={[styles.badge, delta < 0 ? styles.badgeGood : styles.badgeWarn]}>
              <Text style={[styles.badgeText, delta < 0 ? styles.badgeTextGood : styles.badgeTextWarn]}>
                {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(1)} kg
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.goalRow}>
          <Text style={styles.goalText}>Goal: {goalWeight.toFixed(1)} kg</Text>
          <Text style={styles.goalSub}>
            {Math.max(0, Math.round((currentWeight - goalWeight) * 10)) / 10} kg to reach target
          </Text>
        </View>
      </AppCard>

      <AppCard style={styles.chartCard}>
        <View style={styles.rangeRow}>
          {rangeOptions.map(range => (
            <TouchableOpacity
              key={range}
              style={[styles.rangeChip, selectedRange === range && styles.rangeChipActive]}
              onPress={() => {
                const nextData = getRangeData(weightHistory, range);
                setSelectedRange(range);
                setActiveIndex(Math.max(0, nextData.length - 1));
              }}>
              <Text style={[styles.rangeText, selectedRange === range && styles.rangeTextActive]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chartWrap}>
          <Svg width={chartWidth} height={chartHeight}>
            <Line x1={margin.left} y1={goalY} x2={chartWidth - margin.right} y2={goalY} stroke="rgba(255,255,255,0.25)" strokeDasharray="5 6" />
            {points.map((point, index) => (
              <Circle
                key={`${point.date}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === activeIndex ? 6 : 3}
                fill={index === activeIndex ? '#B8FF4D' : '#FFFFFF'}
                opacity={index === activeIndex ? 1 : 0.6}
              />
            ))}
            <Path d={smoothedPath} fill="none" stroke="#B8FF4D" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <Line x1={activeX} y1={margin.top} x2={activeX} y2={chartHeight - margin.bottom} stroke="#B8FF4D" strokeWidth={1.5} opacity={0.9} />
            <SvgText x={0} y={14} fill="#A0A0A0" fontSize="11">{maxY.toFixed(1)}</SvgText>
            <SvgText x={0} y={chartHeight - 10} fill="#A0A0A0" fontSize="11">{minY.toFixed(1)}</SvgText>
            {points.slice(0, Math.max(1, points.length)).map((point, index) => {
              const x = point.x;
              const y = chartHeight - 12;
              if (index % Math.max(1, Math.ceil(points.length / 4)) !== 0 && points.length > 6) {return null;}
              return <SvgText key={`label-${point.date}`} x={x} y={y} fill="#A0A0A0" fontSize="10" textAnchor="middle">{new Date(point.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</SvgText>;
            })}
          </Svg>
          <View
            style={[styles.touchOverlay, {width: chartWidth, height: chartHeight}]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouch}
            onResponderMove={handleTouch}>
            <View style={[styles.crosshairBadge, {left: Math.max(8, Math.min(chartWidth - 108, activeX - 44))}]}>
              <Text style={styles.crosshairDate}>{activeDate ? new Date(activeDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Today'}</Text>
              <Text style={styles.crosshairValue}>{activeValue.toFixed(1)} kg</Text>
            </View>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.measurementsCard}>
        <Text style={styles.sectionTitle}>Body Measurements</Text>
        <View style={styles.measureGrid}>
          {bodyMeasurementData.map(item => (
            <View key={item.label} style={styles.measureTile}>
              <Text style={styles.measureLabel}>{item.label}</Text>
              <Text style={styles.measureValue}>{item.value} cm</Text>
              <Text style={[styles.measureTrend, item.trend === 'down' ? styles.downTrend : styles.upTrend]}>
                {item.trend === 'down' ? '↓' : '↑'} {Math.abs(item.change).toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ATHLEO_COLORS.background },
  content: { padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md },
  headerCard: { padding: 18, borderRadius: 18 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800' },
  weight: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', marginTop: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeGood: { backgroundColor: 'rgba(184,255,77,0.2)', borderWidth: 1, borderColor: ATHLEO_COLORS.accent },
  badgeWarn: { backgroundColor: 'rgba(255,176,32,0.18)', borderWidth: 1, borderColor: '#FFB020' },
  badgeText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  badgeTextGood: { color: ATHLEO_COLORS.accent },
  badgeTextWarn: { color: '#FFB020' },
  goalRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalText: { color: '#E2FCE8', fontSize: 13, fontWeight: '700' },
  goalSub: { color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '900' },
  chartCard: { padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  rangeChip: { flex: 1, backgroundColor: '#0F3820', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  rangeChipActive: { backgroundColor: ATHLEO_COLORS.accent, borderColor: ATHLEO_COLORS.accent },
  rangeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  rangeTextActive: { color: '#071F12', fontWeight: '900' },
  chartWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  crosshairBadge: {
    position: 'absolute',
    top: 6,
    backgroundColor: 'rgba(10,38,22,0.95)',
    borderColor: ATHLEO_COLORS.accent,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#B8FF4D',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  crosshairDate: { color: '#E2FCE8', fontSize: 12, fontWeight: '700' },
  crosshairValue: { color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 15, marginTop: 2 },
  measurementsCard: { padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  measureTile: { width: '31.5%', backgroundColor: '#0F3820', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  measureLabel: { color: '#FFFFFF', fontSize: 12, textTransform: 'uppercase', fontWeight: '800' },
  measureValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 8 },
  measureTrend: { marginTop: 8, fontSize: 12, fontWeight: '800' },
  downTrend: { color: ATHLEO_COLORS.accent },
  upTrend: { color: '#FFB020' },
});
