import React, {useCallback, useEffect, useState} from 'react';
import {Animated, StyleSheet, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {SatisfyingBarChart} from '../components/SatisfyingBarChart';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';
import {
  getCalorieTarget,
  getProgressHistory,
  getProteinTarget,
  getStepsTarget,
  getTodayEntry,
  getWeeklyReport,
  type DailyEntry,
  type WeeklyReport,
  type WeekGrade,
  type PRHighlight,
  type DayActivity,
} from '../services/progressTracker';
import {getUserProfile} from '../services/userProfile';
import {
  getWorkoutHeatmap,
  getMacroBreakdown,
  getBodyCompositionEstimate,
  getVolumeTrend,
} from '../services/analyticsService';

interface ProgressScreenProps {
  navigate?: (tab: TabKey) => void;
}

const TABS = ['Overview', 'Weekly', 'Analytics', 'History'] as const;
type ProgressTab = (typeof TABS)[number];

export function ProgressScreen({navigate: _navigate}: ProgressScreenProps) {
  const [activeTab, setActiveTab] = useState<ProgressTab>('Overview');
  const [today, setToday] = useState<DailyEntry | null>(null);
  const [history, setHistory] = useState<DailyEntry[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const loadData = useCallback(() => {
    setToday(getTodayEntry());
    setHistory(getProgressHistory(30));
    setWeeklyReport(getWeeklyReport());
  }, []);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {toValue: 1, duration: 500, useNativeDriver: true}).start();
  }, [loadData, fadeAnim]);

  const profile = getUserProfile();
  const calorieTarget = getCalorieTarget();
  const proteinTarget = getProteinTarget();
  const stepsTarget = getStepsTarget();

  const todayCalories = today?.calories ?? 0;
  const todaySteps = today?.steps ?? 0;
  const todayWeight = today?.weightKg ?? profile.weightKg;
  const calorieProgress = Math.min(100, (todayCalories / calorieTarget) * 100);
  const stepsProgress = Math.min(100, (todaySteps / stepsTarget) * 100);

  const startingWeight = history[0]?.weightKg ?? profile.weightKg;
  const weightChange = todayWeight - startingWeight;

  const renderOverview = () => (
    <>
      {/* Today's Stats */}
      <AppCard style={styles.todayCard}>
        <View style={styles.cardRowBetween}>
          <Text style={styles.sectionTitle}>Today</Text>
          <TouchableOpacity onPress={loadData}>
            <Icon name="refresh" size={16} color={ATHLEO_COLORS.muted} />
          </TouchableOpacity>
        </View>

        {/* Weight */}
        <View style={styles.weightRow}>
          <View>
            <Text style={styles.weightLabel}>Weight</Text>
            <Text style={styles.weightValue}>{todayWeight.toFixed(1)} kg</Text>
          </View>
          <View style={[styles.changeBadge, weightChange > 0 ? styles.changeDown : styles.changeUp]}>
            <Text style={styles.changeBadgeText}>{weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg</Text>
          </View>
        </View>

        {/* Calories */}
        <View style={styles.metricBlock}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Calories</Text>
            <Text style={styles.metricValues}>{todayCalories.toLocaleString()} / {calorieTarget.toLocaleString()} kcal</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${calorieProgress}%`, backgroundColor: ATHLEO_COLORS.accent}]} />
          </View>
        </View>

        {/* Steps */}
        <View style={styles.metricBlock}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Steps</Text>
            <Text style={styles.metricValues}>{todaySteps.toLocaleString()} / {stepsTarget.toLocaleString()}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${stepsProgress}%`, backgroundColor: '#3AB4FF'}]} />
          </View>
        </View>

        {/* Protein */}
        <View style={styles.metricBlock}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Protein Target</Text>
            <Text style={styles.metricValues}>{proteinTarget}g / day</Text>
          </View>
        </View>
      </AppCard>

      {/* Goal Summary from Onboarding */}
      <AppCard style={styles.goalCard}>
        <Text style={styles.sectionTitle}>Your Plan</Text>
        <View style={styles.planGrid}>
          {[
            {label: 'Goal', value: profile.goal?.replace(/^./, c => c.toUpperCase()) ?? '—', icon: 'trophy-outline'},
            {label: 'Activity', value: profile.activityLevel?.replace(/^./, c => c.toUpperCase()) ?? '—', icon: 'fitness-outline'},
            {label: 'Daily kcal', value: `${calorieTarget.toLocaleString()}`, icon: 'nutrition-outline'},
            {label: 'Protein', value: `${proteinTarget}g`, icon: 'barbell-outline'},
            {label: 'Steps', value: stepsTarget.toLocaleString(), icon: 'footsteps-outline'},
            {label: 'Experience', value: profile.experience?.replace(/^./, c => c.toUpperCase()) ?? '—', icon: 'school-outline'},
          ].map(item => (
            <View key={item.label} style={styles.planStat}>
              <Icon name={item.icon} size={16} color={ATHLEO_COLORS.accent} />
              <Text style={styles.planStatVal}>{item.value}</Text>
              <Text style={styles.planStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      {/* 30-day Weight Trend */}
      <AppCard style={styles.chartCard}>
        <View style={styles.cardRowBetween}>
          <Text style={styles.sectionTitle}>Weight Trend</Text>
          <View style={styles.statPill}><Text style={styles.statPillText}>Scale PR</Text></View>
        </View>
        <SatisfyingBarChart
          data={(history.length > 0 ? history.slice(-14) : [
            {date: '10-10', weightKg: profile.weightKg},
            {date: '10-12', weightKg: profile.weightKg - 0.2},
            {date: '10-14', weightKg: profile.weightKg - 0.4},
            {date: '10-16', weightKg: profile.weightKg - 0.3},
            {date: '10-18', weightKg: profile.weightKg - 0.6},
            {date: '10-20', weightKg: profile.weightKg - 0.8},
            {date: 'Today', weightKg: todayWeight},
          ]).map((e: any, i: number, arr: any[]) => ({
            label: i === arr.length - 1 ? 'Today' : e.date ? e.date.slice(5) : `D${i + 1}`,
            value: Number(e.weightKg.toFixed(1)),
            date: e.date,
          }))}
          unit="kg"
          height={140}
          barColor={ATHLEO_COLORS.accent}
          showPeakBeacon={true}
        />
      </AppCard>

      {/* 30-day Steps Trend */}
      <AppCard style={styles.chartCard}>
        <View style={styles.cardRowBetween}>
          <Text style={styles.sectionTitle}>Daily Steps Consistency</Text>
          <View style={[styles.statPill, {backgroundColor: 'rgba(58, 180, 255, 0.15)', borderColor: 'rgba(58, 180, 255, 0.35)'}]}>
            <Text style={[styles.statPillText, {color: '#3AB4FF'}]}>Target: {stepsTarget.toLocaleString()}</Text>
          </View>
        </View>
        <SatisfyingBarChart
          data={(history.length > 0 ? history.slice(-14) : [
            {date: '10-10', steps: 6500},
            {date: '10-12', steps: 8200},
            {date: '10-14', steps: 7800},
            {date: '10-16', steps: 10400},
            {date: '10-18', steps: 9200},
            {date: '10-20', steps: 11500},
            {date: 'Today', steps: todaySteps || 8500},
          ]).map((e: any, i: number, arr: any[]) => ({
            label: i === arr.length - 1 ? 'Today' : e.date ? e.date.slice(5) : `D${i + 1}`,
            value: e.steps,
            date: e.date,
          }))}
          unit="steps"
          height={140}
          barColor="#3AB4FF"
          showPeakBeacon={true}
        />
      </AppCard>
    </>
  );

  const GRADE_CONFIG: Record<WeekGrade, {color: string; label: string; emoji: string}> = {
    S: {color: '#A78BFA', label: 'LEGENDARY', emoji: '👑'},
    A: {color: ATHLEO_COLORS.accent, label: 'EXCELLENT', emoji: '🔥'},
    B: {color: '#3AB4FF', label: 'SOLID', emoji: '💪'},
    C: {color: '#FFB020', label: 'MODERATE', emoji: '📈'},
    D: {color: '#FF6B6B', label: 'NEEDS WORK', emoji: '🔄'},
  };

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const ACTIVITY_COLORS: Record<DayActivity, string> = {
    active: ATHLEO_COLORS.accent,
    rest: '#3AB4FF',
    skipped: '#1E1E22',
  };

  const renderWeekly = () => {
    // getWeeklyReport() never returns null, so the empty state must be driven
    // by whether any entries actually exist for the week.
    if (!weeklyReport || weeklyReport.dayActivities.length === 0) {
    return (
      <AppCard style={styles.emptyCard}>
        <Icon name="bar-chart-outline" size={40} color={ATHLEO_COLORS.muted} />
        <Text style={styles.emptyText}>Log your first week to see the report.</Text>
      </AppCard>
    );
    }
    const grade = weeklyReport.weekGrade;
    const gradeConf = GRADE_CONFIG[grade];
    const weekCalories = history.slice(-7).map(e => e.caloriesBurned);

    return (
      <>
        {/* Hero Grade Card */}
        <AppCard style={styles.weeklyHero}>
          <View style={styles.weeklyHeroTop}>
            <View style={styles.weeklyHeroLeft}>
              <Text style={styles.weeklyEyebrow}>{weeklyReport.weekStart} → {weeklyReport.weekEnd}</Text>
              <Text style={styles.weeklyTitle}>Weekly Report</Text>
              <View style={[styles.weeklyGradePill, {backgroundColor: `${gradeConf.color}22`, borderColor: `${gradeConf.color}55`}]}>
                <Text style={[styles.weeklyGradeText, {color: gradeConf.color}]}>{gradeConf.emoji} {grade} — {gradeConf.label}</Text>
              </View>
            </View>
            <View style={[styles.gradeBadge, {borderColor: gradeConf.color}]}>
              <Text style={[styles.gradeBadgeText, {color: gradeConf.color}]}>{grade}</Text>
            </View>
          </View>

          {/* Streak */}
          {weeklyReport.streakDays > 0 && (
            <View style={styles.streakRow}>
              <Text style={styles.streakFlame}>🔥</Text>
              <Text style={styles.streakText}>{weeklyReport.streakDays}-day streak</Text>
            </View>
          )}
        </AppCard>

        {/* 7-Day Activity Heatmap */}
        <AppCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>7-Day Activity</Text>
          <View style={styles.heatmapRow}>
            {(weeklyReport.dayActivities.length === 7
              ? weeklyReport.dayActivities
              : Array<DayActivity>(7).fill('skipped')
            ).map((activity, i) => (
              <View key={i} style={styles.heatmapCell}>
                <View style={[
                  styles.heatmapTile,
                  {backgroundColor: ACTIVITY_COLORS[activity]},
                  activity === 'active' && styles.heatmapTileActive,
                ]} />
                <Text style={styles.heatmapLabel}>{DAY_LABELS[i]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heatmapLegend}>
            {([['active', 'Trained'], ['rest', 'Active'], ['skipped', 'Rest']] as [DayActivity, string][]).map(([k, label]) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.legendDot, {backgroundColor: ACTIVITY_COLORS[k]}]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* Calories Burned Bar Chart */}
        <AppCard style={styles.chartCard}>
          <View style={styles.cardRowBetween}>
            <Text style={styles.sectionTitle}>Daily Calorie Burn Intensity</Text>
            <View style={[styles.statPill, {backgroundColor: 'rgba(255, 107, 0, 0.15)', borderColor: 'rgba(255, 107, 0, 0.35)'}]}>
              <Text style={[styles.statPillText, {color: '#FF6B00'}]}>Active Burn</Text>
            </View>
          </View>
          <SatisfyingBarChart
            data={DAY_LABELS.map((day, i) => ({
              label: day,
              value: Math.round(weekCalories[i] ?? 0),
              date: `${day} Energy Burn`,
            }))}
            unit="kcal"
            height={140}
            barColor="#FF7A00"
            showPeakBeacon={true}
          />
        </AppCard>

        {/* KPI Grid */}
        <AppCard style={styles.weeklyHero}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weeklyGrid}>
            {([
              {label: 'Workouts', value: String(weeklyReport.totalWorkouts), color: ATHLEO_COLORS.accent, icon: 'barbell-outline'},
              {label: 'Avg Steps', value: weeklyReport.avgSteps.toLocaleString(), color: '#3AB4FF', icon: 'footsteps-outline'},
              {label: 'Avg Calories', value: `${weeklyReport.avgCalories} kcal`, color: '#FFB020', icon: 'nutrition-outline'},
              {label: 'Burned', value: `${weeklyReport.caloriesBurned} kcal`, color: '#FF6B35', icon: 'flame-outline'},
              {label: 'Avg Sleep', value: `${Math.floor(weeklyReport.avgSleep / 60)}h ${weeklyReport.avgSleep % 60}m`, color: '#C87AFF', icon: 'moon-outline'},
              {label: 'Weight Δ', value: `${weeklyReport.weightChange > 0 ? '+' : ''}${weeklyReport.weightChange} kg`, color: weeklyReport.weightChange <= 0 ? ATHLEO_COLORS.accent : '#FFB020', icon: 'scale-outline'},
            ] as {label: string; value: string; color: string; icon: string}[]).map(item => (
              <View key={item.label} style={styles.weeklyStat}>
                <Icon name={item.icon} size={14} color={item.color} />
                <Text style={[styles.weeklyStatVal, {color: item.color}]}>{item.value}</Text>
                <Text style={styles.weeklyStatLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* PRs */}
        {weeklyReport.prHighlights.length > 0 && (
          <AppCard style={styles.prCard}>
            <Text style={styles.sectionTitle}>🏆 Personal Bests This Week</Text>
            <View style={styles.prGrid}>
              {(weeklyReport.prHighlights as PRHighlight[]).map(pr => (
                <View key={pr.label} style={styles.prCell}>
                  <Icon name={pr.icon} size={18} color={ATHLEO_COLORS.accent} />
                  <Text style={styles.prValue}>{pr.value}</Text>
                  <Text style={styles.prLabel}>{pr.label}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        )}

        {/* AI Coach Blurb */}
        <AppCard style={styles.coachCard}>
          <View style={styles.coachHeader}>
            <View style={styles.coachIcon}>
              <Text style={styles.coachEmoji}>🤖</Text>
            </View>
            <View style={styles.coachTitleWrap}>
              <Text style={styles.coachTitle}>AI Coach Analysis</Text>
              <Text style={styles.coachSubtitle}>Smart Offline Engine</Text>
            </View>
          </View>
          <Text style={styles.coachBlurb}>{weeklyReport.coachBlurb}</Text>
        </AppCard>
      </>
    );
  };

  const renderHistory = () => (
    <AppCard style={styles.historyCard}>
      <Text style={styles.sectionTitle}>30-Day Log</Text>
      {history.slice().reverse().map((entry, i) => (
        <View key={entry.date} style={[styles.historyRow, i < history.length - 1 && styles.historyRowBorder]}>
          <View style={styles.historyDate}>
            <Text style={styles.historyDateText}>{entry.date.slice(5)}</Text>
          </View>
          <View style={styles.historyStats}>
            <Text style={styles.historyStat}>{entry.weightKg.toFixed(1)} kg</Text>
            <Text style={styles.historyStat}>{entry.steps.toLocaleString()} steps</Text>
            <Text style={styles.historyStat}>{entry.calories} kcal</Text>
            {entry.workoutsCompleted > 0 && (
              <Icon name="barbell-outline" size={12} color={ATHLEO_COLORS.accent} />
            )}
          </View>
        </View>
      ))}
    </AppCard>
  );

  const renderAnalytics = () => {
    const heatmap = getWorkoutHeatmap(4);
    const macro = getMacroBreakdown();
    const bodyComp = getBodyCompositionEstimate();
    const volumeTrend = getVolumeTrend();
    const maxWorkouts = Math.max(...volumeTrend.map(w => w.workouts), 1);
    // Empty-state guards: sections with no underlying data should not render
    // empty/broken charts.
    const hasHeatmapData = heatmap.some(c => c.intensity > 0);
    const hasVolumeData = volumeTrend.some(w => w.workouts > 0 || w.avgSteps > 0);
    const INTENSITY_COLORS = ['#1E1E22', 'rgba(184,255,77,0.25)', 'rgba(184,255,77,0.55)', ATHLEO_COLORS.accent];
    const MACRO_COLORS = ['#3AB4FF', '#FFB020', '#FF6B6B'];
    const MACRO_LABELS = [`Protein ${macro.proteinPct}%`, `Carbs ${macro.carbPct}%`, `Fat ${macro.fatPct}%`];
    // Build week labels (Mon..Sun headers for 4 weeks)
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const bmiMax = 35;
    const bmiPct = Math.min(100, (bodyComp.bmi / bmiMax) * 100);

    return (
      <>
        {/* GitHub-style 4×7 Workout Heatmap */}
        <AppCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Activity Heatmap (4 Weeks)</Text>
          {hasHeatmapData ? (
            <>
              <View style={styles.heatmapGrid}>
                <View style={styles.heatmapDayLabels}>
                  {weekLabels.map(l => (
                    <Text key={l} style={styles.heatmapDayLabel}>{l.slice(0,1)}</Text>
                  ))}
                </View>
                <View style={styles.analyticsHeatmapCols}>
                  {[0, 1, 2, 3].map(week => (
                    <View key={week} style={styles.analyticsHeatmapCol}>
                      {heatmap.slice(week * 7, week * 7 + 7).map((cell, di) => (
                        <View
                          key={di}
                          style={[
                            styles.analyticsHeatmapTile,
                            {backgroundColor: INTENSITY_COLORS[cell.intensity]},
                            cell.intensity === 3 && styles.analyticsHeatmapGlow,
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.heatmapLegend}>
                {([0, 1, 2, 3] as (0|1|2|3)[]).map(i => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: INTENSITY_COLORS[i], width: 10, height: 10, borderRadius: 2}]} />
                  </View>
                ))}
                <Text style={styles.legendText}>Less → More</Text>
              </View>
            </>
          ) : (
            <View style={styles.analyticsEmpty}>
              <Icon name="grid-outline" size={28} color={ATHLEO_COLORS.muted} />
              <Text style={styles.emptyText}>No activity logged yet — start training to build your heatmap.</Text>
            </View>
          )}
        </AppCard>

        {/* Macro Split */}
        <AppCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Estimated Macro Split</Text>
          <Text style={styles.analyticsSubtitle}>Avg {macro.totalKcal.toLocaleString()} kcal / day this week</Text>
          <View style={styles.macroBarContainer}>
            {([macro.proteinPct, macro.carbPct, macro.fatPct] as number[]).map((pct, i) => (
              <View
                key={i}
                style={[
                  styles.macroBarSegment,
                  {flex: pct, backgroundColor: MACRO_COLORS[i]},
                  i === 0 && styles.macroBarLeft,
                  i === 2 && styles.macroBarRight,
                ]}
              />
            ))}
          </View>
          <View style={styles.macroLegendRow}>
            {MACRO_LABELS.map((label, i) => (
              <View key={i} style={styles.macroLegendItem}>
                <View style={[styles.macroDot, {backgroundColor: MACRO_COLORS[i]}]} />
                <Text style={styles.macroLegendText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.macroStatsRow}>
            {[
              {label: 'Protein', g: macro.proteinG, color: '#3AB4FF'},
              {label: 'Carbs', g: macro.carbG, color: '#FFB020'},
              {label: 'Fat', g: macro.fatG, color: '#FF6B6B'},
            ].map(m => (
              <View key={m.label} style={styles.macroStatCell}>
                <Text style={[styles.macroStatVal, {color: m.color}]}>{m.g}g</Text>
                <Text style={styles.macroStatLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* Body Composition */}
        <AppCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Body Composition Estimate</Text>
          <Text style={styles.analyticsSubtitle}>Based on your profile data (Deurenberg formula)</Text>
          <View style={styles.bmiRow}>
            <View style={styles.bmiGaugeWrap}>
              <View style={styles.bmiTrack}>
                <View style={[styles.bmiFill, {width: `${bmiPct}%`}]} />
                <View style={[styles.bmiCursor, {left: `${bmiPct - 2}%`}]} />
              </View>
              <View style={styles.bmiScale}>
                {['18.5', '25', '30', '35'].map(v => (
                  <Text key={v} style={styles.bmiScaleLabel}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.bodyCompGrid}>
            {[
              {label: 'BMI', value: String(bodyComp.bmi), sub: bodyComp.bmiCategory, color: bodyComp.bmi < 25 ? ATHLEO_COLORS.accent : '#FFB020'},
              {label: 'Est. BF%', value: `${bodyComp.estimatedBFPct}%`, sub: '', color: '#3AB4FF'},
              {label: 'Lean Mass', value: `${bodyComp.leanMassKg} kg`, sub: '', color: ATHLEO_COLORS.accent},
              {label: 'Fat Mass', value: `${bodyComp.fatMassKg} kg`, sub: '', color: '#FF6B6B'},
            ].map(item => (
              <View key={item.label} style={styles.bodyCompCell}>
                <Text style={[styles.bodyCompVal, {color: item.color}]}>{item.value}</Text>
                {item.sub ? <Text style={styles.bodyCompSub}>{item.sub}</Text> : null}
                <Text style={styles.bodyCompLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* 4-Week Volume Trend */}
        <AppCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>4-Week Volume Trend</Text>
          {hasVolumeData ? (
            <>
              <View style={styles.barChart}>
                {volumeTrend.map((w, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={[
                      styles.bar,
                      {height: `${Math.max(6, (w.workouts / maxWorkouts) * 100)}%`, backgroundColor: ATHLEO_COLORS.accent},
                    ]} />
                    <Text style={styles.barDayLabel}>{w.week}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.volumeStatRow}>
                {volumeTrend.map((w, i) => (
                  <View key={i} style={styles.volumeStatCell}>
                    <Text style={styles.volumeStatWeek}>{w.week}</Text>
                    <Text style={styles.volumeStatWorkouts}>{w.workouts} 💪</Text>
                    <Text style={styles.volumeStatSteps}>{(w.avgSteps / 1000).toFixed(1)}k steps</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.analyticsEmpty}>
              <Icon name="stats-chart-outline" size={28} color={ATHLEO_COLORS.muted} />
              <Text style={styles.emptyText}>No workout data yet — your 4-week trend will appear here.</Text>
            </View>
          )}
        </AppCard>
      </>
    );
  };

  return (
    <Animated.View style={[styles.wrapper, {opacity: fadeAnim}]}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Progress</Text>

        {/* Tab Bar */}
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Weekly' && renderWeekly()}
        {activeTab === 'Analytics' && renderAnalytics()}
        {activeTab === 'History' && renderHistory()}
      </SmoothScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING, gap: 14},
  title: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800'},
  tabs: {flexDirection: 'row', gap: 6, backgroundColor: '#0A2E19', borderRadius: 14, padding: 4},
  tabBtn: {flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  tabBtnActive: {backgroundColor: 'rgba(184,255,77,0.20)', borderWidth: 1.5, borderColor: '#B8FF4D'},
  tabText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase'},
  tabTextActive: {color: '#B8FF4D'},
  todayCard: {padding: 18, borderRadius: 20, gap: 14},
  cardRowBetween: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  sectionTitle: {color: '#FFFFFF', fontSize: 18, fontWeight: '800'},
  weightRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  weightLabel: {color: '#D4FFB2', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800'},
  weightValue: {color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 4},
  changeBadge: {borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6},
  changeBadgeText: {fontWeight: '900', fontSize: 13},
  changeUp: {backgroundColor: 'rgba(184,255,77,0.20)', color: '#B8FF4D'},
  changeDown: {backgroundColor: 'rgba(255,176,32,0.20)'},
  metricBlock: {gap: 6},
  metricRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  metricLabel: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},
  metricValues: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  progressTrack: {height: 8, backgroundColor: '#123A21', borderRadius: 999, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 999},
  goalCard: {padding: 16, borderRadius: 18},
  planGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  planStat: {width: '30%', backgroundColor: '#0F3820', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  planStatVal: {color: '#FFFFFF', fontWeight: '800', fontSize: 14, textAlign: 'center'},
  planStatLabel: {color: '#D4FFB2', fontSize: 12, textAlign: 'center', fontWeight: '700'},
  chartCard: {padding: 16, borderRadius: 18},
  barChart: {flexDirection: 'row', height: 100, alignItems: 'flex-end', gap: 3, marginTop: 8},
  barCol: {flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end'},
  bar: {width: '80%', borderRadius: 4, minHeight: 4},
  chartLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  chartLabel: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  weeklyHero: {padding: 18, borderRadius: 20},
  weeklyPeriod: {color: '#E0FFE8', fontSize: 13, marginTop: 4, marginBottom: 14, fontWeight: '700'},
  weeklyGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  weeklyStat: {width: '30%', backgroundColor: '#0F3820', borderRadius: 12, padding: 10, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  weeklyStatVal: {fontWeight: '900', fontSize: 15, textAlign: 'center', color: '#FFFFFF'},
  weeklyStatLabel: {color: '#D4FFB2', fontSize: 12, textAlign: 'center', fontWeight: '700'},
  emptyCard: {padding: 32, alignItems: 'center', gap: 12},
  analyticsEmpty: {paddingVertical: 24, alignItems: 'center', gap: 10},
  emptyText: {color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '700'},
  historyCard: {padding: 16, borderRadius: 18},
  historyRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10},
  historyRowBorder: {borderBottomWidth: 1, borderBottomColor: 'rgba(184, 255, 77, 0.25)'},
  historyDate: {width: 52},
  historyDateText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  historyStats: {flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap'},
  historyStat: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},
  // Weekly report new styles
  weeklyHeroTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  weeklyHeroLeft: {flex: 1, gap: 4},
  weeklyEyebrow: {color: '#B8FF4D', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '800'},
  weeklyTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2},
  weeklyGradePill: {alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1.5, borderColor: '#B8FF4D', paddingHorizontal: 12, paddingVertical: 5, marginTop: 8},
  weeklyGradeText: {fontSize: 13, fontWeight: '900', letterSpacing: 0.5, color: '#B8FF4D'},
  gradeBadge: {width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#B8FF4D', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F3820'},
  gradeBadgeText: {fontSize: 26, fontWeight: '900', color: '#B8FF4D'},
  streakRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(255,176,32,0.15)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start'},
  streakFlame: {fontSize: 18},
  streakText: {color: '#FFD700', fontWeight: '800', fontSize: 14},
  heatmapRow: {flexDirection: 'row', gap: 6, marginTop: 12},
  heatmapCell: {flex: 1, alignItems: 'center', gap: 4},
  heatmapTile: {width: '100%', aspectRatio: 1, borderRadius: 8},
  heatmapTileActive: {shadowColor: ATHLEO_COLORS.accent, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: {width: 0, height: 0}, elevation: 4},
  heatmapLabel: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  heatmapLegend: {flexDirection: 'row', gap: 14, marginTop: 10},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
  legendDot: {width: 8, height: 8, borderRadius: 4},
  legendText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  barDayLabel: {color: '#FFFFFF', fontSize: 12, marginTop: 3, fontWeight: '700'},
  prCard: {padding: 16, borderRadius: 18},
  prGrid: {flexDirection: 'row', gap: 8, marginTop: 12},
  prCell: {flex: 1, backgroundColor: '#0F3820', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  prValue: {color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 15, textAlign: 'center'},
  prLabel: {color: '#FFFFFF', fontSize: 12, textAlign: 'center', fontWeight: '800'},
  coachCard: {padding: 18, borderRadius: 20, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: '#B8FF4D'},
  coachHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  coachIcon: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(184,255,77,0.18)', alignItems: 'center', justifyContent: 'center'},
  coachEmoji: {fontSize: 20},
  coachTitleWrap: {gap: 2},
  coachTitle: {color: '#FFFFFF', fontWeight: '800', fontSize: 16},
  coachSubtitle: {color: '#B8FF4D', fontSize: 13, fontWeight: '700'},
  coachBlurb: {color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '600'},
  // Analytics tab styles
  analyticsSubtitle: {color: '#D4FFB2', fontSize: 13, marginTop: 2, marginBottom: 10, fontWeight: '700'},
  heatmapGrid: {flexDirection: 'row', marginTop: 12, gap: 6},
  heatmapDayLabels: {flexDirection: 'column', gap: 5, marginRight: 4, justifyContent: 'space-around'},
  heatmapDayLabel: {color: '#FFFFFF', fontSize: 12, fontWeight: '700', width: 14, textAlign: 'center'},
  analyticsHeatmapCols: {flex: 1, flexDirection: 'row', gap: 5},
  analyticsHeatmapCol: {flex: 1, flexDirection: 'column', gap: 5},
  analyticsHeatmapTile: {flex: 1, aspectRatio: 1, borderRadius: 4},
  analyticsHeatmapGlow: {shadowColor: ATHLEO_COLORS.accent, shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: {width: 0, height: 0}, elevation: 3},
  macroBarContainer: {flexDirection: 'row', height: 22, borderRadius: 11, overflow: 'hidden', marginTop: 12},
  macroBarSegment: {height: '100%'},
  macroBarLeft: {borderTopLeftRadius: 11, borderBottomLeftRadius: 11},
  macroBarRight: {borderTopRightRadius: 11, borderBottomRightRadius: 11},
  macroLegendRow: {flexDirection: 'row', gap: 16, marginTop: 10},
  macroLegendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  macroDot: {width: 10, height: 10, borderRadius: 5},
  macroLegendText: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},
  macroStatsRow: {flexDirection: 'row', gap: 8, marginTop: 12},
  macroStatCell: {flex: 1, backgroundColor: '#0F3820', borderRadius: 12, padding: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  macroStatVal: {fontWeight: '900', fontSize: 18, color: '#FFFFFF'},
  macroStatLabel: {color: '#D4FFB2', fontSize: 12, fontWeight: '800'},
  bmiRow: {marginTop: 12, marginBottom: 8},
  bmiGaugeWrap: {gap: 4},
  bmiTrack: {height: 12, backgroundColor: '#123A21', borderRadius: 6, overflow: 'visible', position: 'relative'},
  bmiFill: {height: '100%', backgroundColor: ATHLEO_COLORS.accent, borderRadius: 6, opacity: 0.7},
  bmiCursor: {position: 'absolute', top: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: ATHLEO_COLORS.accent, borderWidth: 2, borderColor: '#FFFFFF'},
  bmiScale: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  bmiScaleLabel: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  bodyCompGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8},
  bodyCompCell: {width: '47%', backgroundColor: '#0F3820', borderRadius: 12, padding: 12, gap: 2, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  bodyCompVal: {fontWeight: '900', fontSize: 20, color: '#FFFFFF'},
  bodyCompSub: {color: '#D4FFB2', fontSize: 12, fontWeight: '700'},
  bodyCompLabel: {color: '#FFFFFF', fontSize: 12, marginTop: 2, fontWeight: '800'},
  volumeStatRow: {flexDirection: 'row', gap: 6, marginTop: 8},
  volumeStatCell: {flex: 1, backgroundColor: '#0F3820', borderRadius: 10, padding: 8, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  volumeStatWeek: {color: '#FFFFFF', fontSize: 12, fontWeight: '800'},
  volumeStatWorkouts: {color: ATHLEO_COLORS.accent, fontWeight: '900', fontSize: 14},
  volumeStatSteps: {color: '#D4FFB2', fontSize: 12, fontWeight: '700'},
  statPill: {
    backgroundColor: 'rgba(184, 255, 77, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.32)',
  },
  statPillText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
