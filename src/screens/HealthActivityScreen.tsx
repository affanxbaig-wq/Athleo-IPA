import React from 'react';
import {StyleSheet, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {healthActivitySummary} from '../data/athleoProgress';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function HealthActivityScreen() {
  const activePercent = Math.min(100, (healthActivitySummary.activeMinutes / healthActivitySummary.activeGoalMinutes) * 100);

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppCard style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Daily Activity</Text>
        <View style={styles.ringWrap}>
          <View style={styles.ring}>
            <Text style={styles.ringValue}>{healthActivitySummary.steps.toLocaleString()}</Text>
            <Text style={styles.ringGoal}>of {healthActivitySummary.goalSteps.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>{healthActivitySummary.distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Calories</Text>
            <Text style={styles.summaryValue}>{healthActivitySummary.activeCalories} kcal</Text>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Hourly Steps</Text>
        <View style={styles.hourlyChart}>
          {healthActivitySummary.hourlySteps.map((value, index) => (
            <View key={`${value}-${index}`} style={styles.barWrap}>
              <View style={[styles.barFill, {height: `${Math.max(12, (value / 820) * 100)}%`}]} />
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.progressCard}>
        <Text style={styles.sectionTitle}>Active Time</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.goalText}>{healthActivitySummary.activeMinutes}m / {healthActivitySummary.activeGoalMinutes}m</Text>
          <Text style={styles.goalValue}>{Math.round(activePercent)}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${Math.min(100, activePercent)}%`}]} />
        </View>
      </AppCard>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ATHLEO_COLORS.background },
  content: { padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md },
  summaryCard: { padding: 16, borderRadius: 18 },
  sectionTitle: { color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  ringWrap: { alignItems: 'center', marginBottom: 18 },
  ring: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,255,77,0.05)',
    borderWidth: 8,
    borderColor: ATHLEO_COLORS.accent,
  },
  ringValue: { color: ATHLEO_COLORS.text, fontSize: 28, fontWeight: '800' },
  ringGoal: { color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryTile: { flex: 1, backgroundColor: '#181A1D', borderRadius: 12, padding: 12 },
  summaryLabel: { color: ATHLEO_COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  chartCard: { padding: 16, borderRadius: 18 },
  hourlyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 4 },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', minHeight: 22, borderRadius: 8, backgroundColor: '#B8FF4D' },
  progressCard: { padding: 16, borderRadius: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalText: { color: ATHLEO_COLORS.text, fontWeight: '700' },
  goalValue: { color: ATHLEO_COLORS.accent, fontWeight: '800' },
  track: { height: 12, borderRadius: 999, backgroundColor: '#1E1F22', overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent },
});
