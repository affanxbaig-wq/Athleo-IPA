/**
 * DynamicFeedbackCard.tsx — the personalised results card.
 *
 * Renders the numbers the backend calculation engine derived from the user's
 * onboarding answers (`get_user_advice()` → Mifflin-St Jeor BMR → TDEE →
 * calorie / macro / water / step targets) plus the two highest-priority
 * coaching cards, in the Black & Lime visual language:
 *
 *   • every calculated figure is lime (#B8FF4D) and set in Space Grotesk,
 *   • supporting copy stays on the muted silver + glass surface.
 *
 * Purely presentational — the caller owns fetching, loading and fallback so the
 * same card can render backend numbers or the offline derivation.
 */

import React from 'react';
import {ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import type {UserAdviceBundle} from '../services/adviceService';
import {ATHLEO_COLORS, ATHLEO_SPACING, ATHLEO_TYPE} from '../theme/theme';
import {METRIC_FONT_STRONG} from '../theme/typography';
import {AnimatedText as Text} from './AnimatedText';
import {GlassCard} from './GlassCard';

interface DynamicFeedbackCardProps {
  bundle: UserAdviceBundle | null;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

function bmiBand(bmi: number): string {
  if (bmi < 18.5) {
    return 'Underweight';
  }
  if (bmi < 25) {
    return 'Healthy range';
  }
  if (bmi < 30) {
    return 'Overweight';
  }
  return 'Obese';
}

function litres(ml: number): string {
  return `${(ml / 1000).toFixed(1)} L`;
}

export function DynamicFeedbackCard({bundle, loading = false, style}: DynamicFeedbackCardProps) {
  const targets = bundle?.targets ?? null;

  const tiles = targets
    ? [
        {label: 'Calories', value: targets.calorie_target.toLocaleString(), sub: 'kcal / day'},
        {label: 'Protein', value: `${targets.protein_target_g} g`, sub: 'per day'},
        {label: 'Carbs', value: `${targets.carb_target_g} g`, sub: 'per day'},
        {label: 'Fat', value: `${targets.fat_target_g} g`, sub: 'per day'},
        {label: 'Water', value: litres(targets.water_target_ml), sub: 'per day'},
        {label: 'Steps', value: targets.steps_target.toLocaleString(), sub: 'per day'},
      ]
    : [];

  const advice = (bundle?.advice ?? []).slice(0, 2);

  return (
    <GlassCard style={[styles.card, style]}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>Your numbers</Text>
        {bundle ? (
          <Text style={[styles.badge, bundle.source === 'backend' && styles.badgeLive]}>
            {bundle.source === 'backend' ? 'Synced' : 'Offline estimate'}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={ATHLEO_COLORS.accent} />
          <Text style={styles.loadingText}>Calculating your targets…</Text>
        </View>
      ) : null}

      {!loading && targets ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Body mass index</Text>
            <Text style={styles.heroValue}>{Number(targets.bmi ?? 0).toFixed(1)}</Text>
            <Text style={styles.heroBand}>{bmiBand(Number(targets.bmi ?? 0))}</Text>
            <Text style={styles.heroMeta}>
              BMR {Number(targets.bmr ?? 0).toLocaleString()} · TDEE{' '}
              {Number(targets.tdee ?? 0).toLocaleString()} kcal
            </Text>
          </View>

          <View style={styles.grid}>
            {tiles.map(tile => (
              <View key={tile.label} style={styles.tile}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileValue}>{tile.value}</Text>
                <Text style={styles.tileSub}>{tile.sub}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {!loading && !targets ? (
        <Text style={styles.empty}>
          Finish your measurements and your calorie, macro and step targets appear here.
        </Text>
      ) : null}

      {advice.length > 0 ? (
        <View style={styles.adviceList}>
          {advice.map((item, index) => (
            <View key={item.id ?? `${item.category}-${index}`} style={styles.adviceRow}>
              <View style={styles.adviceDot} />
              <View style={styles.adviceCopy}>
                <Text style={styles.adviceTitle}>{item.title}</Text>
                <Text style={styles.adviceBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {gap: ATHLEO_SPACING.md},

  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  eyebrow: {
    color: ATHLEO_COLORS.accent,
    fontSize: ATHLEO_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  badge: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLive: {color: ATHLEO_COLORS.accent, borderColor: ATHLEO_COLORS.accent},

  loading: {alignItems: 'center', gap: 10, paddingVertical: ATHLEO_SPACING.lg},
  loadingText: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  empty: {color: '#E2FCE8', fontSize: 14, lineHeight: 20, fontWeight: '700'},

  hero: {gap: 4},
  heroLabel: {
    color: '#FFFFFF',
    fontSize: ATHLEO_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: ATHLEO_COLORS.accent,
    fontSize: 42,
    lineHeight: 48,
    fontFamily: METRIC_FONT_STRONG,
    fontWeight: '900',
  },
  heroBand: {color: '#FFFFFF', fontSize: 15, fontWeight: '800'},
  heroMeta: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', marginTop: 2},

  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    backgroundColor: '#0F3820',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    borderRadius: ATHLEO_SPACING.sm + 4,
    padding: 14,
  },
  tileLabel: {
    color: '#FFFFFF',
    fontSize: ATHLEO_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tileValue: {
    color: ATHLEO_COLORS.accent,
    fontSize: ATHLEO_TYPE.metric,
    fontFamily: METRIC_FONT_STRONG,
    fontWeight: '900',
  },
  tileSub: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},

  adviceList: {gap: 12, borderTopWidth: 1, borderTopColor: ATHLEO_COLORS.hairline, paddingTop: 14},
  adviceRow: {flexDirection: 'row', gap: 10},
  adviceDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.accent,
    marginTop: 6,
  },
  adviceCopy: {flex: 1, minWidth: 0},
  adviceTitle: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3},
  adviceBody: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18},
});
