import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {AppButton} from './AppButton';
import {AppCard} from './AppCard';
import {PressableScale} from './PressableScale';

export function DevGallery() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ATHLEO Dev Gallery</Text>

      <AppCard style={styles.group}>
        <Text style={styles.sectionTitle}>Buttons</Text>
        <AppButton label="Primary" variant="primary" />
        <View style={styles.spacer} />
        <AppButton label="Secondary" variant="secondary" />
        <View style={styles.spacer} />
        <AppButton label="Ghost" variant="ghost" />
      </AppCard>

      <AppCard style={styles.group}>
        <Text style={styles.sectionTitle}>PressableScale</Text>
        <PressableScale>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Press me</Text>
          </View>
        </PressableScale>
      </AppCard>

      <AppCard style={styles.group}>
        <Text style={styles.sectionTitle}>Cards</Text>
        <Text style={styles.body}>Dark surfaces, lime accents, and strong contrast establish the ATHLEO visual language.</Text>
      </AppCard>
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
  title: {
    color: ATHLEO_COLORS.text,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: ATHLEO_SPACING.sm,
  },
  sectionTitle: {
    color: ATHLEO_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: ATHLEO_SPACING.md,
  },
  group: {
    gap: ATHLEO_SPACING.sm,
  },
  body: {
    color: ATHLEO_COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  spacer: {
    height: ATHLEO_SPACING.sm,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: {
    color: ATHLEO_COLORS.background,
    fontWeight: '700',
  },
});
