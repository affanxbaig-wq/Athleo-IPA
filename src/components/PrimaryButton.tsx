/**
 * PrimaryButton.tsx — the neon-lime action button.
 *
 *   primary : lime fill, void-black label, lime glow
 *   outline : transparent, 2px lime border, lime label, no glow
 *
 * The glow is owned by this component so every CTA in the app lights up the
 * same way instead of each screen hand-rolling a shadow.
 */

import React from 'react';
import {ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';

import {ATHLEO_COLORS, ATHLEO_GLOW, ATHLEO_RADIUS, ATHLEO_SPACING} from '../theme/theme';
import {AnimatedText as Text} from './AnimatedText';
import {PressableScale} from './PressableScale';

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';
  // A disabled CTA must not glow — the glow reads as "press me".
  const dimmed = disabled || loading;

  return (
    <PressableScale
      onPress={dimmed ? undefined : onPress}
      disabled={dimmed}
      accessibilityRole="button"
      accessibilityState={{disabled: dimmed, busy: loading}}
      accessibilityLabel={label}
      style={[
        styles.button,
        isPrimary ? styles.primary : styles.outline,
        isPrimary && !dimmed && styles.primaryGlow,
        dimmed && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? ATHLEO_COLORS.background : ATHLEO_COLORS.accent} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelOutline]}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: ATHLEO_RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ATHLEO_SPACING.xl,
    paddingVertical: ATHLEO_SPACING.md,
  },
  primary: {
    backgroundColor: ATHLEO_COLORS.accent,
  },
  primaryGlow: {...ATHLEO_GLOW},
  outline: {
    backgroundColor: '#0F3820',
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.accent,
  },
  dimmed: {opacity: 0.4},
  label: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  labelPrimary: {color: '#071F12'},
  labelOutline: {color: '#FFFFFF'},
});
