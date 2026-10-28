import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {AnimatedText as Text} from './AnimatedText';
import {ATHLEO_COLORS} from '../theme/theme';

export interface PlateSpec {
  weight: number;
  count: number;
  color: string;
  height: number;
  width: number;
  textColor: string;
}

const PLATE_CONFIGS: Record<number, {color: string; height: number; width: number; textColor: string}> = {
  25: {color: '#EF4444', height: 86, width: 14, textColor: '#FFFFFF'},
  20: {color: '#3B82F6', height: 80, width: 14, textColor: '#FFFFFF'},
  15: {color: '#F59E0B', height: 72, width: 12, textColor: '#0B0E14'},
  10: {color: '#10B981', height: 64, width: 12, textColor: '#FFFFFF'},
  5: {color: '#F1F5F9', height: 52, width: 10, textColor: '#0B0E14'},
  2.5: {color: '#334155', height: 44, width: 8, textColor: '#FFFFFF'},
  1.25: {color: '#94A3B8', height: 36, width: 7, textColor: '#0B0E14'},
};

const STANDARD_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const BAR_WEIGHT = 20;

interface BarbellPlateVisualizerProps {
  totalWeightKg: number;
}

export function BarbellPlateVisualizer({totalWeightKg}: BarbellPlateVisualizerProps) {
  const {platesNeeded, weightPerSide, isBarOnly, underBarWeight} = useMemo(() => {
    const numeric = Math.max(0, totalWeightKg);
    if (numeric < BAR_WEIGHT) {
      return {platesNeeded: [], weightPerSide: 0, isBarOnly: false, underBarWeight: true};
    }
    if (numeric === BAR_WEIGHT) {
      return {platesNeeded: [], weightPerSide: 0, isBarOnly: true, underBarWeight: false};
    }

    let remainingPerSide = Math.round(((numeric - BAR_WEIGHT) / 2) * 100) / 100;
    const perSideTotal = remainingPerSide;
    const result: PlateSpec[] = [];

    for (const p of STANDARD_PLATES) {
      if (remainingPerSide >= p) {
        const count = Math.floor(remainingPerSide / p);
        const cfg = PLATE_CONFIGS[p];
        result.push({
          weight: p,
          count,
          color: cfg.color,
          height: cfg.height,
          width: cfg.width,
          textColor: cfg.textColor,
        });
        remainingPerSide = Math.round((remainingPerSide - count * p) * 100) / 100;
      }
    }

    return {platesNeeded: result, weightPerSide: perSideTotal, isBarOnly: false, underBarWeight: false};
  }, [totalWeightKg]);

  return (
    <View style={styles.container}>
      {/* Header bar info */}
      <View style={styles.rackHeader}>
        <Text style={styles.rackLabel}>OLYMPIC SLEEVE (PER SIDE)</Text>
        <Text style={styles.rackWeightText}>
          +{weightPerSide} kg <Text style={styles.rackBarText}>+ 20kg bar</Text>
        </Text>
      </View>

      {/* Barbell graphic representation */}
      <View style={styles.barGraphicCard}>
        <View style={styles.barbellWrapper}>
          {/* Inner Shaft / Knurling */}
          <View style={styles.innerShaft}>
            <View style={styles.knurlTexture} />
          </View>

          {/* Inner Collar Stop */}
          <View style={styles.innerCollar} />

          {/* Sleeve Shaft with Stacked Plates */}
          <View style={styles.sleeveTrack}>
            {/* The steel sleeve rod behind plates */}
            <View style={styles.sleeveSteelRod} />

            {/* Rendered Plates from heavy to light */}
            <View style={styles.platesRack}>
              {platesNeeded.map(spec =>
                Array.from({length: spec.count}).map((_, i) => (
                  <View
                    key={`${spec.weight}-${i}`}
                    style={[
                      styles.plateBlock,
                      {
                        backgroundColor: spec.color,
                        height: spec.height,
                        width: spec.width,
                        borderColor: 'rgba(255,255,255,0.25)',
                      },
                    ]}>
                    <View style={styles.plateHighlight} />
                  </View>
                )),
              )}

              {/* Barbell Spring Collar Clip */}
              {platesNeeded.length > 0 && (
                <View style={styles.barbellCollarClip}>
                  <View style={styles.clipLoop} />
                </View>
              )}
            </View>

            {/* Sleeve Cap End */}
            <View style={styles.sleeveCap} />
          </View>
        </View>

        {underBarWeight && (
          <Text style={styles.statusNote}>⚠️ Target weight is below standard 20kg Olympic barbell.</Text>
        )}
        {isBarOnly && (
          <Text style={styles.statusNote}>✓ Bare 20kg Olympic bar. No additional plates required.</Text>
        )}
      </View>

      {/* Plate count pill list */}
      {platesNeeded.length > 0 && (
        <View style={styles.platePillGrid}>
          {platesNeeded.map(spec => (
            <View key={spec.weight} style={styles.platePill}>
              <View style={[styles.plateDot, {backgroundColor: spec.color}]} />
              <Text style={styles.platePillWeight}>{spec.weight} kg</Text>
              <View style={styles.plateCountBadge}>
                <Text style={styles.plateCountText}>×{spec.count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  rackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rackLabel: {
    color: '#8E9E90',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rackWeightText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  rackBarText: {
    color: '#8E9E90',
    fontSize: 11,
    fontWeight: '700',
  },
  barGraphicCard: {
    backgroundColor: '#07160D',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.25)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  barbellWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 96,
  },
  innerShaft: {
    width: 36,
    height: 14,
    backgroundColor: '#475569',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  knurlTexture: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  innerCollar: {
    width: 9,
    height: 46,
    backgroundColor: '#64748B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  sleeveTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    minWidth: 160,
  },
  sleeveSteelRod: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: '#94A3B8',
    borderRadius: 2,
    borderTopWidth: 2,
    borderTopColor: '#CBD5E1',
    borderBottomWidth: 2,
    borderBottomColor: '#64748B',
  },
  platesRack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 2,
    paddingLeft: 2,
  },
  plateBlock: {
    borderRadius: 3,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  plateHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  barbellCollarClip: {
    marginLeft: 3,
    width: 8,
    height: 36,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipLoop: {
    width: 14,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginLeft: -4,
  },
  sleeveCap: {
    width: 6,
    height: 20,
    backgroundColor: '#475569',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: 8,
    zIndex: 1,
  },
  statusNote: {
    color: '#8E9E90',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  platePillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  platePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F3820',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.3)',
    gap: 6,
  },
  plateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  platePillWeight: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  plateCountBadge: {
    backgroundColor: 'rgba(184, 255, 77, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plateCountText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 11,
    fontWeight: '900',
  },
});
