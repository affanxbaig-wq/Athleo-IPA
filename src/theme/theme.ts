import {Dimensions, Platform} from 'react-native';

/**
 * Shared scroll-view bottom padding so content clears the floating tab bar.
 * TabBar height (68) + bottom offset (iOS:20 / Android:12) + safety margin (16).
 */
export const TAB_BAR_BOTTOM_PADDING = Platform.OS === 'ios' ? 108 : 100;

export const ATHLEO_COLORS = {
  background: '#06180D',
  surface: '#0D2C19',
  surfaceRaised: '#143D24',
  /** Solid secondary surface — the fill of an inactive option. */
  surfaceSolid: '#11361F',
  hairline: 'rgba(184,255,77,0.22)',
  /** Inactive borders / dividers. */
  border: 'rgba(184,255,77,0.35)',
  /** Glassmorphism card fill. */
  glass: 'rgba(184,255,77,0.08)',
  text: '#FFFFFF',
  muted: '#E2FCE8',
  accent: '#B8FF4D',
  accentSoft: '#D4FF9E',
  /** Translucent lime wash behind selected surfaces. */
  accentDim: 'rgba(184,255,77,0.18)',
  /** Lime glow for selected options and primary CTAs. */
  accentGlow: 'rgba(184,255,77,0.60)',
  success: '#195427',
  warning: '#FFD700',
  danger: '#FF5A5F',
  track: '#123A21',
  shadow: 'rgba(184,255,77,0.25)',
} as const;

export const ATHLEO_RADIUS = {
  card: 20,
  /** Glassmorphism surface radius. */
  glass: 16,
  button: 16,
  pill: 999,
} as const;

/**
 * The type scale the onboarding questionnaire renders against.
 *
 * Kept as numbers (not `fontSize: …` objects) so a screen can scale them with
 * `scaleFont()` where a device needs it.
 */
export const ATHLEO_TYPE = {
  question: 26,
  questionLine: 34,
  subtitle: 16,
  subtitleLine: 24,
  option: 17,
  optionLine: 24,
  metric: 24,
  label: 14,
  cta: 16,
} as const;

/** Lime glow shared by every selected option and primary CTA. */
export const ATHLEO_GLOW = {
  shadowColor: '#B8FF4D',
  shadowOpacity: 0.55,
  shadowRadius: 16,
  shadowOffset: {width: 0, height: 0},
  elevation: 0,
} as const;

export const ATHLEO_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const ATHLEO_MOTION = {
  pressScale: 0.95,
  durationFast: 180,
  durationBase: 280,
  durationSlow: 450,
  durationHero: 700,
  stagger: 50,
  ring: 800,
} as const;

export const ATHLEO_FONT = {
  display: 'Montserrat-ExtraBold',
  heading: 'Montserrat-Bold',
  title: 'Montserrat-Bold',
  body: 'Montserrat-Bold',
  metric: 'SpaceGrotesk-Bold',
  metricStrong: 'SpaceGrotesk-Bold',
};

export const ATHLEO_THEME = {
  colors: ATHLEO_COLORS,
  radius: ATHLEO_RADIUS,
  spacing: ATHLEO_SPACING,
  motion: ATHLEO_MOTION,
  fonts: ATHLEO_FONT,
};

// ─── Responsive Layout ────────────────────────────────────────────────────────

const {width: _SW, height: _SH} = Dimensions.get('window');

export const ATHLEO_LAYOUT = {
  screenWidth: _SW,
  screenHeight: _SH,
  isSmall: _SW < 375,
  isMedium: _SW >= 375 && _SW <= 414,
  isLarge: _SW > 414,
  isTablet: _SW >= 600,
};

/**
 * Scale a font size proportionally to the device width.
 * Reference design width: 390px (iPhone 14 Pro / Pixel 7).
 * Ensures no text is below 14px for bold readability.
 */
export function scaleFont(base: number): number {
  const scale = Math.min(1.2, Math.max(0.9, _SW / 390));
  return Math.max(14, Math.round(base * scale));
}

/**
 * Scale a pixel dimension proportionally to the device width.
 */
export function scalePx(base: number): number {
  const scale = Math.min(1.2, Math.max(0.8, _SW / 390));
  return Math.round(base * scale);
}
