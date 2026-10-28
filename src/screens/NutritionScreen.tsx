import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Image, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {foodLibrary, foodLogMethods, mealPlan, type FoodItem} from '../data/foods';
import {nutritionSummary} from '../services/athleoData';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {getUserProfile, type UserProfile} from '../services/userProfile';
import {addFoodConsumed, subscribeToDailyCalories, type DailyTotals} from '../services/dailyCalories';
import {
  addWaterMl,
  getCaloriesBurned,
  getWaterGoalMl,
  getWaterMl,
  subscribe as subscribeToTrackerMetric,
} from '../services/dailyTracker';
import {SatisfyingWaterWave} from '../components/SatisfyingWaterWave';

type LoggedFood = {
  id: string;
  food: FoodItem;
  servings: number;
};

const MEAL_IMAGES = [
  require('../assets/images/meal_chicken_rice.jpg'),
  require('../assets/images/meal_beef_steak.jpg'),
  require('../assets/images/meal_oatmeal_bowl.jpg'),
];

function getMealImage(name: string, index: number) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('oat') || lower.includes('breakfast') || lower.includes('berry') || lower.includes('egg') || lower.includes('toast')) {
    return MEAL_IMAGES[2];
  }
  if (lower.includes('beef') || lower.includes('steak') || lower.includes('meat') || lower.includes('kebab') || lower.includes('dinner')) {
    return MEAL_IMAGES[1];
  }
  return MEAL_IMAGES[index % MEAL_IMAGES.length];
}

function isPakistaniFood(item: FoodItem): boolean {
  if (item.romanUrduName && item.romanUrduName.trim().length > 0) {
    const cat = (item.category ?? '').toLowerCase();
    if (cat.includes('pakistani')) {return true;}
    if (cat.includes('international')) {return false;}
    return true;
  }
  const cat = (item.category ?? '').toLowerCase();
  if (cat.includes('pakistani')) {return true;}
  if (cat.includes('international')) {return false;}
  return false;
}

function calculatePersonalizedTargets(p: UserProfile): {
  caloriesTarget: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const activityMultiplierMap: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9,
  };
  const activity = p.activityLevel ?? 'moderate';
  const activityMultiplier = activityMultiplierMap[activity] ?? 1.55;

  // Real age + sex from onboarding. The earlier version hard-coded a 26-year-old
  // male, so every user ended up with the same calorie target regardless of the
  // answers they gave.
  const currentYear = new Date().getFullYear();
  const age =
    p.birthYear && p.birthYear > currentYear - 100 && p.birthYear < currentYear
      ? Math.max(14, currentYear - p.birthYear)
      : 26;
  const sexOffset = p.gender === 'female' ? -161 : p.gender === 'male' ? 5 : -78;

  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + sexOffset;
  let tdee = Math.round(bmr * activityMultiplier);
  const goal = p.goal;
  if (goal === 'fat') {tdee = Math.round(tdee - 500);}
  else if (goal === 'muscle') {tdee = Math.round(tdee + 350);}
  else if (goal === 'strength') {tdee = Math.round(tdee + 200);}
  else if (goal === 'endurance') {tdee = Math.round(tdee + 150);}
  if (p.stress === 'high') {tdee = Math.round(tdee * 0.95);}

  let proteinPerKg = 1.8;
  if (goal === 'muscle' || goal === 'strength') {proteinPerKg = 2.2;}
  else if (goal === 'fat') {proteinPerKg = 2.4;}
  else if (goal === 'endurance') {proteinPerKg = 1.6;}
  if (p.experience === 'advanced') {proteinPerKg += 0.2;}
  if (p.bodyType === 'ecto') {proteinPerKg -= 0.1;}
  if (p.bodyType === 'endo') {proteinPerKg += 0.2;}

  const proteinGrams = Math.round(p.weightKg * proteinPerKg);
  const fatGrams = Math.round(p.weightKg * 0.9);
  const carbsGrams = Math.max(0, Math.round((tdee - proteinGrams * 4 - fatGrams * 9) / 4));
  return {caloriesTarget: tdee, protein: proteinGrams, carbs: carbsGrams, fat: fatGrams};
}

export function NutritionScreen() {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loggedFoods, setLoggedFoods] = useState<LoggedFood[]>([]);
  const [selectedDb, setSelectedDb] = useState<'pakistani' | 'international'>('pakistani');
  const [toastText, setToastText] = useState<string | null>(null);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals | null>(null);
  // Active energy burned today (steps + workouts). Owned by dailyTracker so the
  // dashboard, the pedometer and this screen all read the same number.
  const [burnedKcal, setBurnedKcal] = useState(getCaloriesBurned());

  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    return subscribeToDailyCalories(t => setDailyTotals(t), true);
  }, []);

  // Live burned-calorie figure (updated by the step sensor + workout logging).
  useEffect(() => {
    return subscribeToTrackerMetric('calories_burned', value => setBurnedKcal(value));
  }, []);

  const [waterMl, setWaterMl] = useState(getWaterMl());
  const waterGoalMl = useRef(getWaterGoalMl()).current;

  // Live water figure
  useEffect(() => {
    return subscribeToTrackerMetric('water_ml', (val: number) => setWaterMl(val));
  }, []);

  const handleAddWater = (ml: number) => {
    const updated = addWaterMl(ml);
    setWaterMl(updated);
    showToast(`+ ${ml}ml Hydration Logged 💧`);
  };

  const showToast = (msg: string) => {
    setToastText(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      Animated.delay(1400),
      Animated.timing(toastOpacity, {toValue: 0, duration: 350, useNativeDriver: true}),
    ]).start(() => setToastText(t => (t === msg ? null : t)));
  };

  const profile = getUserProfile();
  const personalized = calculatePersonalizedTargets(profile);

  // Single source of truth for what has been eaten today: the dailyCalories
  // store (which also mirrors its total into dailyTracker, so the dashboard and
  // the Supabase rollup agree). This screen previously added a local tally of
  // `loggedFoods` AND a static demo seed ON TOP of the store, which counted
  // every logged meal twice and inflated the totals.
  const totalCaloriesConsumed = dailyTotals?.consumedCalories ?? 0;
  const totalProtein = dailyTotals?.consumedProtein ?? 0;
  const totalCarbs = dailyTotals?.consumedCarbs ?? 0;
  const totalFat = dailyTotals?.consumedFat ?? 0;

  const proteinTarget = personalized.protein || nutritionSummary.protein.target;
  const carbsTarget = personalized.carbs || nutritionSummary.carbs.target;
  const fatTarget = personalized.fat || nutritionSummary.fat.target;
  const caloriesTarget = personalized.caloriesTarget || nutritionSummary.caloriesTarget;

  const proteinPct = Math.max(0, Math.min(100, (totalProtein / Math.max(1, proteinTarget)) * 100));
  const carbsPct = Math.max(0, Math.min(100, (totalCarbs / Math.max(1, carbsTarget)) * 100));
  const fatPct = Math.max(0, Math.min(100, (totalFat / Math.max(1, fatTarget)) * 100));
  const remaining = Math.max(0, caloriesTarget - totalCaloriesConsumed + burnedKcal);

  // Calories from the foods logged in this session (the "Logged Today" list).
  const loggedSessionCalories = loggedFoods.reduce(
    (sum, lf) => sum + lf.food.calories * lf.servings,
    0,
  );

  const allMeals = useMemo(
    () => mealPlan.flatMap(day => day.meals.map(meal => ({...meal, day: day.day}))),
    [],
  );

  const query = debouncedSearch.trim().toLowerCase();

  const searchResults = useMemo(() => {
    const raw = query;
    if (!raw) {return [];}
    const tokens = raw.split(/\s+/).filter(Boolean);

    const dbFiltered = foodLibrary.filter(item => {
      const isPak = isPakistaniFood(item);
      if (selectedDb === 'pakistani') {return isPak;}
      return !isPak;
    });

    const scored = dbFiltered
      .map(item => {
        const haystack = [
          item.name,
          item.englishName ?? '',
          item.romanUrduName ?? '',
          item.category,
          item.serving ?? '',
          ...(item.tags ?? []),
        ].join(' ').toLowerCase();
        const exact = haystack.includes(raw) ? 3 : 0;
        const tokenHits = tokens.reduce((acc, tok) => (haystack.includes(tok) ? acc + 1 : acc), 0);
        const nameHit = (item.name ?? '').toLowerCase().includes(raw) ? 2 : 0;
        return {item, score: exact + tokenHits + nameHit};
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.item);

    return scored.slice(0, 8);
  }, [query, selectedDb]);

  const addFoodServing = (food: FoodItem) => {
    setLoggedFoods(prev => {
      const existing = prev.find(lf => lf.id === food.id);
      if (existing) {
        return prev.map(lf => lf.id === food.id ? {...lf, servings: lf.servings + 1} : lf);
      }
      return [...prev, {id: food.id, food, servings: 1}];
    });
    addFoodConsumed({
      name: food.name,
      servings: 1,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    });
    showToast(`+ ${food.name} (${food.calories} kcal)`);
  };

  const removeFoodServing = (foodId: string) => {
    const item = loggedFoods.find(lf => lf.id === foodId);
    setLoggedFoods(prev => {
      const existing = prev.find(lf => lf.id === foodId);
      if (!existing) {return prev;}
      if (existing.servings <= 1) {
        return prev.filter(lf => lf.id !== foodId);
      }
      return prev.map(lf => lf.id === foodId ? {...lf, servings: lf.servings - 1} : lf);
    });
    if (item) {
      addFoodConsumed({
        name: item.food.name,
        servings: -1,
        calories: -item.food.calories,
        protein: -item.food.protein,
        carbs: -item.food.carbs,
        fat: -item.food.fat,
      });
    }
  };

  return (
    <View style={styles.root}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.segmentedTabs}>
        <TouchableOpacity style={[styles.tabButton, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton}>
          <Text style={styles.tabText}>Meal Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton}>
          <Text style={styles.tabText}>Macros Analysis</Text>
        </TouchableOpacity>
      </View>

      <AppCard style={styles.dashboardCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.miniLabel}>Kinetic Energy Balance</Text>
          <View style={styles.pill}><Text style={styles.pillText}>Optimal Fueling</Text></View>
        </View>

        <View style={styles.mainRow}>
          <View style={styles.ringWrap}>
            <View style={styles.ringOuter}>
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{Math.round(totalCaloriesConsumed)}</Text>
                <Text style={styles.ringMeta}>/ {caloriesTarget.toLocaleString()} kcal</Text>
              </View>
            </View>
            <Text style={styles.ringNote}>{remaining} kcal remaining</Text>
          </View>

          <View style={styles.macroList}>
            <View style={styles.macroRow}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroName}>Protein</Text>
                <Text style={styles.macroAmount}>{Math.round(totalProtein)}g <Text style={styles.macroGoal}>/ {proteinTarget}g</Text></Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, {width: `${Math.min(100, proteinPct)}%`, backgroundColor: ATHLEO_COLORS.accent}]} /></View>
            </View>
            <View style={styles.macroRow}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroName}>Carbohydrates</Text>
                <Text style={styles.macroAmount}>{Math.round(totalCarbs)}g <Text style={styles.macroGoal}>/ {carbsTarget}g</Text></Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, styles.bgSoftGreen, {width: `${Math.min(100, carbsPct)}%`}]} /></View>
            </View>
            <View style={styles.macroRow}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroName}>Lipids / Fats</Text>
                <Text style={styles.macroAmount}>{Math.round(totalFat)}g <Text style={styles.macroGoal}>/ {fatTarget}g</Text></Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, styles.bgOrange, {width: `${Math.min(100, fatPct)}%`}]} /></View>
            </View>
          </View>
        </View>
      </AppCard>

      {/* ─── Ultra-Satisfying Fluid Hydration Tracking ─── */}
      <AppCard style={styles.hydrationCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.miniLabel}>Hydration Fluid Dynamics</Text>
          <View style={styles.pillAqua}><Text style={styles.pillAquaText}>Cellular Recovery</Text></View>
        </View>
        <SatisfyingWaterWave
          currentMl={waterMl}
          targetMl={waterGoalMl}
          onAddWater={handleAddWater}
        />
      </AppCard>

      <AppCard style={styles.searchCard}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, selectedDb === 'pakistani' && styles.toggleButtonActive]}
            onPress={() => setSelectedDb('pakistani')}>
            <Text style={selectedDb === 'pakistani' ? styles.toggleButtonTextActive : styles.toggleButtonText}>Pakistani Staples</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, selectedDb === 'international' && styles.toggleButtonActive]}
            onPress={() => setSelectedDb('international')}>
            <Text style={selectedDb === 'international' ? styles.toggleButtonTextActive : styles.toggleButtonText}>International DB</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search 600+ foods..."
            placeholderTextColor={ATHLEO_COLORS.muted}
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.scanButton} onPress={() => showToast('Scanner feature ready')}>
            <Text style={styles.scanText}>◍</Text>
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map(food => (
              <TouchableOpacity
                key={food.id}
                style={styles.searchResultRow}
                onPress={() => addFoodServing(food)}>
                <View style={styles.searchResultBody}>
                  <Text style={styles.searchResultName}>{food.name}</Text>
                  <Text style={styles.searchResultMeta}>{food.serving} • {food.category}</Text>
                </View>
                <View style={styles.searchResultRight}>
                  <Text style={styles.searchResultCalories}>{food.calories} kcal</Text>
                  <Text style={styles.searchResultMacros}>P {food.protein}g • C {food.carbs}g • F {food.fat}g</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {searchText.trim().length > 0 && searchResults.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No foods match "{searchText}". Try biryani, oats, daal...</Text>
          </View>
        )}
      </AppCard>

      {loggedFoods.length > 0 && (
        <AppCard style={styles.sectionCard}>
          <View style={styles.mealHeaderRow}>
            <Text style={styles.mealTitle}>Logged Today</Text>
            <Text style={styles.mealMeta}>{loggedFoods.length} items • +{Math.round(loggedSessionCalories)} kcal</Text>
          </View>
          {loggedFoods.map(lf => (
            <View key={lf.id} style={styles.loggedRow}>
              <View style={styles.loggedBody}>
                <Text style={styles.loggedName}>{lf.food.name}</Text>
                <Text style={styles.loggedMeta}>{lf.servings} × {lf.food.serving}</Text>
              </View>
              <View style={styles.loggedRight}>
                <Text style={styles.loggedCalories}>{Math.round(lf.food.calories * lf.servings)} kcal</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => removeFoodServing(lf.id)}>
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperCount}>{lf.servings}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => addFoodServing(lf.food)}>
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </AppCard>
      )}

      <View style={styles.mealHeaderRow}>
        <Text style={styles.mealTitle}>Session Meal Journal</Text>
        <Text style={styles.mealMeta}>{nutritionSummary.meals.length + loggedFoods.length} logged today</Text>
      </View>

      {allMeals.slice(0, 8).map((meal, idx) => (
        <AppCard key={`${meal.day}-${meal.slot}-${meal.name}`} style={styles.mealCard}>
          <Image
            source={getMealImage(meal.name, idx)}
            style={styles.mealThumb}
            resizeMode="cover"
          />
          <View style={styles.mealBody}>
            <View style={styles.mealTopLine}>
              <Text style={styles.mealTag}>{meal.tag}</Text>
              <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
            </View>
            <Text style={styles.mealName}>{meal.name}</Text>
            <Text style={styles.mealDay}>{meal.day} • {meal.slot}</Text>
            <Text style={styles.mealMacros}>{meal.protein}g P • {meal.carbs}g C • {meal.fat}g F</Text>
          </View>
        </AppCard>
      ))}

      <View style={styles.quickLogRow}>
        {foodLogMethods.map(method => (
          <TouchableOpacity
            key={method}
            style={styles.quickLogCard}
            onPress={() => showToast(`${method} logging selected`)}>
            <Text style={styles.quickLogText}>{method}</Text>
          </TouchableOpacity>
        ))}
      </View>
      </SmoothScrollView>

      {toastText ? (
        <Animated.View style={[styles.toastWrap, {opacity: toastOpacity}]} pointerEvents="none">
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toastText}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md},
  segmentedTabs: {flexDirection: 'row', backgroundColor: '#0A2E19', borderRadius: 16, padding: 6, gap: 6, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  tabButton: {flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center'},
  tabActive: {backgroundColor: '#B8FF4D'},
  tabText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5},
  tabTextActive: {color: '#071F12', fontWeight: '900'},
  dashboardCard: {backgroundColor: '#0D331D', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  cardHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  miniLabel: {color: '#FFFFFF', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  pill: {backgroundColor: '#B8FF4D', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5},
  pillText: {color: '#071F12', fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase'},
  mainRow: {marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 16},
  ringWrap: {width: '36%', alignItems: 'center'},
  ringOuter: {width: 112, height: 112, borderRadius: 56, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: ATHLEO_COLORS.accent},
  ringInner: {alignItems: 'center', justifyContent: 'center'},
  ringValue: {color: '#FFFFFF', fontSize: 22, fontWeight: '900'},
  ringMeta: {color: '#D4FFB2', fontSize: 12, fontWeight: '700'},
  ringNote: {marginTop: 10, color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '800'},
  macroList: {flex: 1, gap: 10},
  macroRow: {gap: 6},
  macroHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  macroName: {color: '#FFFFFF', fontWeight: '800', fontSize: 14},
  macroAmount: {color: '#FFFFFF', fontWeight: '800', fontSize: 14},
  macroGoal: {color: '#D4FFB2', fontWeight: '700'},
  track: {height: 8, backgroundColor: '#123A21', borderRadius: 999, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 999},
  searchCard: {backgroundColor: '#0D331D', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  toggleRow: {flexDirection: 'row', gap: 8},
  toggleButton: {flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  toggleButtonActive: {backgroundColor: '#B8FF4D', borderColor: '#B8FF4D'},
  toggleButtonText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  toggleButtonTextActive: {color: '#071F12', fontWeight: '900'},
  searchBar: {marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F3820', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  searchIcon: {color: '#B8FF4D', fontSize: 20, marginRight: 8},
  searchInput: {flex: 1, color: '#FFFFFF', paddingVertical: 12, fontSize: 15, fontWeight: '700'},
  scanButton: {width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B8FF4D'},
  scanText: {color: '#071F12', fontSize: 16, fontWeight: '900'},
  mealHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  mealTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '800'},
  mealMeta: {color: '#D4FFB2', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800'},
  mealCard: {backgroundColor: '#0D331D', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)', flexDirection: 'row', alignItems: 'center', gap: 12},
  mealThumb: {width: 68, height: 68, borderRadius: 16, backgroundColor: '#103F23', overflow: 'hidden'},
  mealBody: {flex: 1},
  mealTopLine: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  mealTag: {color: ATHLEO_COLORS.accent, fontWeight: '800', textTransform: 'uppercase', fontSize: 12},
  mealCalories: {color: '#FFFFFF', fontWeight: '800', fontSize: 14},
  mealName: {color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 6},
  mealDay: {color: '#D4FFB2', fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700'},
  mealMacros: {color: '#E0FFE8', marginTop: 4, fontSize: 13, fontWeight: '600'},
  quickLogRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  quickLogCard: {flexBasis: '31%', backgroundColor: '#0F3820', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  quickLogText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  sectionCard: {backgroundColor: '#0D331D', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  searchResults: {marginTop: 12, gap: 8},
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0F3820',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  searchResultBody: {flex: 1},
  searchResultName: {color: '#FFFFFF', fontSize: 15, fontWeight: '800'},
  searchResultMeta: {color: '#D4FFB2', fontSize: 13, marginTop: 2, fontWeight: '600'},
  searchResultRight: {alignItems: 'flex-end', marginLeft: 10},
  searchResultCalories: {color: ATHLEO_COLORS.accent, fontSize: 14, fontWeight: '900'},
  searchResultMacros: {color: '#E0FFE8', fontSize: 12, marginTop: 2, fontWeight: '600'},
  noResults: {paddingVertical: 16, alignItems: 'center'},
  noResultsText: {color: '#FFFFFF', fontSize: 14, textAlign: 'center', fontWeight: '700'},
  loggedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  loggedBody: {flex: 1},
  loggedName: {color: ATHLEO_COLORS.text, fontSize: 14, fontWeight: '700'},
  loggedMeta: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},
  loggedRight: {alignItems: 'flex-end', marginLeft: 10},
  loggedCalories: {color: ATHLEO_COLORS.accent, fontSize: 13, fontWeight: '800', marginBottom: 4},
  stepperRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#1A1B1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  stepperBtnText: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '700', lineHeight: 18},
  stepperCount: {color: ATHLEO_COLORS.text, fontSize: 13, fontWeight: '800', minWidth: 18, textAlign: 'center'},
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 112,
    alignItems: 'center',
    zIndex: 20,
  },
  toastCard: {
    backgroundColor: 'rgba(20,20,23,0.96)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  toastText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bgSoftGreen: {
    backgroundColor: '#AAD378',
  },
  bgOrange: {
    backgroundColor: '#FFB020',
  },
  hydrationCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 16, 26, 0.55)',
    borderWidth: 1.2,
    borderColor: 'rgba(0, 180, 216, 0.22)',
    marginBottom: 16,
  },
  pillAqua: {
    backgroundColor: 'rgba(0, 180, 216, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(72, 202, 228, 0.35)',
  },
  pillAquaText: {
    color: '#48CAE4',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
