/**
 * typography.ts — "Kinetic Obsidian" app-wide type system.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Every screen used inline numeric font sizes with no `fontFamily`, so the whole
 * app fell back to Android's default Roboto — the flat, generic, "made by a
 * machine" look. The Kinetic Obsidian spec (kinetic_obsidian/DESIGN.md) calls
 * for Montserrat (display + body) and Space Grotesk (numeric metrics only).
 *
 * HOW RN LOADS THESE
 * ──────────────────
 * The TTFs live in `android/app/src/main/assets/fonts/`. Android's
 * ReactFontManager resolves a family by FILE NAME and appends a style suffix
 * whenever a weight is set:
 *
 *     fontFamily 'Montserrat-Bold' + fontWeight '700'
 *        → looks for assets/fonts/Montserrat-Bold_bold.ttf   ✗ (missing)
 *        → falls back to Typeface.create('Montserrat-Bold')  ✗ (unknown)
 *        → renders in the SYSTEM font  ← silently breaks the design
 *
 *     fontFamily 'Montserrat-Bold' + fontWeight 'normal'
 *        → assets/fonts/Montserrat-Bold.ttf                  ✓
 *
 * The weight is therefore expressed by *choosing the right file*, and the CSS
 * weight is normalised to 'normal'. That is what `familyForWeight` does below.
 *
 * HOW IT IS APPLIED
 * ─────────────────
 * RN 0.79's `Text`/`TextInput` are `React.forwardRef` components, and the
 * renderer reads `type.render` at render time — so patching `.render` once at
 * startup restyles every string in the app without touching ~30 screens.
 * A screen that genuinely needs a different family (e.g. Space Grotesk metrics)
 * just sets `fontFamily` explicitly — explicit always wins.
 */

import {StyleSheet, Text, TextInput, type TextStyle} from 'react-native';

// ─── The bundled families (must match the .ttf file names exactly) ───────────
export const ATHLEO_FAMILY = {
  regular: 'Montserrat-Regular',
  medium: 'Montserrat-Medium',
  semiBold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  extraBold: 'Montserrat-ExtraBold',
  metric: 'SpaceGrotesk-Medium',
  metricSemiBold: 'SpaceGrotesk-SemiBold',
  metricBold: 'SpaceGrotesk-Bold',
} as const;

const BUNDLED_FAMILIES = new Set<string>(Object.values(ATHLEO_FAMILY));

/** Numeric/metric face — DESIGN.md: "any quantitative metric MUST be Space Grotesk". */
export const METRIC_FONT = ATHLEO_FAMILY.metricSemiBold;
export const METRIC_FONT_STRONG = ATHLEO_FAMILY.metricBold;

type Weight = TextStyle['fontWeight'];

/** Maps a CSS weight onto the bundled Montserrat file that actually carries it. Default to bold. */
export function familyForWeight(weight?: Weight | null): string {
  switch (String(weight ?? '700')) {
    case '800':
    case '900':
      return ATHLEO_FAMILY.extraBold;
    default:
      return ATHLEO_FAMILY.bold;
  }
}

type FontKeys = {fontFamily?: unknown; fontWeight?: unknown; fontSize?: number};

/**
 * Last-wins scan of a (possibly nested) RN style for font keys and fontSize.
 * Deliberately NOT StyleSheet.flatten — flatten would deep-spread Animated
 * values out of the `Animated.Text` style arrays used across the app.
 */
function readFontKeys(style: unknown): FontKeys {
  const found: FontKeys = {};

  const visit = (node: unknown): void => {
    if (!node) {
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        visit(entry);
      }
      return;
    }
    if (typeof node === 'number') {
      const flat = StyleSheet.flatten(node) as any;
      if (flat?.fontFamily != null) {
        found.fontFamily = flat.fontFamily;
      }
      if (flat?.fontWeight != null) {
        found.fontWeight = flat.fontWeight;
      }
      if (typeof flat?.fontSize === 'number') {
        found.fontSize = flat.fontSize;
      }
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    const candidate = node as any;
    if (candidate.fontFamily != null) {
      found.fontFamily = candidate.fontFamily;
    }
    if (candidate.fontWeight != null) {
      found.fontWeight = candidate.fontWeight;
    }
    if (typeof candidate.fontSize === 'number') {
      found.fontSize = candidate.fontSize;
    }
  };

  visit(style);
  return found;
}

/** Injects a resolved family, normalising the weight and enforcing minimum font size. */
function resolveProps(props: Record<string, unknown>): Record<string, unknown> {
  if (!props) {
    return props;
  }
  const {fontFamily, fontWeight, fontSize} = readFontKeys(props?.style);

  // A non-bundled family (e.g. 'Ionicons', 'monospace') is a deliberate choice — respect it.
  if (fontFamily != null && !BUNDLED_FAMILIES.has(String(fontFamily))) {
    return props;
  }

  const family = fontFamily != null ? String(fontFamily) : familyForWeight(fontWeight as Weight);

  const styleOverrides: TextStyle = {
    fontFamily: family,
    fontWeight: 'normal',
  };

  // Enforce no small fonts (< 13px) app-wide across all screens
  if (typeof fontSize === 'number' && fontSize < 13) {
    styleOverrides.fontSize = 13;
  }

  return {
    ...props,
    style: [props?.style, styleOverrides],
  };
}

function patchRender(component: any): void {
  const originalRender = component?.render;
  if (typeof originalRender !== 'function' || originalRender.__athleoFontPatch) {
    return;
  }

  const patched = function (this: unknown, props: any, ref: any) {
    if (!props) {
      return originalRender.call(this, props, ref);
    }
    try {
      return originalRender.call(this, resolveProps(props), ref);
    } catch {
      return originalRender.call(this, props, ref);
    }
  };
  (patched as any).__athleoFontPatch = true;
  component.render = patched;
}

let installed = false;

/** Idempotent. Called once at startup — safe to call again from anywhere. */
export function installAppTypography(): void {
  if (installed) {
    return;
  }
  installed = true;
  patchRender(Text);
  patchRender(TextInput);
}

// Self-installing: importing this module (see index.js) is enough.
installAppTypography();
