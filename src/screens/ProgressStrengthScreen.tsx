import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {recentPrs, strengthMilestones, volumeHistory} from '../data/athleoProgress';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function ProgressStrengthScreen() {
  const est1RMValues = useMemo(() => {
    if (strengthMilestones.length > 0) {
      const base = strengthMilestones.map(m => Number(m.bestWeight) || 0).filter(v => v > 0);
      if (base.length >= 6) {return base;}
    }
    return [62, 76, 82, 88, 93, 100, 105, 115, 130, 145];
  }, []);

  const est1RMMax = useMemo(() => Math.max(1, ...est1RMValues), [est1RMValues]);

  const volumeMax = useMemo(() => {
    const values = volumeHistory.map(e => Number(e.value) || 0);
    return Math.max(1, ...values);
  }, []);

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.prRow}>
        {strengthMilestones.map(item => (
          <AppCard key={item.exercise} style={styles.prCard}>
            <Text style={styles.prExercise}>{item.exercise}</Text>
            <Text style={styles.prValue}>{item.bestWeight} {item.unit}</Text>
            <Text style={styles.prTag}>{item.pin ? 'Pinned' : 'Best'}</Text>
          </AppCard>
        ))}
      </View>

      <AppCard style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Estimated 1RM</Text>
        <View style={styles.barChart}>
          {est1RMValues.map((value, index) => {
            const pct = Math.max(6, Math.min(100, (value / est1RMMax) * 100));
            return (
              <View key={`${value}-${index}`} style={styles.barWrap}>
                <View style={[styles.barFill, {height: `${pct}%`}]} />
                <Text style={styles.barLabel}>{index + 1}</Text>
              </View>
            );
          })}
        </View>
      </AppCard>

      <AppCard style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Volume Over Time</Text>
        <View style={styles.lineChart}>
          {volumeHistory.map((entry, _index) => {
            const val = Number(entry.value) || 0;
            const pct = Math.max(8, Math.min(100, (val / volumeMax) * 100));
            return (
              <View key={entry.label} style={styles.volumeColumn}>
                <View style={[styles.volumeBar, {height: `${pct}%`}]} />
                <Text style={styles.barLabel}>{entry.label.slice(0, 3)}</Text>
              </View>
            );
          })}
        </View>
      </AppCard>

      <AppCard style={styles.prListCard}>
        <Text style={styles.sectionTitle}>Recent PRs</Text>
        {recentPrs.map(item => (
          <View key={`${item.exercise}-${item.date}`} style={styles.prListItem}>
            <View>
              <Text style={styles.prListName}>{item.exercise}</Text>
              <Text style={styles.prListDate}>{item.date}</Text>
            </View>
            <Text style={styles.prListWeight}>{item.weight} kg</Text>
          </View>
        ))}
      </AppCard>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ATHLEO_COLORS.background },
  content: { padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md },
  prRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prCard: { width: '31.5%', padding: 12, borderRadius: 14 },
  prExercise: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800' },
  prValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 8 },
  prTag: { color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '800', marginTop: 6 },
  chartCard: { padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barFill: { width: '100%', minHeight: 16, borderRadius: 10, backgroundColor: 'rgba(184,255,77,0.85)' },
  barLabel: { marginTop: 8, color: '#E2FCE8', fontSize: 12, fontWeight: '800' },
  lineChart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 8 },
  volumeColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  volumeBar: { width: '100%', borderRadius: 10, backgroundColor: ATHLEO_COLORS.accent, minHeight: 20 },
  prListCard: { padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)' },
  prListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(184,255,77,0.2)' },
  prListName: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  prListDate: { color: '#E2FCE8', fontSize: 13, marginTop: 4, fontWeight: '700' },
  prListWeight: { color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 15 },
});
