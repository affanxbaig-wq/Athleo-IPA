/**
 * haptics.ts — Safe haptic feedback wrapper
 *
 * Uses dynamic require (not static import) so the module never hard-crashes
 * when the native react-native-haptic-feedback module is absent or not yet
 * linked. Pattern mirrors how GlassBottomTabBar handles @react-native-community/blur.
 */

let ReactNativeHapticFeedback: any = null;
try {
  const mod = require('react-native-haptic-feedback');
  ReactNativeHapticFeedback = mod?.default ?? mod ?? null;
} catch {
  ReactNativeHapticFeedback = null;
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export type HapticType =
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'
  | 'selection';

export const triggerHaptic = (type: HapticType = 'impactLight'): void => {
  try {
    if (ReactNativeHapticFeedback?.trigger) {
      ReactNativeHapticFeedback.trigger(type, hapticOptions);
    }
  } catch {
    // Graceful no-op on platforms or simulators without vibration hardware
  }
};
