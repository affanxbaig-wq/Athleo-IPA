import React, {memo} from 'react';
import {Platform, StyleSheet, View, ViewProps} from 'react-native';

import {ATHLEO_COLORS, ATHLEO_RADIUS, ATHLEO_SPACING} from '../theme/theme';

/**
 * Shared card surface.
 *
 * PERF FIXES:
 *  • Removed the extra glassOverlay View \u2014 it was a full absoluteFill overdraw
 *    on every card, adding one extra compositing pass per card on screen.
 *    The glass tint is now merged into the shell's own backgroundColor.
 *  • Memoised with React.memo so parent re-renders (e.g. step counter updates)
 *    don't re-render cards whose props haven't changed.
 *
 * NOTE: renderToHardwareTextureAndroid is intentionally NOT set here because
 * many cards (step counter, calories, speed) update their content frequently.
 * Rasterizing them would cause a GPU texture re-upload on every update, which
 * is worse than not rasterizing. Add it at the call site for static cards only.
 */
export const AppCard = memo(function AppCard({style, children, ...props}: ViewProps) {
  return (
    <View {...props} style={[styles.shell, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios'
      ? 'rgba(13,44,25,0.92)'
      : 'rgba(12,38,22,0.95)',
    borderRadius: ATHLEO_RADIUS.card,
    borderWidth: 1.5,
    borderColor: 'rgba(184,255,77,0.35)',
    padding: ATHLEO_SPACING.md,
    shadowColor: ATHLEO_COLORS.accent,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
});

