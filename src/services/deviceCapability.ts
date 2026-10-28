/**
 * deviceCapability.ts — decides whether the expensive "liquid glass" chrome
 * (real backdrop blur + the layered jelly capsule on the tab bar) can be drawn.
 *
 * WHY
 * ───
 * The frosted dock stacks ~12 composited layers plus a native BlurView. On a
 * low-RAM Android device that stack never finishes compositing, so the jelly
 * capsule simply never appears. Rather than let the bar look broken there, we
 * detect the device once and fall back to a plain solid-black bar with a cheap
 * active-icon highlight.
 *
 * iOS always qualifies: UIBlurEffect is a system-managed, GPU-resident effect.
 */

import {Platform} from 'react-native';

let DeviceInfo: typeof import('react-native-device-info') | null = null;
try {
  DeviceInfo = require('react-native-device-info');
} catch {
  DeviceInfo = null;
}

/** Android devices below this total RAM are treated as low/mid-tier (locked 60 FPS). */
const FLAGSHIP_MEMORY_BYTES = 7.5 * 1024 * 1024 * 1024; // 8 GB class flagships

export type DevicePerformanceTier = 'budget' | 'medium' | 'flagship';

/**
 * Returns the device performance tier.
 * - iOS: 'flagship' (A/M-series chips, ProMotion 120Hz display pipeline)
 * - Android >= 8GB RAM: 'flagship' (Snapdragon 8 Gen / Dimensity 9000 class, 120Hz)
 * - Android 4GB - 7.5GB: 'medium' (Solid 60 FPS)
 * - Android < 4GB: 'budget' (Lightweight 60 FPS)
 */
export function getDevicePerformanceTier(): DevicePerformanceTier {
  if (Platform.OS !== 'android') {
    return 'flagship';
  }

  try {
    if (DeviceInfo?.isLowRamDevice?.()) {
      return 'budget';
    }

    const totalMemory = DeviceInfo?.getTotalMemorySync?.();
    if (typeof totalMemory === 'number' && totalMemory > 0) {
      if (totalMemory >= FLAGSHIP_MEMORY_BYTES) {
        return 'flagship';
      }
      if (totalMemory >= 3.5 * 1024 * 1024 * 1024) {
        return 'medium';
      }
      return 'budget';
    }
  } catch {
    return 'medium';
  }

  return 'medium';
}

/**
 * Target animation frame rate:
 * - 120 FPS on Flagship devices (iOS ProMotion, Android 8GB+ flagships)
 * - 60 FPS on Low and Medium-tier devices (buttery smooth with zero frame drops)
 */
export function getDeviceAnimationFps(): 60 | 120 {
  return getDevicePerformanceTier() === 'flagship' ? 120 : 60;
}

/**
 * True when the device is a top-tier flagship (iOS or Android >= 8GB RAM).
 */
export function isHighEndDevice(): boolean {
  return getDevicePerformanceTier() === 'flagship';
}

