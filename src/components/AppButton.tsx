import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {ATHLEO_COLORS, ATHLEO_RADIUS, ATHLEO_SPACING} from '../theme/theme';
import {PressableScale} from './PressableScale';

interface AppButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  onPress?: () => void;
}

export function AppButton({label, variant = 'primary', loading = false, onPress}: AppButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  const buttonStyle = [
    styles.button,
    isPrimary && styles.primary,
    isSecondary && styles.secondary,
    !isPrimary && !isSecondary && styles.ghost,
  ];

  const textStyle = [
    styles.text,
    isPrimary && styles.textPrimary,
    isSecondary && styles.textSecondary,
    !isPrimary && !isSecondary && styles.textGhost,
  ];

  return (
    <PressableScale onPress={onPress}>
      <View style={buttonStyle}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? ATHLEO_COLORS.background : ATHLEO_COLORS.accent} />
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </View>
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
    paddingVertical: ATHLEO_SPACING.sm,
    borderWidth: 2,
  },
  primary: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderColor: ATHLEO_COLORS.accent,
  },
  secondary: {
    backgroundColor: '#0F3820',
    borderColor: ATHLEO_COLORS.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textPrimary: {
    color: '#071F12',
  },
  textSecondary: {
    color: '#FFFFFF',
  },
  textGhost: {
    color: '#FFFFFF',
  },
});
