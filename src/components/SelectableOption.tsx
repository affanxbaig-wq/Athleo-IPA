/**
 * SelectableOption.tsx — the one selector used by every onboarding question.
 *
 * States (design directive §2):
 *   inactive : fill #1A1A1E, label #A0A0A0, no glow
 *   active   : transparent fill, 2px #B8FF4D border, #FFFFFF label, lime glow
 *
 * Border width is 2px in BOTH states on purpose: growing the border on
 * selection would shift every sibling in the row by a pixel.
 *
 * `variant="card"` is the full-width row / illustration card, `variant="pill"`
 * is the compact chip used for multi-select answers.
 */

import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {ATHLEO_COLORS, ATHLEO_GLOW, ATHLEO_RADIUS, ATHLEO_SPACING, ATHLEO_TYPE} from '../theme/theme';
import {AnimatedText as Text} from './AnimatedText';
import {PressableScale} from './PressableScale';

export interface SelectableOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Ionicon rendered before the label. */
  icon?: string;
  /** Tint for an unselected icon. */
  iconColor?: string;
  /** Second line under the label. */
  description?: string;
  /** Illustration rendered above the label — used by the body-shape cards. */
  image?: ImageSourcePropType;
  variant?: 'card' | 'pill';
  style?: StyleProp<ViewStyle>;
}

export function SelectableOption({
  label,
  selected,
  onPress,
  icon,
  iconColor,
  description,
  image,
  variant = 'card',
  style,
}: SelectableOptionProps) {
  const isPill = variant === 'pill';

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{selected}}
      accessibilityLabel={label}
      style={[
        isPill ? styles.pill : styles.card,
        selected ? styles.active : styles.inactive,
        image ? styles.cardWithImage : null,
        style,
      ]}>
      {image ? <Image source={image} style={styles.image} resizeMode="contain" /> : null}

      <View style={isPill ? styles.pillRow : styles.row}>
        {icon ? (
          <Icon
            name={icon}
            size={20}
            color={selected ? ATHLEO_COLORS.accent : iconColor ?? ATHLEO_COLORS.muted}
          />
        ) : null}

        <View style={isPill ? styles.copyPill : styles.copyCard}>
          <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>

        {selected ? (
          <Icon name="checkmark-circle" size={isPill ? 16 : 18} color={ATHLEO_COLORS.accent} />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    borderWidth: 2,
    borderRadius: ATHLEO_RADIUS.glass,
    paddingHorizontal: ATHLEO_SPACING.md,
    paddingVertical: 14,
    minHeight: 58,
    justifyContent: 'center',
  },
  cardWithImage: {
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    borderWidth: 2,
    borderRadius: ATHLEO_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inactive: {
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderColor: ATHLEO_COLORS.border,
  },
  active: {
    backgroundColor: 'rgba(184, 255, 77, 0.18)',
    borderColor: ATHLEO_COLORS.accent,
    ...ATHLEO_GLOW,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  pillRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  copyCard: {flex: 1, minWidth: 0},
  copyPill: {flexShrink: 1},
  image: {width: 104, height: 104},
  label: {
    color: '#FFFFFF',
    fontSize: ATHLEO_TYPE.option,
    fontWeight: '800',
    lineHeight: ATHLEO_TYPE.optionLine,
  },
  labelActive: {color: '#FFFFFF', fontWeight: '900'},
  description: {
    color: '#D4FFB2',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 3,
  },
});
