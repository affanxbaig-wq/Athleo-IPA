import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {getLevelSnapshot} from '../data/athleoProgress';
import {appStorage} from '../services/storage';
import {ATHLEO_COLORS} from '../theme/theme';
import {ATHLEO_FAMILY} from '../theme/typography';

const XP_STORAGE_KEY = 'athleo_user_xp';

/** Returns the persisted XP total, defaulting to 0 for brand-new accounts. */
function getStoredXp(): number {
  const raw = appStorage.getString(XP_STORAGE_KEY);
  if (!raw) { return 0; }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function ProfileXPPanel() {
  const [xp, setXp] = useState<number>(getStoredXp);

  // Re-read XP whenever the component mounts (e.g. user navigates back to profile).
  useEffect(() => {
    setXp(getStoredXp());
  }, []);

  const snapshot = getLevelSnapshot(xp);

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.labelChip}>
          <Icon name="sparkles" size={12} color={ATHLEO_COLORS.accent} />
          <Text style={styles.label}>XP &amp; Levels</Text>
        </View>
        <Text style={styles.xpText}>{snapshot.currentXp.toLocaleString()} XP</Text>
      </View>

      <Text style={styles.levelText}>Level {snapshot.level}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, {width: `${snapshot.progress * 100}%`}]} />
      </View>

      <Text style={styles.metaText}>
        {snapshot.xpRemaining} XP to Level {snapshot.level + 1}
      </Text>
    </AppCard>
  );
}

/**
 * Add XP for the current user and persist it.
 * Call this from anywhere in the app (e.g. after a workout completes).
 */
export function awardXp(amount: number): void {
  const current = getStoredXp();
  const next = Math.max(0, current + amount);
  appStorage.setString(XP_STORAGE_KEY, String(next));
}

/**
 * Wipe XP back to zero. Called by resetUserDataForNewUser() so every brand-new
 * account starts at Level 1 with 0 XP.
 */
export function resetXp(): void {
  appStorage.setString(XP_STORAGE_KEY, '0');
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ATHLEO_COLORS.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  label: { color: ATHLEO_COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  xpText: { color: ATHLEO_COLORS.muted, fontWeight: '700', fontSize: 13 },
  levelText: {
    color: ATHLEO_COLORS.text,
    fontFamily: ATHLEO_FAMILY.metricBold,
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 14,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.track,
    marginTop: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  fill: { height: '100%', backgroundColor: ATHLEO_COLORS.accent, borderRadius: 999 },
  metaText: { color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 10, opacity: 0.85 },
});
