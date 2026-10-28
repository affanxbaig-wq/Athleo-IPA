/**
 * GlassNavigationBar
 * ==================
 * Production-grade Apple-style frosted glass navigation bar.
 *
 * Design intent
 * -------------
 * Reproduces iOS's `UIBlurEffectStyle.systemUltraThinMaterial` on both platforms:
 * a heavy backdrop blur, a barely-there tinted wash, and one specular catch-light
 * along the top edge. Nothing else — Apple materials are defined by restraint.
 *
 * How the material adapts
 * -----------------------
 *  1. Colour scheme — `colorScheme` swaps the tint and, on iOS, the *actual*
 *     UIBlurEffectStyle (…MaterialDark / …MaterialLight), so the system material
 *     curve is used instead of a hand-rolled approximation.
 *  2. Scroll position — hand the bar a `scrollY` Animated.Value and the whole
 *     surface fades in across `collapseDistance` px, mirroring iOS's scroll-edge
 *     effect: invisible at the top of the content, fully materialised once the
 *     content has slid beneath it.
 *
 * Performance contract (this is the part that actually matters)
 * ------------------------------------------------------------
 *  • The blur radius is NEVER animated. Re-running the blur kernel every frame is
 *    the single biggest cause of dropped frames in glass UIs.
 *  • The only animated property is `opacity` on one pre-composited surface layer,
 *    which the native driver runs entirely on the UI thread. JS-thread work (data
 *    fetching, pedometer updates, state churn) cannot stall it.
 *  • `onScroll` is wired through `useGlassScrollHandler`, which uses
 *    Animated.event(..., {useNativeDriver: true}) — scroll offsets never cross
 *    the bridge and never trigger a React render.
 *  • The component is memoised and the blur subtree is created once. Because the
 *    public surface is primitive props (`title`, `scrollY`, numbers), a parent
 *    re-render does not re-render the bar, and the native blur surface is never
 *    torn down or rebuilt while scrolling.
 *  • On Android the blur is GPU-backed (RenderEffect, API 31+) and heavily
 *    downsampled — a blur is low-frequency by definition, so dropping to an
 *    eighth of the pixels is visually free.
 *  • Where a real blur is unavailable the same opacity animation drives opaque
 *    layered tints, so scroll smoothness is identical on every device tier.
 *
 * Touch behaviour
 * ---------------
 * The root is `pointerEvents="box-none"`. Interactive children still receive
 * taps, but drags that begin on empty bar space fall through to the scroll view
 * underneath — so the user can fling the list from the very top of the screen,
 * exactly as they can with a real iOS navigation bar.
 */

import React, {memo, useMemo} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/* ── Native blur, loaded defensively ────────────────────────────────────────
 * A build that ships without the native module still renders a solid material
 * instead of crashing. */
let BlurView: any = null;
try {
  const blurModule = require('@react-native-community/blur');
  BlurView =
    blurModule?.BlurView ?? blurModule?.default?.BlurView ?? blurModule?.default ?? null;
} catch {
  BlurView = null;
}

const IS_IOS = Platform.OS === 'ios';
const ANDROID_API = Platform.OS === 'android' ? (Platform.Version as number) : 0;
/**
 * Below Android 12 the backdrop blur falls back to software (RenderScript) and
 * costs a full-resolution capture per frame — far too expensive to sit behind a
 * scrolling list. API 31+ uses a GPU RenderEffect, which is effectively free, so
 * that is where we enable it. Older devices get the layered-tint material.
 */
const ANDROID_BLUR_SUPPORTED = ANDROID_API >= 31;
const HAS_NATIVE_BLUR = BlurView != null && (IS_IOS || ANDROID_BLUR_SUPPORTED);

/** Maps 1:1 onto UIBlurEffectStyle on iOS. */
export type GlassMaterial =
  | 'systemUltraThinMaterial'
  | 'systemThinMaterial'
  | 'systemMaterial'
  | 'systemThickMaterial';

export type GlassColorScheme = 'dark' | 'light';

/** Bar content height, excluding any safe-area inset. */
export const GLASS_NAV_BAR_HEIGHT = 52;

/** iOS blur kernel size. Large enough to read as frosted, short of mush. */
const IOS_BLUR_AMOUNT = 50;

const IOS_BLUR_TYPE: Record<GlassMaterial, Record<GlassColorScheme, string>> = {
  systemUltraThinMaterial: {dark: 'ultraThinMaterialDark', light: 'ultraThinMaterialLight'},
  systemThinMaterial: {dark: 'thinMaterialDark', light: 'thinMaterialLight'},
  systemMaterial: {dark: 'materialDark', light: 'materialLight'},
  systemThickMaterial: {dark: 'thickMaterialDark', light: 'thickMaterialLight'},
};

/** Translucent-ness of each material, following the UIBlurEffectStyle scale. */
const MATERIAL_DENSITY: Record<GlassMaterial, number> = {
  systemUltraThinMaterial: 0.30,
  systemThinMaterial: 0.46,
  systemMaterial: 0.62,
  systemThickMaterial: 0.80,
};

interface SchemeTokens {
  /** Base material colour. */
  tint: [number, number, number];
  /** Extra wash painted over the native blur. Kept tiny so Apple's own material reads. */
  blurWash: number;
  /** Tint alphas for the software fallback path (no native blur available). */
  fallbackBase: number;
  fallbackDensity: number;
  /** RGB used for the hairline and specular edges. */
  edge: [number, number, number];
  /** Bottom separator opacity. */
  borderAlpha: number;
  /** Top catch-light opacity. */
  topHighlightAlpha: number;
  titleColor: string;
  /** Solid colour handed to the native blur for assistive/reduced-transparency modes. */
  opaque: string;
}

const SCHEME_TOKENS: Record<GlassColorScheme, SchemeTokens> = {
  dark: {
    tint: [8, 28, 16],
    blurWash: 0.16,
    fallbackBase: 0.85,
    fallbackDensity: 0.25,
    edge: [184, 255, 77],
    borderAlpha: 0.25,
    topHighlightAlpha: 0.50,
    titleColor: '#FFFFFF',
    opaque: 'rgba(8, 28, 16, 0.98)',
  },
  light: {
    tint: [248, 249, 252],
    blurWash: 0.10,
    fallbackBase: 0.70,
    fallbackDensity: 0.26,
    edge: [255, 255, 255],
    borderAlpha: 0.22,
    topHighlightAlpha: 0.70,
    titleColor: '#0B0B0D',
    opaque: 'rgba(248, 249, 252, 0.97)',
  },
};

const rgba = (rgb: [number, number, number], alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/* ── Scroll wiring ────────────────────────────────────────────────────────── */

/**
 * Connects a scroll view to the bar without ever touching the JS thread.
 *
 *   const scrollY = useRef(new Animated.Value(0)).current;
 *   const onScroll = useGlassScrollHandler(scrollY);
 *
 *   <SmoothScrollView onScroll={onScroll} scrollEventThrottle={1} />
 *   <GlassNavigationBar scrollY={scrollY} />
 *
 * Pass `scrollEventThrottle={1}` so the value is refreshed every display frame
 * rather than being clamped to 60Hz — that is what keeps the fade glued to the
 * finger on 120Hz panels.
 */
export function useGlassScrollHandler(scrollY: Animated.Value) {
  return useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
        useNativeDriver: true,
      }),
    [scrollY],
  );
}

/* ── Component ────────────────────────────────────────────────────────────── */

export interface GlassNavigationBarProps {
  /** Always-visible content: buttons, avatars, segmented controls. */
  children?: React.ReactNode;
  /**
   * Live vertical scroll offset of the content behind the bar. Supply it and the
   * material fades in as the user scrolls; omit it for an always-on bar.
   */
  scrollY?: Animated.Value;
  /** Scroll distance, in px, over which the material reaches full density. */
  collapseDistance?: number;
  /** UIBlurEffectStyle equivalent. Defaults to `systemUltraThinMaterial`. */
  material?: GlassMaterial;
  /** Defaults to `dark`, matching the Athleo theme. */
  colorScheme?: GlassColorScheme;
  /** Inline title — centred, and faded in together with the material. */
  title?: string;
  /** Overrides for the inline title (font, size, …). */
  titleStyle?: StyleProp<TextStyle>;
  /** Content height, excluding `topInset`. */
  height?: number;
  /** Extra space above the content row, e.g. a status-bar inset. */
  topInset?: number;
  /** Renders the hairline separator along the bottom edge. */
  hairline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const GlassNavigationBar = memo(function GlassNavigationBar({
  children,
  scrollY,
  collapseDistance = 64,
  material = 'systemUltraThinMaterial',
  colorScheme = 'dark',
  title,
  titleStyle,
  height = GLASS_NAV_BAR_HEIGHT,
  topInset = 0,
  hairline = true,
  style,
}: GlassNavigationBarProps) {
  const tokens = SCHEME_TOKENS[colorScheme];
  const density = MATERIAL_DENSITY[material];

  /**
   * Single source of truth for the material's presence: 0 at the top of the
   * content, 1 once the content has slid `collapseDistance` px underneath.
   *
   * It is only ever attached to `opacity`, which is what lets the native driver
   * own it end to end — no JS frame can stutter mid-scroll.
   */
  const presence = useMemo(
    () =>
      scrollY
        ? scrollY.interpolate({
            inputRange: [0, collapseDistance],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          })
        : new Animated.Value(1),
    [scrollY, collapseDistance],
  );

  // Colour strings are derived from props, not state, so they are computed once
  // per render and stay stable — cheap enough that memoising them would cost more
  // than it saves.
  const tintColor = HAS_NATIVE_BLUR
    ? rgba(tokens.tint, tokens.blurWash + density * 0.18)
    : rgba(tokens.tint, tokens.fallbackBase + density * tokens.fallbackDensity);

  const separatorColor = rgba(tokens.edge, tokens.borderAlpha);
  const highlightColor = rgba(tokens.edge, tokens.topHighlightAlpha);

  return (
    <View
      style={[styles.root, {height: topInset + height}, style]}
      pointerEvents="box-none">

      {/* ── The material surface. One opacity-animated layer, composited once. ── */}
      <Animated.View
        style={[styles.surface, {opacity: presence}]}
        pointerEvents="none">

        {/* Backdrop blur — created once, radius never animated. */}
        {HAS_NATIVE_BLUR && BlurView ? (
          IS_IOS ? (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={IOS_BLUR_TYPE[material][colorScheme]}
              blurAmount={IOS_BLUR_AMOUNT}
              reducedTransparencyFallbackColor={tokens.opaque}
            />
          ) : (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={colorScheme}
              // Android throws above 25; 18 keeps the kernel cheap.
              blurRadius={18}
              // Blur a fraction of the pixels — free quality on the GPU path.
              downsampleFactor={8}
              blurAmount={20}
              overlayColor={rgba(tokens.tint, tokens.blurWash)}
              reducedTransparencyFallbackColor={tokens.opaque}
            />
          )
        ) : null}

        {/* Tinted wash: the material's colour, ramped by presence. */}
        <View style={[styles.fill, {backgroundColor: tintColor}]} />

        {/* Specular catch-light on the top edge — the UIKit material tell. */}
        <View style={[styles.topHighlight, {backgroundColor: highlightColor}]} />

        {/* Hairline separator so the bar reads as a distinct plane. */}
        {hairline ? (
          <View style={[styles.hairline, {backgroundColor: separatorColor}]} />
        ) : null}
      </Animated.View>

      {/* ── Safe-area spacer ── */}
      {topInset > 0 ? <View style={{height: topInset}} pointerEvents="none" /> : null}

      {/* ── Content row ── */}
      <View style={styles.row} pointerEvents="box-none">
        {title ? (
          <Animated.View
            style={[styles.titleWrap, {opacity: presence}]}
            pointerEvents="none">
            <Text
              numberOfLines={1}
              style={[styles.title, {color: tokens.titleColor}, titleStyle]}>
              {title}
            </Text>
          </Animated.View>
        ) : null}

        {children ? (
          <View style={styles.contentInner} pointerEvents="box-none">
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default GlassNavigationBar;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  hairline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  contentInner: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});
