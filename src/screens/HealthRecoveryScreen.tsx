import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {
  getCalorieTarget,
  getProgressHistory,
  getWeeklyReport,
  getTodayEntry,
  updateTodayEntry,
  type DailyEntry,
  type WeeklyReport,
} from '../services/progressTracker';
import {getUserProfile} from '../services/userProfile';

interface HealthRecoveryScreenProps {
  navigate?: (tab: any) => void;
}

type RecoveryTab = 'Recovery' | 'Sleep' | 'Trends';

function useLocalTime(): string {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true}));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useLocalDate(): string {
  const now = new Date();
  return now.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'});
}

export function HealthRecoveryScreen({navigate: _navigate}: HealthRecoveryScreenProps) {
  const [activeTab, setActiveTab] = useState<RecoveryTab>('Recovery');
  const [today, setToday] = useState<DailyEntry | null>(null);
  const [history, setHistory] = useState<DailyEntry[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepMinutes, setSleepMinutes] = useState(48);
  const [waterGlasses, setWaterGlasses] = useState(6);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [fadeAnim] = useState(new Animated.Value(0));

  const localTime = useLocalTime();
  const localDate = useLocalDate();
  const profile = getUserProfile();
  const calorieTarget = getCalorieTarget();

  const load = useCallback(() => {
    setToday(getTodayEntry());
    setHistory(getProgressHistory(30));
    setWeeklyReport(getWeeklyReport());
  }, []);

  useEffect(() => {
    load();
    Animated.timing(fadeAnim, {toValue: 1, duration: 500, useNativeDriver: true}).start();
  }, [load, fadeAnim]);

  const pulseRef = useRef(new Animated.Value(1));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef.current, {toValue: 1.08, duration: 1200, useNativeDriver: true}),
        Animated.timing(pulseRef.current, {toValue: 1, duration: 1200, useNativeDriver: true}),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Compute recovery score from data
  const sleepTotalMin = sleepHours * 60 + sleepMinutes;
  const sleepScore = Math.min(100, Math.round((sleepTotalMin / 480) * 50 + (mood / 5) * 30 + (waterGlasses / 8) * 20));
  const todaySteps = today?.steps ?? 0;
  const stepsBonus = Math.min(20, Math.round((todaySteps / 10000) * 20));
  const caloriesLogged = today?.calories ?? 0;
  const nutritionScore = Math.min(20, Math.round((caloriesLogged / Math.max(1, calorieTarget)) * 20));
  const readinessScore = Math.min(100, sleepScore + stepsBonus + nutritionScore - (mood < 3 ? 10 : 0));

  const readinessBand = readinessScore >= 85 ? 'PEAK' : readinessScore >= 70 ? 'GOOD' : readinessScore >= 50 ? 'MODERATE' : 'LOW';
  const readinessColor = readinessScore >= 85 ? ATHLEO_COLORS.accent : readinessScore >= 70 ? '#3AB4FF' : readinessScore >= 50 ? '#FFB020' : '#FF6B6B';

  const saveToday = useCallback(() => {
    updateTodayEntry({
      sleepMinutes: sleepTotalMin,
      waterMl: waterGlasses * 250,
      mood,
    });
  }, [sleepTotalMin, waterGlasses, mood]);

  const MOODS: {val: 1 | 2 | 3 | 4 | 5; emoji: string; label: string}[] = [
    {val: 1, emoji: '😩', label: 'Terrible'},
    {val: 2, emoji: '😕', label: 'Low'},
    {val: 3, emoji: '😐', label: 'Okay'},
    {val: 4, emoji: '😊', label: 'Good'},
    {val: 5, emoji: '🔥', label: 'Peak'},
  ];

  const renderRecovery = () => (
    <>
      {/* Readiness Score */}
      <AppCard style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <View>
            <Text style={styles.eyebrow}>Readiness Score</Text>
            <Text style={styles.localDate}>{localDate}</Text>
          </View>
          <View style={[styles.bandTag, {borderColor: readinessColor}]}>
            <Text style={[styles.bandText, {color: readinessColor}]}>{readinessBand}</Text>
          </View>
        </View>

        <Animated.View style={[styles.scoreRing, {borderColor: readinessColor, transform: [{scale: pulseRef.current}], shadowColor: readinessColor}]}>
          <Image
            source={require('../assets/images/heart-beat.png')}
            style={[styles.heartBeatImg, {tintColor: readinessColor}]}
            resizeMode="contain"
          />
          <Text style={[styles.scoreNum, {color: readinessColor}]}>{readinessScore}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </Animated.View>

        <View style={styles.scoreBreakdown}>
          {[
            {label: 'Sleep', val: sleepScore, color: '#C87AFF'},
            {label: 'Steps', val: stepsBonus * 5, color: '#3AB4FF'},
            {label: 'Nutrition', val: nutritionScore * 5, color: '#FFB020'},
          ].map(item => (
            <View key={item.label} style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <View style={styles.miniTrack}>
                <View style={[styles.miniFill, {width: `${Math.min(100, item.val)}%`, backgroundColor: item.color}]} />
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      {/* Sleep Entry */}
      <AppCard style={styles.inputCard}>
        <Text style={styles.cardTitle}>Last Night's Sleep</Text>
        <View style={styles.dualCounter}>
          <View style={styles.counterGroup}>
            <Text style={styles.counterLabel}>Hours</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSleepHours(h => Math.max(0, h - 1))}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterVal}>{sleepHours}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSleepHours(h => Math.min(12, h + 1))}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.counterGroup}>
            <Text style={styles.counterLabel}>Min</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSleepMinutes(m => Math.max(0, m - 15))}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterVal}>{sleepMinutes.toString().padStart(2, '0')}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSleepMinutes(m => (m + 15) % 60)}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Text style={styles.sleepTotal}>{sleepHours}h {sleepMinutes}m total</Text>
      </AppCard>

      {/* Water */}
      <AppCard style={styles.inputCard}>
        <Text style={styles.cardTitle}>Hydration — {waterGlasses * 250}ml today</Text>
        <View style={styles.waterGlasses}>
          {[1,2,3,4,5,6,7,8].map(g => (
            <TouchableOpacity key={g} onPress={() => setWaterGlasses(g)} style={[styles.glassDrop, waterGlasses >= g && styles.glassDropFilled]}>
              <Icon name="water" size={20} color={waterGlasses >= g ? '#3AB4FF' : ATHLEO_COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      {/* Mood */}
      <AppCard style={styles.inputCard}>
        <Text style={styles.cardTitle}>How do you feel today?</Text>
        <View style={styles.moodRow}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.val} onPress={() => setMood(m.val)} style={[styles.moodBtn, mood === m.val && styles.moodBtnActive]}>
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, mood === m.val && styles.moodLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      {/* HR/Body Metrics */}
      <AppCard style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Biometrics</Text>
        <View style={styles.bioGrid}>
          {[
            {label: 'Resting HR', value: `${Math.round(52 + (5 - mood) * 2)} bpm`, icon: 'heart-outline', color: '#FF6B6B'},
            {label: 'HRV', value: `${Math.round(58 + mood * 4)} ms`, icon: 'pulse-outline', color: '#3AB4FF'},
            {label: 'Body Temp', value: `${(36.5 + (mood < 3 ? 0.3 : 0)).toFixed(1)}°C`, icon: 'thermometer-outline', color: '#FFB020'},
            {label: 'Steps', value: todaySteps.toLocaleString(), icon: 'footsteps-outline', color: ATHLEO_COLORS.accent},
          ].map(item => (
            <View key={item.label} style={styles.bioItem}>
              <Icon name={item.icon} size={18} color={item.color} />
              <Text style={[styles.bioValue, {color: item.color}]}>{item.value}</Text>
              <Text style={styles.bioLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <TouchableOpacity style={styles.saveBtn} onPress={saveToday}>
        <Icon name="save-outline" size={16} color={ATHLEO_COLORS.background} />
        <Text style={styles.saveBtnText}>SAVE TODAY'S DATA</Text>
      </TouchableOpacity>
    </>
  );

  const renderSleep = () => (
    <>
      <AppCard style={styles.sleepOverview}>
        <Text style={styles.cardTitle}>Sleep Analysis</Text>
        <View style={styles.sleepRing}>
          <Text style={styles.sleepScore}>{sleepScore}</Text>
          <Text style={styles.sleepScoreLabel}>Sleep Score</Text>
        </View>
        <View style={styles.sleepStages}>
          {[
            {stage: 'Deep', min: Math.round(sleepTotalMin * 0.2), color: '#3AB4FF'},
            {stage: 'REM', min: Math.round(sleepTotalMin * 0.22), color: '#C87AFF'},
            {stage: 'Light', min: Math.round(sleepTotalMin * 0.42), color: '#FFB020'},
            {stage: 'Awake', min: Math.round(sleepTotalMin * 0.06), color: '#FF6B6B'},
          ].map(s => (
            <View key={s.stage} style={styles.stageRow}>
              <View style={[styles.stageDot, {backgroundColor: s.color}]} />
              <Text style={styles.stageName}>{s.stage}</Text>
              <View style={styles.stageBarWrap}>
                <View style={[styles.stageBar, {width: `${Math.min(100, (s.min / sleepTotalMin) * 100)}%`, backgroundColor: s.color}]} />
              </View>
              <Text style={styles.stageMins}>{Math.floor(s.min / 60)}h {s.min % 60}m</Text>
            </View>
          ))}
        </View>
      </AppCard>
      <AppCard style={styles.inputCard}>
        <Text style={styles.cardTitle}>Recovery Tips</Text>
        {[
          sleepScore < 60 ? '😴 Aim for 7–9h of sleep. You\'re below optimal recovery.' : '✅ Great sleep duration — keep it consistent.',
          mood < 3 ? '🧘 Low mood detected. Consider a light walk or 10min meditation.' : '💪 Mood is solid — push hard today.',
          waterGlasses < 5 ? '💧 You\'re under-hydrated. Drink 2+ more glasses today.' : '✅ Hydration on track!',
          todaySteps < 5000 ? '🚶 Step count is low. A 20-min walk adds ~2,500 steps.' : '✅ Active steps logged today.',
        ].map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </AppCard>
    </>
  );

  const renderTrends = () => (
    <>
      <AppCard style={styles.trendCard}>
        <Text style={styles.cardTitle}>30-Day Sleep (min)</Text>
        <View style={styles.barChart}>
          {history.map((e, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, {
                height: `${Math.min(100, (e.sleepMinutes / 480) * 100)}%`,
                backgroundColor: '#C87AFF',
                opacity: 0.3 + i * (0.7 / history.length),
              }]} />
            </View>
          ))}
        </View>
      </AppCard>
      <AppCard style={styles.trendCard}>
        <Text style={styles.cardTitle}>Weekly Report</Text>
        {weeklyReport && (
          <View style={styles.weekReport}>
            <View style={styles.weekReportRow}>
              <Text style={styles.weekReportLabel}>Avg Sleep</Text>
              <Text style={styles.weekReportVal}>{Math.floor(weeklyReport.avgSleep / 60)}h {weeklyReport.avgSleep % 60}m</Text>
            </View>
            <View style={styles.weekReportRow}>
              <Text style={styles.weekReportLabel}>Total Workouts</Text>
              <Text style={styles.weekReportVal}>{weeklyReport.totalWorkouts}</Text>
            </View>
            <View style={styles.weekReportRow}>
              <Text style={styles.weekReportLabel}>Avg Steps</Text>
              <Text style={styles.weekReportVal}>{weeklyReport.avgSteps.toLocaleString()}</Text>
            </View>
            <View style={styles.weekReportRow}>
              <Text style={styles.weekReportLabel}>Streak</Text>
              <Text style={styles.weekReportVal}>{weeklyReport.streakDays}d 🔥</Text>
            </View>
          </View>
        )}
      </AppCard>
    </>
  );

  return (
    <Animated.View style={[styles.wrapper, {opacity: fadeAnim}]}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Live Clock Header */}
        <View style={styles.clockHeader}>
          <View>
            <Text style={styles.screenTitle}>Health & Recovery</Text>
            <Text style={styles.clockDate}>{localDate}</Text>
          </View>
          <View style={styles.clockPill}>
            <Icon name="time-outline" size={12} color={ATHLEO_COLORS.accent} />
            <Text style={styles.clockTime}>{localTime}</Text>
          </View>
        </View>

        {/* Profile Context */}
        <View style={styles.contextRow}>
          <Text style={styles.contextText}>
            {profile.weightKg}kg • {profile.goal?.replace(/^./, c => c.toUpperCase()) ?? 'Goal'} • {profile.activityLevel?.replace(/^./, c => c.toUpperCase()) ?? 'Active'}
          </Text>
          <TouchableOpacity onPress={load}>
            <Icon name="refresh-outline" size={16} color={ATHLEO_COLORS.muted} />
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabs}>
          {(['Recovery', 'Sleep', 'Trends'] as RecoveryTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Recovery' && renderRecovery()}
        {activeTab === 'Sleep' && renderSleep()}
        {activeTab === 'Trends' && renderTrends()}
      </SmoothScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 110, gap: 14},
  clockHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  screenTitle: {color: ATHLEO_COLORS.text, fontSize: 26, fontWeight: '800'},
  clockDate: {color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 2},
  clockPill: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(184,255,77,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(184,255,77,0.2)'},
  clockTime: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 13},
  contextRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  contextText: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  tabs: {flexDirection: 'row', gap: 6, backgroundColor: '#0D331D', borderRadius: 14, padding: 6, borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  tabBtn: {flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  tabBtnActive: {backgroundColor: ATHLEO_COLORS.accent, borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  tabText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase'},
  tabTextActive: {color: '#071F12', fontWeight: '900'},
  scoreCard: {padding: 18, borderRadius: 20, alignItems: 'center', gap: 14, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  scoreHeader: {width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  eyebrow: {color: '#E2FCE8', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '800'},
  localDate: {color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 3},
  bandTag: {borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1},
  bandText: {fontWeight: '900', fontSize: 12, letterSpacing: 1},
  scoreRing: {
    width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, backgroundColor: 'rgba(184,255,77,0.08)',
    shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: {width: 0, height: 0},
  },
  heartBeatImg: {
    width: 26,
    height: 26,
    marginBottom: 2,
  },
  scoreNum: {fontSize: 38, fontWeight: '900'},
  scoreMax: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  scoreBreakdown: {width: '100%', gap: 8},
  breakdownItem: {gap: 4},
  breakdownLabel: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  miniTrack: {height: 6, backgroundColor: '#0F3820', borderRadius: 999, overflow: 'hidden'},
  miniFill: {height: '100%', borderRadius: 999},
  inputCard: {padding: 16, borderRadius: 18, gap: 12, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  cardTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '800'},
  dualCounter: {flexDirection: 'row', gap: 20},
  counterGroup: {flex: 1, gap: 8},
  counterLabel: {color: '#FFFFFF', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800'},
  counterRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  counterBtn: {width: 42, height: 42, borderRadius: 12, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  counterBtnText: {color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 26},
  counterVal: {color: '#FFFFFF', fontSize: 28, fontWeight: '900', minWidth: 40, textAlign: 'center'},
  sleepTotal: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 14},
  waterGlasses: {flexDirection: 'row', gap: 8},
  glassDrop: {width: 40, height: 40, borderRadius: 12, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  glassDropFilled: {backgroundColor: 'rgba(58,180,255,0.2)', borderColor: '#3AB4FF'},
  moodRow: {flexDirection: 'row', gap: 6},
  moodBtn: {flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: '#0F3820', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  moodBtnActive: {backgroundColor: 'rgba(184,255,77,0.2)', borderColor: ATHLEO_COLORS.accent},
  moodEmoji: {fontSize: 22},
  moodLabel: {color: '#FFFFFF', fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '800'},
  moodLabelActive: {color: ATHLEO_COLORS.accent},
  metricsCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  bioGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10},
  bioItem: {width: '47%', backgroundColor: '#0F3820', borderRadius: 14, padding: 14, gap: 4, borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  bioValue: {fontSize: 20, fontWeight: '900', color: '#FFFFFF'},
  bioLabel: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 16,
    shadowColor: ATHLEO_COLORS.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 0},
  },
  saveBtnText: {color: '#071F12', fontWeight: '900', fontSize: 15, letterSpacing: 1},
  sleepOverview: {padding: 18, borderRadius: 20, alignItems: 'center', gap: 14},
  sleepRing: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(200,122,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(200,122,255,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  sleepScore: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800'},
  sleepScoreLabel: {color: '#C87AFF', fontSize: 11, fontWeight: '700'},
  sleepStages: {width: '100%', gap: 10},
  stageRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stageDot: {width: 8, height: 8, borderRadius: 4},
  stageName: {color: ATHLEO_COLORS.text, fontWeight: '600', width: 48, fontSize: 12},
  stageBarWrap: {flex: 1, height: 6, backgroundColor: '#1E1E22', borderRadius: 999, overflow: 'hidden'},
  stageBar: {height: '100%', borderRadius: 999},
  stageMins: {color: ATHLEO_COLORS.muted, fontSize: 11, width: 48, textAlign: 'right'},
  tipRow: {paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: ATHLEO_COLORS.hairline},
  tipText: {color: ATHLEO_COLORS.text, fontSize: 13, lineHeight: 20},
  trendCard: {padding: 16, borderRadius: 18, gap: 10},
  barChart: {flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 3},
  barCol: {flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center'},
  bar: {width: '80%', borderRadius: 4, minHeight: 4},
  weekReport: {marginTop: 10, gap: 10},
  weekReportRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ATHLEO_COLORS.hairline},
  weekReportLabel: {color: ATHLEO_COLORS.muted},
  weekReportVal: {color: ATHLEO_COLORS.text, fontWeight: '700'},
});
