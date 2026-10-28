/**
 * FloatingLabelInput.tsx
 * Premium animated text input with floating label, border glow on focus,
 * error state, and optional password toggle.
 */

import React, {useCallback, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import {ATHLEO_COLORS} from '../theme/theme';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export function FloatingLabelInput({
  label,
  error,
  isPassword,
  containerStyle,
  value,
  onFocus,
  onBlur,
  ...rest
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const labelY = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderGlow = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(labelY, {toValue: 1, duration: 160, useNativeDriver: false}),
      Animated.timing(borderGlow, {toValue: 1, duration: 200, useNativeDriver: false}),
    ]).start();
  }, [labelY, borderGlow]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(labelY, {toValue: value ? 1 : 0, duration: 160, useNativeDriver: false}),
      Animated.timing(borderGlow, {toValue: 0, duration: 200, useNativeDriver: false}),
    ]).start();
  }, [labelY, borderGlow, value]);

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    animateIn();
    onFocus?.(e);
  }, [animateIn, onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    animateOut();
    onBlur?.(e);
  }, [animateOut, onBlur]);

  const labelTop = labelY.interpolate({inputRange: [0, 1], outputRange: [16, 6]});
  const labelSize = labelY.interpolate({inputRange: [0, 1], outputRange: [15, 10]});
  const labelColor = labelY.interpolate({
    inputRange: [0, 1],
    outputRange: [ATHLEO_COLORS.muted, error ? ATHLEO_COLORS.danger : ATHLEO_COLORS.accent],
  });
  const glowOpacity = borderGlow.interpolate({inputRange: [0, 1], outputRange: [0, 0.55]});
  const borderColor = error
    ? ATHLEO_COLORS.danger
    : isFocused
      ? ATHLEO_COLORS.accent
      : 'rgba(255,255,255,0.08)';

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {borderColor},
      ]}
    >
      {/* Glow overlay */}
      <Animated.View style={[styles.glowLayer, {opacity: glowOpacity}]} />

      {/* Floating label */}
      <Animated.Text
        style={[
          styles.label,
          {top: labelTop, fontSize: labelSize, color: labelColor},
        ]}
        pointerEvents="none"
      >
        {label}
      </Animated.Text>

      {/* Input */}
      <TextInput
        {...rest}
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        secureTextEntry={isPassword && !showPassword}
        style={styles.input}
        placeholderTextColor="transparent"
        selectionColor={ATHLEO_COLORS.accent}
      />

      {/* Password toggle */}
      {isPassword && (
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword(v => !v)}
        >
          <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      )}

      {/* Error text */}
      {!!error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: '#0D361F',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(184,255,77,0.12)',
    borderRadius: 16,
  },
  label: {
    position: 'absolute',
    left: 16,
    fontWeight: '800',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
  },
  eyeText: {
    color: '#B8FF4D',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
});
