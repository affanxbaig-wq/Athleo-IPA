---
name: Kinetic Obsidian
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#383939'
  surface-container-lowest: '#0d0e0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#292a2a'
  surface-container-highest: '#343535'
  on-surface: '#e3e2e2'
  on-surface-variant: '#c2cab0'
  inverse-surface: '#e3e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#8c947c'
  outline-variant: '#424936'
  surface-tint: '#96da27'
  primary: '#ffffff'
  on-primary: '#213600'
  primary-container: '#b1f746'
  on-primary-container: '#486f00'
  inverse-primary: '#446900'
  secondary: '#aad378'
  on-secondary: '#1f3700'
  secondary-container: '#315201'
  on-secondary-container: '#9dc56b'
  tertiary: '#ffffff'
  on-tertiary: '#442b00'
  tertiary-container: '#ffddb1'
  on-tertiary-container: '#895b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b1f746'
  primary-fixed-dim: '#96da27'
  on-primary-fixed: '#111f00'
  on-primary-fixed-variant: '#324f00'
  secondary-fixed: '#c6f091'
  secondary-fixed-dim: '#aad378'
  on-secondary-fixed: '#102000'
  on-secondary-fixed-variant: '#2f4f00'
  tertiary-fixed: '#ffddb1'
  tertiary-fixed-dim: '#ffba4b'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#624000'
  background: '#121414'
  on-background: '#e3e2e2'
  surface-variant: '#343535'
typography:
  display-hero:
    fontFamily: Montserrat
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  metric-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.04em
  metric-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  metric-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  metric-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
  label-interactive:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies high-octane human performance, precision conditioning, and futuristic athletic luxury. Engineered for elite movers, data-driven athletes, and design purists, the experience balances hyper-focused digital instrumentation with the tactile momentum of physical performance. 

The aesthetic synthesizes **High-Contrast / Bold** modernism with technical minimalism. Deep, void-like blacks reduce visual noise and preserve physiological focus, while sharp, electrifying acid accents pierce through the dark to demand instantaneous attention and celebrate milestones. Every interface surface behaves like a carbon-composite cockpit: crisp, deliberate, devoid of decorative clutter, and tuned for split-second biometric clarity in intense workout environments.

## Colors

The palette establishes an aggressive, high-contrast dark space calibrated for OLED vibrancy and intense focus under varying real-world gym illumination.

### Functional Roles
- **Base Canvas (`#0B0B0D`):** The master ambient backdrop. Void-like, deeply saturated charcoal black that minimizes power consumption and provides maximum contrast.
- **Surface Level 1 (`#141417`):** Primary card, container, and sheet background. Separates core interactives from the global canvas.
- **Surface Level 2 (`#1C1C20`):** Elevated components, modals, floating action bars, and nested metrics cards.
- **Hairline Border (`rgba(255, 255, 255, 0.08)`): Structural boundary system across all containers, maintaining razor-sharp geometric definition without visual bulk.
- **Primary / Hyper Lime (`#B8FF4D`):** The primary kinetic signal. Used for primary CTAs, active tracking states, key milestone charts, and high-priority visual targets.
- **Lime Pale (`#D4FF9E`):** Secondary interactive tier, hover halos, metric graph fill gradients, and focused states.
- **Text Primary (`#FFFFFF`):** Absolute white reserved for titles, key metrics, and primary text fields.
- **Text Secondary / Silver Gray (`#A0A0A0`):** Subheaders, metadata, inactive labels, and auxiliary units.
- **Warning / Kinetic Amber (`#FFB020`):** Fatigue levels, threshold heart rate warnings, and plateau alerts.
- **Danger / Crimson Sprint (`#FF5A5F`):** Overload warnings, maximum heart rate zone overshoots, destructive actions, and critical notifications.

## Typography

The typographic hierarchy separates muscular, confident brand directives from surgical, instrument-grade data visualization.

- **Montserrat** delivers structural power, geometric solidity, and unyielding momentum for hero displays, module titles, and body instruction. All headings feature tighter negative tracking to reinforce dense, athletic tension.
- **Space Grotesk** serves as the technical engine. Reserved strictly for metrics, timers, rep counters, tabular data, axis units, and micro-caps status pills. Its engineered letterforms prevent tabular shifting during live numerical telemetry updates.
- **Rules of Hierarchy:** Any quantitative metric (heart rate, pace, tonnage, calorie count) must default to Space Grotesk. Narrative instructions, workouts names, and user commentary always run in Montserrat.

## Layout & Spacing

Layouts follow a fluid, responsive structure constructed around an 8pt architectural grid rhythm.

### Grid Anatomy
- **Mobile (<768px):** 4-column fluid layout with `1rem` outer canvas margin and `1rem` column gutters. Cards and biometric tiles stack vertically to enable ergonomic thumb access during active motion.
- **Tablet (768px - 1023px):** 8-column layout with `2rem` margins. Modules group in 4-column pairs (side-by-side metric analytics and route feeds).
- **Desktop / Large Dashboard (≥1024px):** 12-column fixed-max layout (constrained to 1440px viewport width) with `3rem` margins and `1.5rem` gutters. Left rail hosts persistent tactical navigation, while the central canvas dynamically partitions between real-time data feeds and deep-work program builders.

### Rhythm Principles
- Component interior spacing strictly adheres to the `space-*` tokens. Metric tiles lock their vertical internal padding to `space-lg` (`1.5rem`) to ensure massive legibility at arms-length during movement.
- Edge-to-edge full bleed is permitted solely for linear activity graphs and camera visualizer modes.

## Elevation & Depth

Visual depth is achieved through an interplay of tonal layering and razor-sharp perimeter definition rather than traditional soft diffused drop shadows. This preserves the ultra-crisp, cockpit-like precision required by the brand.

### Surface Tiers
- **Tier 0 (Base Canvas):** `#0B0B0D` serves as the subterranean backdrop.
- **Tier 1 (Surface):** `#141417` combined with a `1px` outer hairline border of `rgba(255, 255, 255, 0.08)`. Default container state for activity feeds, calendar cards, and performance modules.
- **Tier 2 (Surface Raised):** `#1C1C20` with `1px` border of `rgba(255, 255, 255, 0.12)`. Applied to active telemetry counters, floating bottom bars, context drawers, and elevated interactive cards.
- **Tier 3 (Overlay / Modal):** `#1C1C20` backdrop blur (`24px`) with a top highlight rim of `rgba(184, 255, 77, 0.2)` transitioning to `rgba(255, 255, 255, 0.08)`.

### Luminescent Energy (Glows)
Volumetric diffuse glows are reserved exclusively for critical kinetic triggers:
- When a target threshold is smashed or an active session is in live recording, active chips and primary buttons emit an ambient radiance: `box-shadow: 0 0 24px -4px rgba(184, 255, 77, 0.35)`.
- Critical zone alerts utilize `box-shadow: 0 0 20px -4px rgba(255, 90, 95, 0.4)`.

## Shapes

The geometric architecture balances organic ergonomics with architectural discipline:
- **Major Cards & Structural Containers:** Calibrated to `20px` border-radius (`rounded-xl` equivalent). This provides modern softness without feeling cartoonish, framing complex biometric charts in sleek containment.
- **Buttons & Action Triggers:** Standardized to `16px` border-radius (`rounded-lg`). Creates a firm, tactile finger-target that visually nests comfortably inside container modules.
- **Status Pills, Tags, Segment Filters & Counter Chips:** Standardized to `rounded-full` (`9999px`). These capsule silhouettes contrast sharply against angular grid lines, signaling lightweight interactivity and dynamic state transitions.
- **Inner Nested Elements:** Always obey the concentric radius formula: nested radius equals outer container radius minus container padding.

## Components

### Buttons
- **Primary Kinetic:** Background `#B8FF4D`, label text `#0B0B0D` (`Space Grotesk`, `700`, uppercase tracking). Height: `56px` for primary workout launch triggers; `48px` for standard flows. Corner radius: `16px`. Active press: `scale(0.98)` with a faint lime back-glow.
- **Secondary Surface:** Background `#1C1C20`, label text `#FFFFFF`, border: `1px solid rgba(255, 255, 255, 0.08)`. Hover/Focus: border shifts to `rgba(184, 255, 77, 0.4)` and text gains `#D4FF9E`.
- **Ghost Tactical:** Transparent background, text `#A0A0A0`, hover text `#FFFFFF` with no border.

### Metric Cards & Containers
- Built on `#141417` with `20px` radius and `1px solid rgba(255, 255, 255, 0.08)`.
- Metric numbers are rendered in `Space Grotesk` (`metric-xl` or `metric-lg`) in `#FFFFFF`. Metric labels and measurement units sit adjacent or directly above in `label-caps` using `#A0A0A0`.
- Real-time active states transition the card border to `rgba(184, 255, 77, 0.3)` with an optional top hairline highlight.

### Chips & Filter Pills
- Fully rounded (`9999px`), height `32px`, horizontal padding `14px`.
- **Default State:** Background `#1C1C20`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#A0A0A0` in `label-caps`.
- **Selected State:** Background `#B8FF4D`, border `1px solid #B8FF4D`, text `#0B0B0D` with weight `700`.

### Data Lists & Set Logs
- Row items sit on `#141417` or clear backgrounds separated by a `1px` divider of `rgba(255, 255, 255, 0.04)`.
- Height: `56px` minimum for workout log inputs. Leading elements hold set counters in pill containers; trailing elements hold tabular numeric weights and reps in `Space Grotesk`.

### Form Inputs & Adjusters
- Container: `#0B0B0D` background nested within `#141417` surfaces. Radius: `14px`. Height: `52px`.
- Border: `1px solid rgba(255, 255, 255, 0.08)`. On focus: `1px solid #B8FF4D` with an instantaneous `0 0 12px rgba(184, 255, 77, 0.2)` aura.
- Text: Input values use `Space Grotesk` in `#FFFFFF`. Floating micro-labels use `label-caps` in `#A0A0A0`.

### Checkboxes & Toggle Controls
- Checkbox dimensions: `22px x 22px`, `6px` radius. Border: `1.5px solid rgba(255, 255, 255, 0.2)`. Checked state: background `#B8FF4D` with `#0B0B0D` stroke icon.
- Toggles: Capsule frame (`48px x 28px`), background `#1C1C20`. Active handle slides with `#B8FF4D` filling the track bed.

### Heart Rate & Kinetic Progress Bars
- Background track: `rgba(255, 255, 255, 0.06)`, height `8px`, radius `9999px`.
- Active segment: Solid `#B8FF4D` or gradient transitioning from `#B8FF4D` to `#FFB020` when entering anaerobic thresholds, ending in `#FF5A5F` for redline zones.