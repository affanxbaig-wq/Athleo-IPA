import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Svg, {Circle} from 'react-native-svg';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {
  CHALLENGE_CATALOGUE,
  getBadges,
  getChallengeProgress,
  getJoinedChallenges,
  getLeaderboard,
  syncLeaderboardWithCloud,
  joinChallenge,
  leaveChallenge,
  refreshProgress,
  type BadgeInfo,
  type ChallengeId,
  type LeaderboardEntry,
} from '../services/challengeService';
import {getSteps} from '../services/dailyTracker';

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({
  progress,
  goal,
  color,
  size = 100,
}: {
  progress: number;
  goal: number;
  color: string;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, progress / Math.max(1, goal));
  const dash = circumference * ratio;

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={cx} cy={cy} r={radius}
        stroke={`${color}25`}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress */}
      <Circle
        cx={cx} cy={cy} r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx}, ${cy}`}
      />
    </Svg>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ChallengesScreen() {
  const [joined, setJoined] = useState<ChallengeId[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeId | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const reload = useCallback(() => {
    if (!isMountedRef.current) {return;}
    refreshProgress();
    setJoined(getJoinedChallenges().map(jc => jc.challengeId));
    setBadges(getBadges());
    const sel = selectedChallenge ?? (getJoinedChallenges()[0]?.challengeId ?? CHALLENGE_CATALOGUE[0].id);
    setSelectedChallenge(sel);
    setLeaderboard(getLeaderboard(sel));

    // Pull real cloud participants in background
    syncLeaderboardWithCloud(sel)
      .then(cloudBoard => {
        if (isMountedRef.current && cloudBoard) {
          setLeaderboard(cloudBoard);
        }
      })
      .catch(() => undefined);
  }, [selectedChallenge]);

  useEffect(() => {
    reload();
    Animated.timing(fadeAnim, {toValue: 1, duration: 400, useNativeDriver: true}).start();

    // Auto-refresh leaderboard every 30 seconds
    const interval = setInterval(() => {
      if (!isMountedRef.current) {return;}
      const sel = selectedChallenge ?? (getJoinedChallenges()[0]?.challengeId ?? CHALLENGE_CATALOGUE[0].id);
      syncLeaderboardWithCloud(sel)
        .then(res => {
          if (isMountedRef.current && res) {
            setLeaderboard(res);
          }
        })
        .catch(() => undefined);
    }, 30000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = (id: ChallengeId) => {
    joinChallenge(id);
    reload();
  };

  const handleLeave = (id: ChallengeId) => {
    leaveChallenge(id);
    if (selectedChallenge === id) {setSelectedChallenge(null);}
    reload();
  };

  const handleSelectChallenge = (id: ChallengeId) => {
    setSelectedChallenge(id);
    setLeaderboard(getLeaderboard(id));
    syncLeaderboardWithCloud(id)
      .then(res => {
        if (isMountedRef.current && res) {
          setLeaderboard(res);
        }
      })
      .catch(() => undefined);
  };

  const earnedBadges = badges.filter(b => b.earned);
  const unearnedBadges = badges.filter(b => !b.earned);

  return (
    <Animated.View style={[styles.wrapper, {opacity: fadeAnim}]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Challenges</Text>

        {/* ── Hero Banner ── */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBannerContent}>
            <View style={styles.heroImgRow}>
              <Image source={require('../assets/images/target.png')} style={styles.heroImg} resizeMode="contain" />
              <Image source={require('../assets/images/group.png')} style={styles.heroGroupImg} resizeMode="contain" />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroBannerTitle}>Compete. Win. Repeat.</Text>
              <Text style={styles.heroBannerSub}>Join global challenges and climb the leaderboard</Text>
            </View>
          </View>
        </View>

        {/* ── Active Challenges ── */}
        {CHALLENGE_CATALOGUE.filter(c => joined.includes(c.id)).map(challenge => {
          // For step-based challenges, use live step count from dailyTracker
          const liveSteps = getSteps();
          const rawProgress = getChallengeProgress(challenge.id);
          const progress = challenge.goalUnit === 'steps' ? Math.max(rawProgress, liveSteps) : rawProgress;
          const pct = Math.round(Math.min(100, (progress / challenge.goal) * 100));
          return (
            <AppCard key={challenge.id} style={styles.activeCard}>
              <View style={styles.activeCardTop}>
                <View style={styles.ringWrap}>
                  <ProgressRing
                    progress={progress}
                    goal={challenge.goal}
                    color={challenge.color}
                    size={90}
                  />
                  <View style={styles.ringCenter}>
                    <Text style={[styles.ringPct, {color: challenge.color}]}>{pct}%</Text>
                  </View>
                </View>
                <View style={styles.activeCardInfo}>
                  <View style={[styles.badge, {backgroundColor: `${challenge.color}22`, borderColor: `${challenge.color}55`}]}>
                    <Text style={[styles.badgeText, {color: challenge.color}]}>{challenge.badge}</Text>
                  </View>
                  <Text style={styles.challengeName}>{challenge.title}</Text>
                  <Text style={styles.challengeDesc}>
                    {progress.toLocaleString()} / {challenge.goal.toLocaleString()} {challenge.goalUnit}
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {width: `${pct}%`, backgroundColor: challenge.color}]} />
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.leaderboardBtn}
                  onPress={() => handleSelectChallenge(challenge.id)}>
                  <Icon name="podium-outline" size={14} color={ATHLEO_COLORS.accent} />
                  <Text style={styles.leaderboardBtnText}>Leaderboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => handleLeave(challenge.id)}>
                  <Text style={styles.leaveBtnText}>Leave</Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          );
        })}

        {/* ── Leaderboard ── */}
        {selectedChallenge && (() => {
          const ch = CHALLENGE_CATALOGUE.find(c => c.id === selectedChallenge);
          if (leaderboard.length === 0) {
            return (
              <AppCard style={styles.emptyLeaderboard}>
                <View style={styles.sectionRow}>
                  <Icon name="trophy-outline" size={16} color="#FFB020" />
                  <Text style={styles.sectionTitle}>{ch?.title ?? ''} — Leaderboard</Text>
                </View>
                <View style={styles.emptyLeaderInner}>
                  <Text style={styles.emptyLeaderEmoji}>🏆</Text>
                  <Text style={styles.emptyLeaderTitle}>Claim the #1 Spot</Text>
                  <Text style={styles.emptyLeaderSub}>
                    Be the first athlete to join this challenge and own the top of the ranking.
                  </Text>
                </View>
              </AppCard>
            );
          }
          return (
            <AppCard style={styles.leaderboardCard}>
              <View style={styles.sectionRow}>
                <Icon name="trophy-outline" size={16} color="#FFB020" />
                <Text style={styles.sectionTitle}>{ch?.title ?? ''} — Leaderboard</Text>
              </View>
              {leaderboard.slice(0, 8).map(entry => (
                <View key={entry.rank} style={[styles.leaderRow, entry.isYou && styles.leaderRowYou]}>
                  <Text style={[styles.leaderRank, entry.rank <= 3 && styles.leaderRankTop]}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                  </Text>
                  <View style={[styles.leaderAvatar, {backgroundColor: entry.isYou ? `${ATHLEO_COLORS.accent}33` : '#1E1E22'}]}>
                    <Text style={styles.leaderAvatarText}>{entry.avatar}</Text>
                  </View>
                  <Text style={[styles.leaderName, entry.isYou && styles.leaderNameYou]}>{entry.name}</Text>
                  <Text style={[styles.leaderScore, {color: ch?.color ?? ATHLEO_COLORS.accent}]}>{entry.scoreLabel}</Text>
                </View>
              ))}
            </AppCard>
          );
        })()}

        {/* ── Challenge Catalogue ── */}
        <Text style={styles.groupLabel}>Available Challenges</Text>
        {CHALLENGE_CATALOGUE.map(challenge => {
          const alreadyJoined = joined.includes(challenge.id);
          const isSelected = selectedChallenge === challenge.id;
          return (
            <TouchableOpacity
              key={challenge.id}
              activeOpacity={0.88}
              onPress={() => handleSelectChallenge(challenge.id)}>
              <AppCard style={[styles.catalogCard, isSelected && styles.catalogCardSelected]}>
                <View style={styles.catalogTop}>
                  <View style={[styles.catalogIconWrap, {backgroundColor: `${challenge.color}18`}]}>
                    <Text style={styles.catalogEmoji}>{challenge.emoji}</Text>
                  </View>
                  <View style={styles.catalogInfo}>
                    <View style={[styles.badge, {backgroundColor: `${challenge.color}22`, borderColor: `${challenge.color}55`}]}>
                      <Text style={[styles.badgeText, {color: challenge.color}]}>{challenge.badge}</Text>
                    </View>
                    <Text style={styles.catalogTitle}>{challenge.title}</Text>
                    <Text style={styles.catalogDesc}>{challenge.description}</Text>
                    <Text style={styles.catalogMeta}>
                      <Icon name={challenge.icon} size={11} color={ATHLEO_COLORS.muted} /> {challenge.goal.toLocaleString()} {challenge.goalUnit} · {challenge.durationDays}d
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.joinBtn, alreadyJoined && styles.joinBtnActive]}
                  onPress={() => alreadyJoined ? handleLeave(challenge.id) : handleJoin(challenge.id)}>
                  <Text style={[styles.joinBtnText, alreadyJoined && styles.joinBtnTextActive]}>
                    {alreadyJoined ? '✓ Joined' : 'Join Challenge'}
                  </Text>
                </TouchableOpacity>
              </AppCard>
            </TouchableOpacity>
          );
        })}

        {/* ── Trophy Shelf ── */}
        <Text style={styles.groupLabel}>🏆 Your Badges</Text>
        <AppCard style={styles.trophyCard}>
          {earnedBadges.length === 0 && (
            <Text style={styles.noEarnedText}>Complete challenges to earn your first badge!</Text>
          )}
          <View style={styles.badgeGrid}>
            {earnedBadges.map(badge => (
              <View key={badge.id} style={[styles.badgeCell, styles.badgeCellEarned, {borderColor: `${badge.color}55`}]}>
                <Text style={styles.badgeCellEmoji}>{badge.emoji}</Text>
                <Text style={[styles.badgeCellLabel, {color: badge.color}]}>{badge.label}</Text>
                {badge.earnedAt && <Text style={styles.badgeCellDate}>{badge.earnedAt.slice(5)}</Text>}
              </View>
            ))}
            {unearnedBadges.map(badge => (
              <View key={badge.id} style={styles.badgeCell}>
                <Text style={[styles.badgeCellEmoji, styles.badgeCellEmojiLocked]}>{badge.emoji}</Text>
                <Text style={styles.badgeCellLabelLocked}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.spacer} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 120, gap: 12},
  title: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800'},
  // Hero banner
  heroBanner: {backgroundColor: '#0E1A11', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(184,255,77,0.25)'},
  heroBannerContent: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14},
  heroImgRow: {flexDirection: 'row', alignItems: 'center', gap: -8},
  heroImg: {width: 44, height: 44},
  heroGroupImg: {width: 44, height: 44},
  heroTextWrap: {flex: 1},
  heroBannerTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  heroBannerSub: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 3, lineHeight: 16},
  groupLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 4},
  sectionRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  sectionTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '700'},
  // Active challenge card
  activeCard: {padding: 16, borderRadius: 20, gap: 12},
  activeCardTop: {flexDirection: 'row', gap: 14, alignItems: 'center'},
  ringWrap: {position: 'relative', width: 90, height: 90},
  ringCenter: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
  ringPct: {fontWeight: '900', fontSize: 18},
  activeCardInfo: {flex: 1, gap: 4},
  badge: {alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2},
  badgeText: {fontSize: 9, fontWeight: '800', letterSpacing: 1},
  challengeName: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 2},
  challengeDesc: {color: ATHLEO_COLORS.muted, fontSize: 12},
  progressTrack: {height: 5, backgroundColor: '#1E1E22', borderRadius: 999, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 999},
  cardActions: {flexDirection: 'row', gap: 8},
  leaderboardBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(184,255,77,0.08)', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(184,255,77,0.2)'},
  leaderboardBtnText: {color: ATHLEO_COLORS.accent, fontWeight: '700', fontSize: 12},
  leaveBtn: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1B1C', borderWidth: 1, borderColor: ATHLEO_COLORS.hairline},
  leaveBtnText: {color: ATHLEO_COLORS.muted, fontWeight: '700', fontSize: 12},
  // Leaderboard
  leaderboardCard: {padding: 16, borderRadius: 18},
  leaderRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ATHLEO_COLORS.hairline},
  leaderRowYou: {backgroundColor: 'rgba(184,255,77,0.05)', borderRadius: 10, marginHorizontal: -4, paddingHorizontal: 4},
  leaderRank: {width: 32, color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700', textAlign: 'center'},
  leaderRankTop: {fontSize: 16},
  leaderAvatar: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  leaderAvatarText: {color: ATHLEO_COLORS.text, fontWeight: '800', fontSize: 13},
  leaderName: {flex: 1, color: ATHLEO_COLORS.text, fontWeight: '600', fontSize: 13},
  leaderNameYou: {color: ATHLEO_COLORS.accent, fontWeight: '800'},
  leaderScore: {fontWeight: '700', fontSize: 12},
  // Empty leaderboard state
  emptyLeaderboard: {padding: 16, borderRadius: 18},
  emptyLeaderInner: {alignItems: 'center', paddingVertical: 24, gap: 10},
  emptyLeaderEmoji: {fontSize: 44},
  emptyLeaderTitle: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800', textAlign: 'center'},
  emptyLeaderSub: {color: ATHLEO_COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12},
  // Catalogue
  catalogCard: {padding: 16, borderRadius: 18, gap: 12},
  catalogCardSelected: {borderColor: 'rgba(184,255,77,0.45)', borderWidth: 1},
  catalogTop: {flexDirection: 'row', gap: 12},
  catalogIconWrap: {width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  catalogEmoji: {fontSize: 24},
  catalogInfo: {flex: 1, gap: 3},
  catalogTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800', marginTop: 2},
  catalogDesc: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18},
  catalogMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},
  joinBtn: {borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: ATHLEO_COLORS.accent},
  joinBtnActive: {backgroundColor: 'rgba(184,255,77,0.18)', borderWidth: 1.5, borderColor: ATHLEO_COLORS.accent},
  joinBtnText: {color: '#071F12', fontWeight: '900', letterSpacing: 0.5, fontSize: 15},
  joinBtnTextActive: {color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 15},
  // Trophy shelf
  trophyCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  noEarnedText: {color: '#E2FCE8', fontSize: 14, textAlign: 'center', marginBottom: 12, fontWeight: '700'},
  badgeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  badgeCell: {width: '22%', alignItems: 'center', backgroundColor: '#0F3820', borderRadius: 14, padding: 10, gap: 4, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  badgeCellEarned: {backgroundColor: '#143D24', borderColor: ATHLEO_COLORS.accent},
  badgeCellEmoji: {fontSize: 24},
  badgeCellEmojiLocked: {opacity: 0.35, fontSize: 24},
  badgeCellLabel: {fontSize: 12, fontWeight: '800', textAlign: 'center', color: '#FFFFFF'},
  badgeCellLabelLocked: {color: '#E2FCE8', fontSize: 11, textAlign: 'center', fontWeight: '700'},
  badgeCellDate: {color: '#D4FFB2', fontSize: 11, fontWeight: '700'},
  spacer: {height: 40},
});
