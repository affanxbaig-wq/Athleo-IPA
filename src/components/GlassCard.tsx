/**
 * GlassCard.tsx — the glassmorphism surface of the onboarding questionnaire.
 *
 *   • fill      rgba(255,255,255,0.03)
 *   • hairline  1px rgba(255,255,255,0.08)
 *   • radius    16
 *   • blur      real backdrop blur, but only where the device can afford it
 *
 * The blur is opt-in per card and gated on `isHighEndDevice()` + Android 12+:
 * a questionnaire can put a dozen cards on screen at once, and a native
 * BlurView per card is exactly the stack that never finishes compositing on a
 * low-RAM phone. Everywhere else the tint + hairline carry the glass look on
 * their own.
 */

import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import {isHighEndDevice} from '../services/deviceCapability';
import {ATHLEO_COLORS, ATHLEO_GLOW, ATHLEO_RADIUS, ATHLEO_SPACING} from '../theme/theme';

// Safe import — the module is optional and its absence must never crash a screen.
let BlurView: any = null;
try {
  const blurModule = require('@react-native-community/blur');
  BlurView = blurModule.BlurView ?? blurModule.default ?? null;
} catch {
  BlurView = null;
}

const BLUR_SUPPORTED_ANDROID =
  Platform.OS === 'android' && Number(Platform.Version) >= 31;

/** Device check is a sync native call — resolve it once, not per card render. */
let highEndCached: boolean | null = null;
function canBlur(): boolean {
  if (highEndCached === null) {
    highEndCached = isHighEndDevice();
  }
  return highEndCached;
}

interface GlassCardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  /** Real backdrop blur. Off by default — see the note at the top of the file. */
  blur?: boolean;
  /** Lime glow ring for the highlighted / selected card. */
  glow?: boolean;
}

export function GlassCard({style, blur = false, glow = false, children, ...props}: GlassCardProps) {
  const blurVisible =
    blur && BlurView != null && (Platform.OS === 'ios' || BLUR_SUPPORTED_ANDROID) && canBlur();

  return (
    <View {...props} style={[styles.shell, glow && styles.shellGlow, style]}>
      {blurVisible ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={14}
          reducedTransparencyFallbackColor={ATHLEO_COLORS.background}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: ATHLEO_COLORS.glass,
    borderRadius: ATHLEO_RADIUS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    padding: ATHLEO_SPACING.md,
  },
  shellGlow: {
    borderColor: ATHLEO_COLORS.accent,
    ...ATHLEO_GLOW,
  },
});
