import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function PlanRevealScreen() {
  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Tailored Plan is Ready!</Text>
      <AppCard style={styles.infoCard}>
        <Text style={styles.muted}>About You</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}><Text style={styles.metricLabel}>Height</Text><Text style={styles.metricValue}>176 cm</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>Weight</Text><Text style={styles.metricValue}>72 kg</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>Age</Text><Text style={styles.metricValue}>28</Text></View>
        </View>
      </AppCard>

      <AppCard style={styles.infoCard}>
        <Text style={styles.muted}>Plan Overview</Text>
        <Text style={styles.planText}>Goal: Build Muscle</Text>
        <Text style={styles.planText}>Duration: 12 Weeks</Text>
        <Text style={styles.planText}>Difficulty: Intermediate</Text>
      </AppCard>

      <TouchableOpacity style={styles.primaryButton}><Text style={styles.primaryButtonText}>Get My Plan</Text></TouchableOpacity>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ATHLEO_COLORS.background },
  content: { padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md },
  title: { color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800' },
  infoCard: { backgroundColor: 'rgba(20,20,23,0.75)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: ATHLEO_COLORS.hairline },
  muted: { color: ATHLEO_COLORS.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metric: { flex: 1, backgroundColor: '#1A1B1C', borderRadius: 12, padding: 12 },
  metricLabel: { color: ATHLEO_COLORS.muted, fontSize: 10, textTransform: 'uppercase' },
  metricValue: { color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  planText: { color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 10 },
  primaryButton: { backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: ATHLEO_COLORS.background, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
});
