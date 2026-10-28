import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppButton} from '../components/AppButton';
import {AppCard} from '../components/AppCard';
import {PressableScale} from '../components/PressableScale';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good Morning, Ayesha</Text>
      <Text style={styles.subTitle}>Ready to train?</Text>

      <AppCard style={styles.heroCard}>
        <Text style={styles.cardTitle}>Readiness</Text>
        <Text style={styles.score}>87</Text>
        <Text style={styles.cardLabel}>Excellent recovery</Text>
      </AppCard>

      <View style={styles.quickActionRow}>
        <PressableScale>
          <AppCard style={styles.quickAction}>
            <Text style={styles.quickActionText}>Smart Gym</Text>
          </AppCard>
        </PressableScale>
        <PressableScale>
          <AppCard style={styles.quickAction}>
            <Text style={styles.quickActionText}>Start Workout</Text>
          </AppCard>
        </PressableScale>
      </View>

      <AppButton label="Today’s workout" variant="primary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.background,
  },
  content: {
    padding: ATHLEO_SPACING.lg,
    gap: ATHLEO_SPACING.md,
  },
  greeting: {
    color: ATHLEO_COLORS.text,
    fontSize: 31,
    fontWeight: '700',
  },
  subTitle: {
    color: ATHLEO_COLORS.muted,
    fontSize: 16,
  },
  heroCard: {
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
  },
  cardTitle: {
    color: ATHLEO_COLORS.muted,
    fontSize: 14,
    marginBottom: ATHLEO_SPACING.sm,
  },
  score: {
    color: ATHLEO_COLORS.accent,
    fontSize: 42,
    fontWeight: '800',
  },
  cardLabel: {
    color: ATHLEO_COLORS.text,
    marginTop: ATHLEO_SPACING.sm,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: ATHLEO_SPACING.sm,
  },
  quickAction: {
    flex: 1,
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    color: ATHLEO_COLORS.text,
    fontWeight: '600',
  },
});
