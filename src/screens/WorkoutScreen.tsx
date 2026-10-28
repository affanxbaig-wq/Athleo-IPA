import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ListRenderItemInfo,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AdaptiveExerciseMedia} from '../components/AdaptiveExerciseMedia';
import {AnimatedText as Text} from '../components/AnimatedText';
import {getExercisePreviewSources} from '../components/AnimatedExercisePreview';
import {BarbellPlateVisualizer} from '../components/BarbellPlateVisualizer';
import {
  getExerciseMuscleCategory,
  type FlowExerciseRecord,
  useFlowExerciseDataset,
} from '../data/flowExerciseDataset';
import {ATHLEO_COLORS, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';
import {getBmiBand, getUserProfile, subscribeToProfile} from '../services/userProfile';
import {triggerHaptic} from '../services/haptics';
import {
  getCachedWeeklyPlan,
  generatePersonalizedWeeklySchedule,
  type WeeklyWorkoutPlan,
} from '../services/workoutScheduleService';

// ── BlurView (optional) ───────────────────────────────────────────────────────
try {
  require('@react-native-community/blur');
} catch {}

interface WorkoutScreenProps {
  navigate?: (tab: TabKey) => void;
}

const CATEGORIES = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Home',
  'Gym',
] as const;
type Category = (typeof CATEGORIES)[number];

type Session = {
  active: boolean;
  finished: boolean;
  exercises: FlowExerciseRecord[];
  idx: number;
  secs: number;
  resting: boolean;
  done: boolean[];
  reps: Record<string, number>;
};

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');

/**
 * The RepDB dataset ships a real difficulty per movement, so that is the
 * answer. The heuristic below only covers a record that arrived without one.
 */
const difficulty = (ex: FlowExerciseRecord): 'Beginner' | 'Intermediate' | 'Advanced' => {
  if (ex.difficulty) { return ex.difficulty; }
  const m = ex.movementPattern.toLowerCase();
  const t = ex.target.toLowerCase();
  if (m.includes('cardio') || t.includes('cardio')) { return 'Advanced'; }
  if (m.includes('core') || t.includes('abs') || t.includes('calves')) { return 'Beginner'; }
  return 'Intermediate';
};

const DIFF_COLOR: Record<string, string> = {
  Beginner: '#30D158',
  Intermediate: '#FF9F0A',
  Advanced: '#FF453A',
};


// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({pct, size = 64}: {pct: number; size?: number}) {
  const animPct = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animPct, {
      toValue: pct,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, animPct]);
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={{color: '#B8FF4D', fontSize: size * 0.22, fontWeight: '900'}}>
        {Math.round(pct)}%
      </Text>
    </View>
  );
}

// ── Lazy Exercise Card ────────────────────────────────────────────────────────
// Uses a 300ms mount-delay so cards don't all fire GIF fetches simultaneously.
interface ExerciseCardProps {
  ex: FlowExerciseRecord;
  onPress: () => void;
  onStart: () => void;
}
const ExerciseCard = React.memo(function ExerciseCard({
  ex,
  onPress,
  onStart,
}: ExerciseCardProps) {
  const d         = difficulty(ex);
  const muscleCat = getExerciseMuscleCategory(ex);
  const sources   = useMemo(() => getExercisePreviewSources(ex), [ex]);

  return (
    <TouchableOpacity
      style={styles.exCard}
      activeOpacity={0.85}
      onPress={onPress}>
      {/* Media thumbnail */}
      <View style={styles.mediaBox}>
        {sources.length > 0 ? (
          <AdaptiveExerciseMedia
            frames={sources}
            width="100%"
            height="100%"
            borderRadius={14}
            phaseOffsetMs={(ex.name.length * 137) % 1200}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Icon name="barbell-outline" size={24} color={ATHLEO_COLORS.accent} />
          </View>
        )}
      </View>

      {/* Info column */}
      <View style={styles.exCardContent}>
        <View style={styles.exCardTop}>
          <View style={styles.catBadge}>
            <Text style={styles.exCardCat}>{muscleCat}</Text>
          </View>
          <View style={[styles.diffDot, {backgroundColor: DIFF_COLOR[d] + '18', borderColor: DIFF_COLOR[d] + '55'}]}>
            <Text style={[styles.diffText, {color: DIFF_COLOR[d]}]}>{d}</Text>
          </View>
        </View>

        <Text style={styles.exCardName} numberOfLines={1}>{ex.name}</Text>
        <Text style={styles.exCardMeta} numberOfLines={1}>
          {titleCase(ex.target)} · {titleCase(ex.equipment)}
        </Text>
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={styles.exStartBtn}
        activeOpacity={0.75}
        onPress={onStart}>
        <Icon name="play" size={13} color="#08140B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export function WorkoutScreen({navigate}: WorkoutScreenProps) {
  const library   = useFlowExerciseDataset();
  const [category, setCategory]   = useState<Category>('All');
  const [search,   setSearch]     = useState('');
  const [preview,  setPreview]    = useState<FlowExerciseRecord | null>(null);
  const [session,  setSession]    = useState<Session | null>(null);
  const [showCalc, setShowCalc]   = useState(false);
  const [calcW,    setCalcW]      = useState('80');
  const [calcR,    setCalcR]      = useState('6');
  const [plan,     setPlan]       = useState<WeeklyWorkoutPlan>(() => getCachedWeeklyPlan());
  const todayIdx   = useMemo(() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }, []);
  const [planDay,  setPlanDay]    = useState(todayIdx);

  useEffect(() => {
    const unsubscribe = subscribeToProfile(() => {
      setPlan(generatePersonalizedWeeklySchedule());
      setPlanDay((prev) => Math.min(prev, 6));
    });
    return unsubscribe;
  }, []);

  const wNum = Math.max(0, parseFloat(calcW) || 0);
  const rNum = Math.max(1, Math.min(30, parseInt(calcR, 10) || 1));
  const orm  = Math.round(wNum * (1 + rNum / 30));

  // ── Category counts ────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {All: library.length};
    CATEGORIES.forEach(c => {
      if (c === 'All') { return; }
      if (c === 'Home') {
        counts[c] = library.filter(e => {
          const eq = (e.equipment || '').toLowerCase();
          return eq.includes('body weight') || eq.includes('band') || eq.includes('stability ball');
        }).length;
      } else if (c === 'Gym') {
        counts[c] = library.filter(e => {
          const eq = (e.equipment || '').toLowerCase();
          return !eq.includes('body weight') && !eq.includes('band');
        }).length;
      } else {
        counts[c] = library.filter(e => getExerciseMuscleCategory(e) === c).length;
      }
    });
    return counts;
  }, [library]);

  // ── Filtered + ranked list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q   = search.trim().toLowerCase();
    const p   = getUserProfile();
    const bmi = getBmiBand(p);
    const goal  = p.goal       ?? 'wellness';
    const exp   = p.experience ?? 'beginner';
    const stress = p.stress    ?? 'medium';

    const rank = (e: FlowExerciseRecord) => {
      let s = 0;
      const m = e.movementPattern.toLowerCase();
      const b = (e.bodyPart ?? '').toLowerCase();
      const diff_lvl = difficulty(e);
      const dMap: Record<string, number> = {Beginner: 1, Intermediate: 2, Advanced: 3};
      const eMap: Record<string, number> = {novice: 0, beginner: 1, intermediate: 2, advanced: 3};
      const gap = Math.abs((dMap[diff_lvl] ?? 2) - (eMap[exp] ?? 1));
      s += gap === 0 ? 6 : gap === 1 ? 3 : -3;
      if (bmi === 'overweight' || bmi === 'obese') { if (m.includes('cardio')) { s += 6; } }
      if (goal === 'muscle' || goal === 'strength') { if (m.includes('barbell') || m.includes('compound')) { s += 7; } }
      if (goal === 'fat') { if (m.includes('cardio') || m.includes('hiit')) { s += 7; } }
      if (stress === 'high' && (m.includes('barbell') || b.includes('spine'))) { s -= 5; }
      return s;
    };

    return library
      .filter(e => {
        const muscleCat = getExerciseMuscleCategory(e);
        const eq = (e.equipment || '').toLowerCase();
        let mc = false;
        if      (category === 'All')   { mc = true; }
        else if (category === 'Home')  { mc = eq.includes('body weight') || eq.includes('band') || eq.includes('stability ball'); }
        else if (category === 'Gym')   { mc = !eq.includes('body weight') && !eq.includes('band'); }
        else                           { mc = muscleCat === category; }
        const mq = !q || [e.name, e.target, e.bodyPart, e.equipment, muscleCat].join(' ').toLowerCase().includes(q);
        return mc && mq;
      })
      .sort((a, b) => rank(b) - rank(a));
  }, [library, search, category]);

  // ── Session helpers ────────────────────────────────────────────────────────
  const startSession = useCallback((ex: FlowExerciseRecord) => {
    const cat  = getExerciseMuscleCategory(ex);
    const same = library.filter(e => getExerciseMuscleCategory(e) === cat);
    const start = Math.max(0, same.findIndex(e => e.id === ex.id));
    const list  = same.slice(start, start + 4);
    const final = list.length >= 4 ? list : [
      ...list,
      ...same.filter(e => !list.some(b => b.id === e.id)).slice(0, 4 - list.length),
    ];
    triggerHaptic('impactMedium');
    setSession({
      active: true, finished: false, exercises: final.slice(0, 4), idx: 0,
      secs: 45, resting: false, done: Array(4).fill(false),
      reps: Object.fromEntries(final.slice(0, 4).map(e => [e.id, 0])),
    });
  }, [library]);

  const tapRep = useCallback((d: number) => {
    triggerHaptic('selection');
    setSession(s => {
      if (!s) { return s; }
      const id = s.exercises[s.idx]?.id;
      if (!id) { return s; }
      return {...s, reps: {...s.reps, [id]: Math.max(0, (s.reps[id] ?? 0) + d)}};
    });
  }, []);

  const doneEx = useCallback(() => {
    setSession(s => {
      if (!s) { return s; }
      const nd = [...s.done];
      nd[s.idx] = true;
      if (s.idx >= s.exercises.length - 1) {
        triggerHaptic('notificationSuccess');
        return {...s, active: false, finished: true, done: nd};
      }
      triggerHaptic('impactHeavy');
      return {...s, done: nd, idx: s.idx + 1, secs: 45, resting: false};
    });
  }, []);

  useEffect(() => {
    if (!session?.active) { return; }
    const t = setInterval(() => {
      setSession(s => {
        if (!s?.active) { return s; }
        if (s.secs > 0) { return {...s, secs: s.secs - 1}; }
        if (s.resting) {
          if (s.idx >= s.exercises.length - 1) { return {...s, active: false, finished: true, resting: false, secs: 0}; }
          return {...s, idx: s.idx + 1, resting: false, secs: 45};
        }
        return {...s, resting: true, secs: 30};
      });
    }, 1000);
    return () => clearInterval(t);
  }, [session?.active]);

  const swapEx = useCallback((dayI: number, exI: number) => {
    triggerHaptic('impactMedium');
    setPlan(cur => {
      const days = cur.days.map((d, di) => {
        if (di !== dayI) { return d; }
        const cur_ = d.exercises[exI];
        if (!cur_) { return d; }
        const alts = library.filter(
          e => e.name.toLowerCase() !== cur_.name.toLowerCase() &&
               (e.target?.toLowerCase() === cur_.target?.toLowerCase() ||
                e.bodyPart?.toLowerCase() === cur_.bodyPart?.toLowerCase()),
        );
        if (!alts.length) { return d; }
        const pick = alts[Math.floor(Math.random() * alts.length)];
        const exs  = [...d.exercises];
        exs[exI]   = {...cur_, id: pick.id, name: pick.name, target: pick.target, equipment: pick.equipment};
        return {...d, exercises: exs};
      });
      return {...cur, days};
    });
  }, [library]);

  const curEx    = session?.exercises[session.idx] ?? null;
  const pct      = session ? (session.done.filter(Boolean).length / session.exercises.length) * 100 : 0;
  const timerStr = session
    ? `${String(Math.floor(session.secs / 60)).padStart(2, '0')}:${String(session.secs % 60).padStart(2, '0')}`
    : '00:45';

  // ── FlatList render item ────────────────────────────────────────────────────
  const renderItem = useCallback(({item: ex}: ListRenderItemInfo<FlowExerciseRecord>) => (
    <ExerciseCard
      ex={ex}
      onPress={() => setPreview(ex)}
      onStart={() => { setPreview(null); startSession(ex); }}
    />
  ), [startSession]);

  const keyExtractor = useCallback((item: FlowExerciseRecord) => item.id, []);

  const ListHeader = useMemo(() => (
    <View style={styles.listHeaderWrap}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ATHLEO TRAINING</Text>
          <Text style={styles.title}>Workouts</Text>
        </View>
        <TouchableOpacity
          style={styles.calcBtn}
          activeOpacity={0.8}
          onPress={() => { triggerHaptic('impactLight'); setShowCalc(true); }}>
          <Icon name="calculator-outline" size={15} color="#B8FF4D" />
          <Text style={styles.calcBtnText}>1RM Calculator</Text>
        </TouchableOpacity>
      </View>

      {/* Program Schedule Cockpit */}
      <WeeklyPlanCard
        plan={plan}
        planDay={planDay}
        todayIdx={todayIdx}
        setPlanDay={setPlanDay}
        setPlan={setPlan}
        swapEx={swapEx}
        navigate={navigate}
      />

      {/* Active session banner */}
      {session?.active && curEx && (
        <View style={styles.sessionBanner}>
          <View style={styles.sessionTop}>
            <View style={{flex: 1}}>
              <Text style={styles.sessionEyebrow}>ACTIVE SESSION</Text>
              <Text style={styles.sessionExName} numberOfLines={1}>{curEx.name}</Text>
            </View>
            <ProgressRing pct={pct} size={56} />
          </View>
          <View style={styles.dotsRow}>
            {session.exercises.map((e, i) => (
              <View key={e.id} style={[styles.dot, i === session.idx && styles.dotActive, session.done[i] && styles.dotDone]} />
            ))}
          </View>
          <View style={styles.timerRow}>
            <Text style={[styles.timerText, session.resting && styles.timerRest]}>{timerStr}</Text>
            <View style={[styles.timerBadge, session.resting && styles.timerBadgeRest]}>
              <Text style={styles.timerBadgeText}>{session.resting ? 'REST' : 'WORK'}</Text>
            </View>
          </View>
          <View style={styles.repRow}>
            <TouchableOpacity style={styles.repBtn} onPress={() => tapRep(-1)}>
              <Icon name="remove" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.repBox}>
              <Text style={styles.repVal}>{session.reps[curEx.id] ?? 0}</Text>
              <Text style={styles.repLbl}>REPS</Text>
            </View>
            <TouchableOpacity style={styles.repBtn} onPress={() => tapRep(1)}>
              <Icon name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.sessionActions}>
            <TouchableOpacity style={styles.sessionDoneBtn} onPress={doneEx}>
              <Icon name="checkmark" size={18} color="#08140B" />
              <Text style={styles.sessionDoneTxt}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sessionRestBtn}
              onPress={() => setSession(s => s ? {...s, resting: !s.resting, secs: s.resting ? 45 : 30} : s)}>
              <Text style={styles.sessionRestTxt}>{session.resting ? 'Resume' : 'Rest'}</Text>
            </TouchableOpacity>
          </View>
          {session.exercises[session.idx + 1] ? (
            <Text style={styles.nextEx}>Next → {session.exercises[session.idx + 1].name}</Text>
          ) : (
            <Text style={styles.nextEx}>Final exercise</Text>
          )}
        </View>
      )}

      {/* Finished summary */}
      {session?.finished && (
        <View style={styles.summaryCard}>
          <Icon name="trophy" size={32} color="#B8FF4D" />
          <Text style={styles.summaryTitle}>Workout Complete! 🎉</Text>
          <Text style={styles.summaryMeta}>
            {session.done.filter(Boolean).length}/{session.exercises.length} exercises ·{' '}
            {Object.values(session.reps).reduce((a, b) => a + b, 0)} total reps
          </Text>
          <TouchableOpacity style={styles.summaryBtn} onPress={() => setSession(null)}>
            <Text style={styles.summaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Library header */}
      <View style={styles.libHeader}>
        <Text style={styles.libTitle}>Exercise Library</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={16} color={ATHLEO_COLORS.muted} style={{marginLeft: 14}} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Muscles, equipment, exercise…"
          placeholderTextColor={ATHLEO_COLORS.muted}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{paddingRight: 12}}>
            <Icon name="close-circle" size={16} color={ATHLEO_COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillContent}>
        {CATEGORIES.map(c => {
          const isAct = c === category;
          const count = categoryCounts[c] ?? 0;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.pill, isAct && styles.pillActive]}
              onPress={() => { triggerHaptic('selection'); setCategory(c); }}>
              <Text style={[styles.pillText, isAct && styles.pillTextActive]}>
                {c}{' '}
                <Text style={[styles.pillCount, isAct && styles.pillCountActive]}>({count})</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [
    plan, planDay, todayIdx, session, curEx, pct, timerStr,
    search, category, categoryCounts, filtered.length,
    swapEx, navigate, tapRep, doneEx,
  ]);

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={{alignItems: 'center', paddingVertical: 40, gap: 8}}>
            <Icon
              name={library.length === 0 ? 'barbell-outline' : 'search-outline'}
              size={32}
              color={ATHLEO_COLORS.muted}
            />
            <Text style={{color: ATHLEO_COLORS.muted, fontSize: 14, fontWeight: '700'}}>
              {library.length === 0 ? 'Loading exercises…' : 'No matches found'}
            </Text>
            {library.length === 0 && (
              <Text style={{color: ATHLEO_COLORS.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 32}}>
                The exercise library is loading, please wait a moment.
              </Text>
            )}
          </View>
        }
        contentContainerStyle={styles.content}
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        numColumns={1}
        // Virtualization settings for smooth 60/120fps scroll
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {/* Exercise preview modal */}
      <Modal visible={!!preview} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {preview && (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{preview.name}</Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setPreview(null)}>
                    <Icon name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Large form loop in modal */}
                <View style={styles.modalMedia}>
                  {getExercisePreviewSources(preview).length > 0 ? (
                    <AdaptiveExerciseMedia
                      frames={getExercisePreviewSources(preview)}
                      width="100%"
                      height="100%"
                      borderRadius={16}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.modalMedia, {alignItems: 'center', justifyContent: 'center'}]}>
                      <Icon name="barbell-outline" size={44} color={ATHLEO_COLORS.accent} />
                    </View>
                  )}
                </View>

                <View style={styles.metaGrid}>
                  {[
                    {label: 'Target',    val: titleCase(preview.target)},
                    {label: 'Body Part', val: titleCase(preview.bodyPart)},
                    {label: 'Equipment', val: titleCase(preview.equipment)},
                    {label: 'Difficulty', val: difficulty(preview)},
                  ].map(m => (
                    <View key={m.label} style={styles.metaTile}>
                      <Text style={styles.metaTileLabel}>{m.label}</Text>
                      <Text style={styles.metaTileVal}>{m.val}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.instrTitle}>How to perform</Text>
                <ScrollView style={styles.instrScroll} showsVerticalScrollIndicator={false}>
                  {preview.instructions?.map((step, i) => (
                    <View key={i} style={styles.instrStep}>
                      <View style={styles.instrNum}>
                        <Text style={styles.instrNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.instrText}>{step}</Text>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCTA}
                  onPress={() => { setPreview(null); startSession(preview); }}>
                  <Icon name="flash" size={16} color="#08140B" />
                  <Text style={styles.modalCTAText}>Start Workout</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 1RM Calculator modal */}
      <Modal visible={showCalc} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>1RM Calculator</Text>
                <Text style={styles.calcSub}>Epley Formula · 20 kg bar</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { triggerHaptic('impactLight'); setShowCalc(false); }}>
                <Icon name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{marginBottom: 8}}>
              <View style={styles.calcInputs}>
                {[
                  {label: 'Weight (kg)', val: calcW, set: setCalcW},
                  {label: 'Reps',        val: calcR, set: setCalcR},
                ].map(f => (
                  <View key={f.label} style={{flex: 1}}>
                    <Text style={styles.calcLabel}>{f.label}</Text>
                    <TextInput
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType="numeric"
                      style={styles.calcInput}
                      placeholderTextColor={ATHLEO_COLORS.muted}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.ormHero}>
                <Text style={styles.ormLabel}>Estimated 1RM</Text>
                <Text style={styles.ormVal}>{orm} <Text style={styles.ormUnit}>kg</Text></Text>
              </View>
              <Text style={styles.calcSection}>Training Percentages</Text>
              <View style={styles.pctGrid}>
                {[0.95, 0.90, 0.85, 0.80, 0.75, 0.70].map(p => (
                  <View key={p} style={styles.pctTile}>
                    <Text style={styles.pctPct}>{Math.round(p * 100)}%</Text>
                    <Text style={styles.pctKg}>{Math.round(orm * p)} kg</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.calcSection}>Plate Setup</Text>
              <BarbellPlateVisualizer totalWeightKg={wNum} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Weekly Plan Card (extracted to avoid re-render) ────────────────────────────
interface WeeklyPlanCardProps {
  plan: WeeklyWorkoutPlan;
  planDay: number;
  todayIdx: number;
  setPlanDay: (i: number) => void;
  setPlan: React.Dispatch<React.SetStateAction<WeeklyWorkoutPlan>>;
  swapEx: (dayI: number, exI: number) => void;
  navigate?: (tab: TabKey) => void;
}
const WeeklyPlanCard = React.memo(function WeeklyPlanCard({
  plan, planDay, todayIdx, setPlanDay, setPlan, swapEx, navigate,
}: WeeklyPlanCardProps) {
  const currentDay = plan.days[planDay];
  const isToday = planDay === todayIdx;

  return (
    <View style={styles.planCard}>
      {/* Plan Header */}
      <View style={styles.planHeaderRow}>
        <View style={styles.planStatusPill}>
          <View style={styles.planPulseDot} />
          <Text style={styles.planStatusText}>
            {isToday ? "TODAY'S SCHEDULE" : 'PLANNED ROUTINE'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.resyncBtn}
          activeOpacity={0.75}
          onPress={() => { triggerHaptic('notificationSuccess'); setPlan(generatePersonalizedWeeklySchedule()); }}>
          <Icon name="refresh-outline" size={13} color="#B8FF4D" />
          <Text style={styles.resyncText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.planTitleBlock}>
        <Text style={styles.planTitle}>{currentDay?.focus || plan.planTitle}</Text>
        <Text style={styles.planSubtitle}>{plan.planTitle} · {plan.subtitle}</Text>
      </View>

      {/* Week Day Selector Strip */}
      <View style={styles.dayRow}>
        {plan.days.map((day, i) => {
          const isActive = i === planDay;
          const isThisDayToday = i === todayIdx;
          return (
            <TouchableOpacity
              key={day.dayName}
              activeOpacity={0.8}
              style={[
                styles.dayPill,
                isActive && styles.dayPillActive,
                day.isRestDay && !isActive && styles.dayPillRest,
              ]}
              onPress={() => { triggerHaptic('selection'); setPlanDay(i); }}>
              {isThisDayToday && <View style={[styles.todayDot, isActive && styles.todayDotActive]} />}
              <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>
                {day.dayName.slice(0, 3).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {currentDay && (
        <View style={styles.dayDetail}>
          {/* Day Status & Meta */}
          <View style={styles.dayDetailHead}>
            <Text style={styles.dayDetailName}>
              {currentDay.dayName}{isToday ? ' (Today)' : ''}
            </Text>
            <View style={[styles.intensityBadge, currentDay.isRestDay && styles.restBadge]}>
              <Text style={styles.intensityText}>{currentDay.intensity}</Text>
            </View>
          </View>

          {/* Vitals row */}
          <View style={styles.vitalsRow}>
            <View style={styles.vital}>
              <Icon name="time-outline" size={13} color="#B8FF4D" />
              <Text style={styles.vitalText}>{currentDay.durationMin}m</Text>
            </View>
            <View style={styles.vitalDivider} />
            <View style={styles.vital}>
              <Icon name="flame-outline" size={13} color="#FF9F0A" />
              <Text style={styles.vitalText}>~{currentDay.estimatedKcal} kcal</Text>
            </View>
            <View style={styles.vitalDivider} />
            <View style={styles.vital}>
              <Icon name="barbell-outline" size={13} color="#5AC8FF" />
              <Text style={styles.vitalText}>{currentDay.exercises.length} moves</Text>
            </View>
          </View>

          {/* Exercise list */}
          <View style={styles.exList}>
            {currentDay.exercises.map((ex, ei) => (
              <View key={ex.id || ei} style={styles.exRow}>
                <View style={styles.exNum}>
                  <Text style={styles.exNumText}>{ei + 1}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                  <Text style={styles.exSub}>{ex.sets} sets × {ex.reps} reps</Text>
                </View>
                <TouchableOpacity
                  style={styles.swapBtn}
                  activeOpacity={0.7}
                  onPress={() => swapEx(planDay, ei)}>
                  <Icon name="swap-horizontal" size={14} color="#B8FF4D" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {!currentDay.isRestDay && (
            <TouchableOpacity
              style={styles.startDayBtn}
              activeOpacity={0.85}
              onPress={() => { triggerHaptic('impactHeavy'); navigate?.('gym'); }}>
              <Icon name="play" size={16} color="#08140B" />
              <Text style={styles.startDayBtnText}>
                {isToday ? 'START WORKOUT SESSION' : `START ${currentDay.dayName.toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const BG     = '#080E0A';
const CARD   = '#0E1A11';
const BORDER = 'rgba(255,255,255,0.07)';
const ACCENT = '#B8FF4D';

const styles = StyleSheet.create({
  screen:  {flex: 1, backgroundColor: BG},
  content: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20,
    paddingBottom: TAB_BAR_BOTTOM_PADDING + 24,
    gap: 20,
  },

  listHeaderWrap: {gap: 16},
  header:      {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2},
  eyebrow:     {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4},
  title:       {color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5},
  calcBtn:     {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(184,255,77,0.3)'},
  calcBtnText: {color: ACCENT, fontSize: 12, fontWeight: '800'},

  // Program Card (Today's Schedule)
  planCard:       {backgroundColor: '#0D1610', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(184,255,77,0.22)', padding: 16, gap: 14},
  planHeaderRow:  {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  planStatusPill: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(184,255,77,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(184,255,77,0.28)'},
  planPulseDot:   {width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT},
  planStatusText: {color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.1},
  resyncBtn:      {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: BORDER},
  resyncText:     {color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700'},

  planTitleBlock: {gap: 2},
  planTitle:      {color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3},
  planSubtitle:   {color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500'},

  dayRow:           {flexDirection: 'row', gap: 6},
  dayPill:          {flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, position: 'relative'},
  dayPillActive:    {backgroundColor: ACCENT, borderColor: ACCENT},
  dayPillRest:      {opacity: 0.4},
  dayPillText:      {color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700'},
  dayPillTextActive:{color: '#071F12', fontWeight: '900', fontSize: 11},
  todayDot:         {position: 'absolute', top: 3, right: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: '#5AC8FF'},
  todayDotActive:   {backgroundColor: '#071F12'},

  dayDetail:      {backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 12},
  dayDetailHead:  {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  dayDetailName:  {color: '#fff', fontSize: 14, fontWeight: '800'},
  intensityBadge: {backgroundColor: 'rgba(255,159,10,0.15)', borderColor: 'rgba(255,159,10,0.35)', borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8},
  restBadge:      {backgroundColor: 'rgba(90,200,255,0.15)', borderColor: 'rgba(90,200,255,0.4)'},
  intensityText:  {color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase'},

  vitalsRow:     {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  vital:         {flexDirection: 'row', alignItems: 'center', gap: 5},
  vitalText:     {color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700'},
  vitalDivider:  {width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)'},

  exList: {gap: 6},
  exRow:  {flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 10},
  exNum:  {width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT + '20', alignItems: 'center', justifyContent: 'center'},
  exNumText: {color: ACCENT, fontSize: 10, fontWeight: '900'},
  exName: {color: '#fff', fontSize: 13, fontWeight: '700'},
  exSub:  {color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', marginTop: 1},
  swapBtn:{width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'},

  startDayBtn:     {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13, marginTop: 4},
  startDayBtnText: {color: '#08140B', fontSize: 13, fontWeight: '900', letterSpacing: 0.5},

  sessionBanner:  {backgroundColor: '#0D2A17', borderRadius: 22, borderWidth: 1.5, borderColor: ACCENT + '60', padding: 18, gap: 14},
  sessionTop:     {flexDirection: 'row', alignItems: 'center', gap: 12},
  sessionEyebrow: {color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.5},
  sessionExName:  {color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2},
  dotsRow:        {flexDirection: 'row', gap: 6},
  dot:            {flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)'},
  dotActive:      {backgroundColor: ACCENT + '80'},
  dotDone:        {backgroundColor: ACCENT},
  timerRow:       {flexDirection: 'row', alignItems: 'center', gap: 10},
  timerText:      {color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1},
  timerRest:      {color: '#5AC8FF'},
  timerBadge:     {backgroundColor: ACCENT + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: ACCENT + '44'},
  timerBadgeRest: {backgroundColor: 'rgba(90,200,255,0.15)', borderColor: 'rgba(90,200,255,0.4)'},
  timerBadgeText: {color: '#fff', fontSize: 10, fontWeight: '900'},
  repRow:    {flexDirection: 'row', alignItems: 'center', gap: 12},
  repBtn:    {width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center'},
  repBox:    {flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 10},
  repVal:    {color: '#fff', fontSize: 30, fontWeight: '900'},
  repLbl:    {color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1},
  sessionActions: {flexDirection: 'row', gap: 10},
  sessionDoneBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13},
  sessionDoneTxt: {color: '#08140B', fontWeight: '900', fontSize: 15},
  sessionRestBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: BORDER},
  sessionRestTxt: {color: '#fff', fontWeight: '700', fontSize: 14},
  nextEx:         {color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600'},

  summaryCard:  {backgroundColor: '#0D2A17', borderRadius: 22, borderWidth: 1.5, borderColor: ACCENT, padding: 24, alignItems: 'center', gap: 10},
  summaryTitle: {color: '#fff', fontSize: 22, fontWeight: '800'},
  summaryMeta:  {color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600'},
  summaryBtn:   {backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, marginTop: 6},
  summaryBtnText:{color: '#08140B', fontWeight: '900', fontSize: 14},

  libHeader:  {flexDirection: 'row', alignItems: 'center', gap: 10},
  libTitle:   {color: '#fff', fontSize: 22, fontWeight: '800'},
  countBadge: {backgroundColor: ACCENT + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3},
  countText:  {color: ACCENT, fontSize: 12, fontWeight: '800'},

  searchWrap:  {flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, gap: 8},
  searchInput: {flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12, paddingRight: 4, fontWeight: '500'},

  pillScroll:    {marginHorizontal: -20},
  pillContent:   {paddingHorizontal: 20, gap: 8, paddingVertical: 2},
  pill:          {borderRadius: 12, backgroundColor: CARD, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: BORDER},
  pillActive:    {backgroundColor: ACCENT, borderColor: ACCENT},
  pillText:      {color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700'},
  pillTextActive:{color: '#08140B', fontWeight: '900'},
  pillCount:     {color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600'},
  pillCountActive:{color: '#08140B', fontWeight: '800'},

  // Exercise card (Sleek horizontal list row)
  exCard:          {flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D140F', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, gap: 12},
  mediaBox:        {width: 76, height: 76, borderRadius: 14, backgroundColor: '#111813', overflow: 'hidden'},
  mediaPlaceholder:{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101315'},
  exCardContent:   {flex: 1, justifyContent: 'center', gap: 3},
  exCardTop:       {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2},
  catBadge:        {backgroundColor: ACCENT + '18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: ACCENT + '33'},
  exCardCat:       {color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase'},
  diffDot:         {borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1},
  diffText:        {fontSize: 9, fontWeight: '800'},
  exCardName:      {color: '#fff', fontSize: 15, fontWeight: '800'},
  exCardMeta:      {color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600'},
  exStartBtn:      {width: 38, height: 38, borderRadius: 19, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center'},
  exStartText:     {color: '#08140B', fontWeight: '900', fontSize: 13},

  // Modals
  modalBg:       {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'},
  modalCard:     {backgroundColor: '#111A13', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: BORDER, padding: 20, maxHeight: '92%'},
  modalHandle:   {width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16},
  modalHeaderRow:{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14},
  modalTitle:    {color: '#fff', fontSize: 20, fontWeight: '800', flex: 1, paddingRight: 12},
  closeBtn:      {width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center'},
  modalMedia:    {height: 260, borderRadius: 16, backgroundColor: '#111315', overflow: 'hidden', marginBottom: 12},

  metaGrid:      {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  metaTile:      {flex: 1, minWidth: '44%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12},
  metaTileLabel: {color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase'},
  metaTileVal:   {color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4},

  instrTitle:  {color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10},
  instrScroll: {maxHeight: 180, marginBottom: 12},
  instrStep:   {flexDirection: 'row', gap: 10, marginBottom: 10},
  instrNum:    {width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1},
  instrNumText:{color: ACCENT, fontSize: 11, fontWeight: '900'},
  instrText:   {flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, fontWeight: '500'},
  modalCTA:    {backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  modalCTAText:{color: '#08140B', fontWeight: '900', fontSize: 15},

  calcSub:     {color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500', marginTop: 2},
  calcInputs:  {flexDirection: 'row', gap: 12, marginBottom: 16},
  calcLabel:   {color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6},
  calcInput:   {backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, color: '#fff', fontSize: 20, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 10, textAlign: 'center'},
  ormHero:     {alignItems: 'center', backgroundColor: ACCENT + '10', borderRadius: 18, borderWidth: 1, borderColor: ACCENT + '30', padding: 20, marginBottom: 16},
  ormLabel:    {color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1},
  ormVal:      {color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 4},
  ormUnit:     {color: ACCENT, fontSize: 24, fontWeight: '800'},
  calcSection: {color: '#fff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10},
  pctGrid:     {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  pctTile:     {flex: 1, minWidth: '28%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 10, alignItems: 'center'},
  pctPct:      {color: ACCENT, fontSize: 12, fontWeight: '900'},
  pctKg:       {color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 2},
});
