/**
 * GlassBottomTabBar — Premium Liquid-Glass frosted dock
 *
 * Architecture (bottom → top, all layers inside the pill shape):
 *  0.  Shadow halo        — separate sibling View, no overflow clip, elevation on Android
 *  1.  BlurView           — absoluteFill real backdrop blur (iOS always; Android API≥31 only)
 *  2.  Android dark base  — opaque backing shown ONLY when BlurView is absent (API<31)
 *  3.  Glass base tint    — near-transparent so blur luminosity comes forward
 *  4.  Chromatic frost    — two slightly hue-shifted translucent layers simulate micro-texture
 *  5.  Top-zone highlight — upper 40% subtly brighter
 *  6.  Bottom-zone shadow — lower 28% subtly darker, adds depth
 *  7.  JellyCapsule       — injected via backgroundComponent prop
 *  8.  Tab content row    — icons + labels (children)
 *  9.  Specular rim       — thin bright line across the very top (ABOVE all content)
 *  10. Side fringes       — subtle vertical edge highlights
 *  11. Bottom inner glow  — faint accent tint at bottom edge
 *  12. Inner shadow band  — 2px dark inset at bottom gives "carved glass" depth
 *
 * Fixes applied:
 *  G1: BlurView gated on Platform.Version >= 31 on Android — no more native renderer crash
 *  G2: clipWrapper is ALWAYS transparent; opaqueBacking layer handles dark base on all codepaths
 *  G3: JellyCapsule elevation removed (it's inside overflow:hidden anyway)
 *  G5: renderToHardwareTextureAndroid on clipWrapper and tab row for GPU compositing
 *  G6: tabContentRow paddingHorizontal removed — padding in tab row parent was double-counted
 *  G7: Android fallback blur simulation via multiple semi-transparent layers for pre-API31 devices
 */

import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

// Safe BlurView import — never crashes even if module is absent
let BlurView: any = null;
try {
  const blurModule = require('@react-native-community/blur');
  BlurView = blurModule.BlurView ?? blurModule.default ?? null;
} catch {
  BlurView = null;
}

// G1 Fix: only use BlurView on Android API >= 31 (Android 12+)
const ANDROID_API = Platform.OS === 'android' ? (Platform.Version as number) : 0;
const BLUR_SUPPORTED_ANDROID = ANDROID_API >= 31;
const IS_IOS = Platform.OS === 'ios';

interface GlassBottomTabBarProps {
  children: React.ReactNode;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** Animated jelly capsule indicator — rendered between glass layers and tab row */
  backgroundComponent?: React.ReactNode;
  /** Single onLayout callback — fires once per layout, provides the inner content width */
  onLayout?: (event: any) => void;
  /**
   * When false the dock collapses to a flat solid-black bar: no BlurView, no
   * frosted layer stack, no jelly capsule. Low-end Android devices cannot
   * composite the layered glass — there the effect renders as a blank strip, so
   * we ship the plain bar instead. See services/deviceCapability.
   */
  jellyEnabled?: boolean;
}

const GlassBottomTabBar: React.FC<GlassBottomTabBarProps> = ({
  children,
  height = 68,
  borderRadius = 34,
  style,
  backgroundComponent,
  onLayout,
  jellyEnabled = true,
}) => {
  /**
   * renderBlur — produces the real frosted-glass backdrop blur layer.
   *
   * iOS:     BlurView with "chromeMaterialDark" uses the system-managed blur pipeline.
   *          blurAmount=60 gives maximum kernel size. Parent container must be
   *          backgroundColor:transparent or the blur output is masked.
   *
   * Android: Only rendered on API >= 31 (Android 12+) where Skia BlurView is stable.
   *          downsampleFactor=2 gives sharper blur than =3 on modern hardware.
   *          On older APIs we render null and rely on the opaque dark backing layer.
   *
   * G1+G2 Fix: android branch now gated on BLUR_SUPPORTED_ANDROID. When it renders,
   *             the parent clipWrapper is transparent so blur actually shows through.
   */
  const renderBlur = () => {
    if (!BlurView) {
      return null;
    }

    if (IS_IOS) {
      return (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="chromeMaterialDark"
          blurAmount={60}
          reducedTransparencyFallbackColor="#071F12"
        />
      );
    }

    if (Platform.OS === 'android' && BLUR_SUPPORTED_ANDROID) {
      try {
        return (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={22}
            reducedTransparencyFallbackColor="#071F12"
            overlayColor="rgba(7, 31, 18, 0.20)"
            downsampleFactor={2}
          />
        );
      } catch {
        return null;
      }
    }

    return null;
  };

  const blurRendered = BlurView && (IS_IOS || BLUR_SUPPORTED_ANDROID);

  return (
    /**
     * outerWrapper: pointerEvents="box-none" so touches pass through transparent regions.
     * No elevation here — elevation lives only on shadowHalo.
     */
    <View style={[styles.outerWrapper, style]} pointerEvents="box-none">

      {/* ── Layer 0: Elevation shadow halo ──────────────────────────────── */}
      {/* CRITICAL: Android elevation ONLY on this separate View that has     */}
      {/* no overflow:hidden, so the hardware renderer does not crash.         */}
      <View style={[styles.shadowHalo, { borderRadius }]} />

      {/**
       * clipWrapper: clips all the visual glass layers to the pill shape.
       * overflow:hidden is here — but this View carries NO elevation (Android safe).
       * Elevation is on shadowHalo above (a sibling), which is never clipped.
       *
       * G2 Fix: backgroundColor is ALWAYS transparent — opaqueBacking layer handles
       * the dark base in all scenarios (with or without BlurView). This ensures
       * no double-painting and correct layering in both codepaths.
       *
       * G5 Fix: renderToHardwareTextureAndroid enables GPU compositing of the
       * layered view without software rendering fallback.
       */}
      <View
        style={[
          styles.clipWrapper,
          {
            height,
            borderRadius,
          },
        ]}
        renderToHardwareTextureAndroid
      >

        {/* ── Frosted glass stack ─────────────────────────────────────── */}
        {/* Layers 1–7. Only drawn when the device can actually composite    */}
        {/* them; otherwise the bar falls back to a flat solid-black dock.    */}
        {jellyEnabled ? (
          <>
            {/* ── Layer 1: BlurView — real frosted background blur ──────── */}
            {renderBlur()}

            {/* ── Layer 2: Opaque backing — shown everywhere, tuned per platform */}
            {/* G2 Fix: Always render this layer. When BlurView is active it's   */}
            {/* semi-transparent to let blur show through. When no BlurView it's  */}
            {/* near-opaque to give the bar its dark foundation.                  */}
            {/* G7 Fix: Android pre-API31 gets a richer layered glass simulation */}
            <View style={blurRendered ? styles.opaqueBackingWithBlur : styles.opaqueBacking} />

            {/* G7: Extra simulated glass layers for Android without native blur */}
            {!blurRendered && Platform.OS === 'android' && (
              <>
                <View style={styles.androidGlassLayer1} />
                <View style={styles.androidGlassLayer2} />
                <View style={styles.androidGlassLayer3} />
              </>
            )}

            {/* ── Layer 3: Glass base tint ─────────────────────────────── */}
            {/* Near-transparent dark so the BlurView luminosity comes forward  */}
            <View style={styles.glassTint} />

            {/* ── Layer 4: Chromatic frost micro-texture ────────────────────── */}
            {/* Two slightly blue-hued layers at different opacities simulate   */}
            {/* the granular texture of genuine frosted glass surface           */}
            <View style={styles.frostLayer1} />
            <View style={styles.frostLayer2} />

            {/* ── Layer 5: Top-zone soft highlight gradient ───────────────── */}
            <View style={styles.topZoneHighlight} />

            {/* ── Layer 6: Bottom-zone depth shadow ─────────────────────────── */}
            <View style={styles.bottomZoneShadow} />

            {/* ── Layer 7: JellyCapsule (injected) ─────────────────────────── */}
            {/* Sits above glass layers, below specular rim.                     */}
            {backgroundComponent}
          </>
        ) : (
          /* Flat black dock — low-end fallback. Nothing composited, no blur. */
          <View style={styles.opaqueBlack} />
        )}

        {/* ── Layer 8: Tab content row ─────────────────────────────────── */}
        {/* G6 Fix: No paddingHorizontal here — padding lives in the tabRow  */}
        {/* (the PanResponder View) in AppNavigator. Double-padding was       */}
        {/* causing icon/capsule misalignment.                               */}
        <View
          style={styles.tabContentRow}
          onLayout={onLayout}
          renderToHardwareTextureAndroid
        >
          {children}
        </View>

        {/* ── Layer 9: Specular rim — ABOVE capsule + content ─────────── */}
        {/* A thin bright line across the very top of the pill.            */}
        {/* Must be the last absolute layer so it appears over everything. */}
        <View style={styles.specularRim} />

        {jellyEnabled && (
          <>
            {/* ── Layer 10: Subtle side fringe highlights ───────────────────── */}
            <View style={styles.leftFringe} />
            <View style={styles.rightFringe} />

            {/* ── Layer 11: Bottom inner glow ──────────────────────────────── */}
            <View style={styles.bottomInnerGlow} />

            {/* ── Layer 12: Carved-glass inner shadow at very bottom ─────── */}
            <View style={styles.bottomInnerShadow} />
          </>
        )}

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: IS_IOS ? 20 : 12,
    left: 12,
    right: 12,
    zIndex: 100,
    alignItems: 'center',
    // NO elevation here — elevation on shadowHalo only
  },

  // ── Layer 0: Shadow halo ──────────────────────────────────────────────────
  // Separate sibling View — never has overflow:hidden — safe for Android elevation
  shadowHalo: {
    position: 'absolute',
    top: 4,
    left: -2,
    right: -2,
    bottom: -10,
    backgroundColor: 'transparent',
    // iOS shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
    // Android elevation — safe because this View has no overflow:hidden
    elevation: 30,
    ...(IS_IOS ? {} : { backgroundColor: 'rgba(6,8,12,0.01)' }),
  },

  // ── Clip wrapper — overflow:hidden, NO elevation, ALWAYS transparent ──────
  // G2 Fix: backgroundColor is always transparent — opaqueBacking handles dark base
  clipWrapper: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    borderTopColor: IS_IOS ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.18)',
    borderBottomColor: 'rgba(0, 0, 0, 0.32)',
    // No elevation property — elevation is on shadowHalo above
  },

  // ── Layer 2a: Opaque backing WITH active BlurView ─────────────────────────
  // Near-transparent BLACK — the bar reads as black while the blur still
  // carries the colour of whatever scrolls beneath it.
  opaqueBackingWithBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IS_IOS
      ? 'rgba(0, 0, 0, 0.28)'  // iOS: very light tint, blur does the heavy lifting
      : 'rgba(0, 0, 0, 0.62)', // Android: heavier since Android blur is weaker
  },

  // ── Layer 2b: Opaque backing WITHOUT BlurView ─────────────────────────────
  // Core black surface of the dock — used whenever no blur is composited.
  opaqueBacking: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 28, 16, 0.96)',
  },

  // ── Flat green dock — low-end fallback (no blur, no jelly, no layering) ──
  opaqueBlack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071F12',
  },

  // ── G7: Android pre-API31 glass simulation layers ────────────────────────
  // Layer stack that fakes the depth/texture of frosted glass without native blur
  androidGlassLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 26, 14, 0.70)',
  },
  androidGlassLayer2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  androidGlassLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(184, 255, 77, 0.06)',
  },

  // ── Layer 3: Glass base tint ──────────────────────────────────────────────
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    // On iOS with blur: ultra thin so blur maxes forward
    // On Android with blur: slightly stronger since blur is less powerful
    // On Android without blur: effectively invisible (opaqueBacking handles it)
    backgroundColor: IS_IOS
      ? 'rgba(7, 28, 15, 0.18)'
      : 'rgba(7, 28, 15, 0.30)',
  },

  // ── Layer 4a: Frost micro-texture (cool blue layer) ──────────────────────
  frostLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IS_IOS
      ? 'rgba(200, 215, 255, 0.032)'
      : 'rgba(180, 200, 255, 0.020)',
  },

  // ── Layer 4b: Frost micro-texture (warm white layer offset) ──────────────
  frostLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IS_IOS
      ? 'rgba(255, 255, 240, 0.018)'
      : 'rgba(240, 240, 255, 0.010)',
  },

  // ── Layer 5: Top zone highlight (upper 40% brighter) ─────────────────────
  topZoneHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: IS_IOS
      ? 'rgba(255, 255, 255, 0.055)'
      : 'rgba(255, 255, 255, 0.030)',
  },

  // ── Layer 6: Bottom zone depth shadow (lower 28% darker) ─────────────────
  bottomZoneShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },

  // ── Layer 8: Tab content row ──────────────────────────────────────────────
  // G6 Fix: NO paddingHorizontal — the tabRow in AppNavigator carries the padding.
  // Adding padding here was double-counting and misaligning the capsule.
  // G8 Fix: justifyContent removed — inner tabRow handles distribution.
  tabContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },

  // ── Layer 9: Specular rim — top bright line ───────────────────────────────
  // Rendered LAST in the absolute layer stack so it appears above everything
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: IS_IOS
      ? 'rgba(255, 255, 255, 0.62)'
      : 'rgba(255, 255, 255, 0.38)',
    // Soft glow halo on iOS
    ...(IS_IOS ? {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.65,
      shadowRadius: 4,
    } : {}),
  },

  // ── Layer 10a: Left fringe highlight ─────────────────────────────────────
  leftFringe: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: 1,
    bottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  // ── Layer 10b: Right fringe highlight ────────────────────────────────────
  rightFringe: {
    position: 'absolute',
    top: 10,
    right: 0,
    width: 1,
    bottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },

  // ── Layer 11: Bottom inner glow ───────────────────────────────────────────
  bottomInnerGlow: {
    position: 'absolute',
    bottom: 2,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(184, 255, 77, 0.10)',
  },

  // ── Layer 12: Inner shadow band — "carved glass" bottom edge ─────────────
  bottomInnerShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
  },
});

export default GlassBottomTabBar;
