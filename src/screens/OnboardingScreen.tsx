import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {DynamicFeedbackCard} from '../components/DynamicFeedbackCard';
import {PressableScale} from '../components/PressableScale';
import {PrimaryButton} from '../components/PrimaryButton';
import {SelectableOption} from '../components/SelectableOption';
import {fetchUserAdvice, type UserAdviceBundle} from '../services/adviceService';
import {requestAllPermissionsAsync} from '../services/permissionsService';
import {syncOnboardingToBackend, cacheUserLocally, markOnboardingComplete, type OnboardingAnswersPayload} from '../services/profileSync';
import {setUserProfile, type UserProfile} from '../services/userProfile';
import {detectAndSyncLocation} from '../services/locationTimezoneService';
import {saveAndSyncWorkoutSchedule} from '../services/workoutScheduleService';
import {ATHLEO_COLORS, ATHLEO_GLOW, ATHLEO_SPACING, ATHLEO_TYPE} from '../theme/theme';

// ── Onboarding Premium Generated Image Assets
const FACE_SCAN_IMG = require('../assets/images/biometric_face_scan.jpg');
const HERO_RUNNER   = require('../assets/images/athleo_hero_runner.jpg');

interface OnboardingScreenProps {
  onComplete: () => void;
}

type Step =
  | 'intro'
  | 'gender'
  | 'goal'
  | 'motivation'
  | 'bodyShape'
  | 'birthYear'
  | 'measurements'
  | 'bellyType'
  | 'idealWeight'
  | 'frequency'
  | 'role'
  | 'injuries'
  | 'level'
  | 'difficulty'
  | 'focus'
  | 'preferences'
  | 'muscleHistory'
  | 'mindset'
  | 'rewards'
  | 'coach'
  | 'plan'
  | 'permissions';

const STEPS: Step[] = [
  'intro',
  'gender',
  'goal',
  'motivation',
  'bodyShape',
  'birthYear',
  'measurements',
  'bellyType',
  'idealWeight',
  'frequency',
  'role',
  'injuries',
  'level',
  'difficulty',
  'focus',
  'preferences',
  'muscleHistory',
  'mindset',
  'rewards',
  'coach',
  'plan',
  'permissions',
];

const GENDERS = [
  {id: 'male', label: 'Male', icon: 'male-outline'},
  {id: 'female', label: 'Female', icon: 'female-outline'},
  {id: 'other', label: 'Other / Prefer not to say', icon: 'person-outline'},
];

const FOCUS_AREAS = [
  {id: 'arm', label: 'Arm'},
  {id: 'shoulder', label: 'Shoulder'},
  {id: 'chest', label: 'Chest'},
  {id: 'abs', label: 'Abs'},
  {id: 'leg', label: 'Leg'},
  {id: 'full-body', label: 'Full Body'},
];

const MAIN_GOALS = [
  {id: 'fat', label: 'Lose Weight', icon: 'flame-outline', color: '#FFB020'},
  {id: 'muscle', label: 'Build Muscle', icon: 'barbell-outline', color: '#FF6B35'},
  {id: 'wellness', label: 'Keep Fit', icon: 'heart-outline', color: '#6AE28D'},
];

const MOTIVATIONS = [
  {id: 'attractive', label: 'Look more attractive'},
  {id: 'confidence', label: 'Gain confidence & vitality'},
  {id: 'pain', label: 'Relieve sedentary pain'},
  {id: 'sleep', label: 'Sleep better'},
];

/**
 * Body-shape answer cards. Each option shows the matching torso illustration so
 * the question is answered visually instead of by label alone.
 */
const BODY_SHAPES = [
  {
    id: 'skinny',
    label: 'Skinny',
    image: require('../assets/app_models/Male_torso_digital_illustration_20261017152433-removebg-preview.png'),
  },
  {
    id: 'medium',
    label: 'Medium',
    image: require('../assets/app_models/Shirtless_male_torso_digital_ill__20261017152508-removebg-preview.png'),
  },
  {
    id: 'flabby',
    label: 'Flabby',
    image: require('../assets/app_models/Male_torso_frontal_view_20261017153510-removebg-preview.png'),
  },
  {
    id: 'muscular',
    label: 'Muscular',
    image: require('../assets/app_models/Muscular_man_torso_frontal_view_20261017153809-removebg-preview.png'),
  },
];

const BODY_TYPES = [
  {id: 'normal', label: 'Normal'},
  {id: 'chubby', label: 'Chubby'},
  {id: 'alcohol', label: 'Alcohol'},
  {id: 'stressed', label: 'Stressed-out'},
];

const IDEAL_WEIGHT_PERIODS = [
  {id: 'right-now', label: 'Right now'},
  {id: 'under-1-year', label: '< 1 year ago'},
  {id: '1-to-3-years', label: '1–3 years ago'},
  {id: 'over-3-years', label: '> 3 years ago'},
  {id: 'never', label: 'Never'},
];

const ROLES = [
  {id: 'student', label: 'Student'},
  {id: 'full-time-employee', label: 'Full-Time Employee'},
  {id: 'part-time-worker', label: 'Part-Time Worker'},
  {id: 'freelancer', label: 'Freelancer'},
  {id: 'homemaker', label: 'Homemaker'},
  {id: 'business-owner', label: 'Business Owner'},
  {id: 'shift-worker', label: 'Shift Worker'},
];

const INJURY_OPTIONS = ['None', 'Shoulder', 'Wrist', 'Knee', 'Ankle', 'Lower Back'];

const FITNESS_LEVELS = [
  {id: 'beginner', label: 'Beginner'},
  {id: 'intermediate', label: 'Intermediate'},
  {id: 'advanced', label: 'Advanced'},
];

const DIFFICULTY_LEVELS = [
  {id: 'easy', label: 'Easy to start'},
  {id: 'light-sweat', label: 'Break a light sweat'},
  {id: 'challenging', label: 'A bit challenging'},
];

const ACTIVITY_TAGS = [
  'At-Home Fitness',
  'Calisthenics',
  'Stretch',
  'Fast Workout',
  'Chair Exercises',
  'Running',
  'Dumbbell Workout',
  'HIIT',
  'Posture Workout',
];

const MUSCLE_HISTORY = [
  {id: 'never', label: 'Never succeeded'},
  {id: 'lost-later', label: 'Succeeded but lost muscle later'},
  {id: 'not-now', label: 'I was strong, but not now'},
  {id: 'aim-higher', label: 'Succeeded and aim higher!'},
];

const REWARDS = [
  'Feel stronger',
  'Look leaner',
  'Move without pain',
  'Build confidence',
  'Sleep better',
  'Perform better',
];

const COACHES = [
  {
    id: 'maya',
    label: 'Maya',
    role: 'Strength & recovery',
    image: require('../assets/images/coach_maya.jpg'),
  },
  {
    id: 'leo',
    label: 'Leo',
    role: 'Cardio & conditioning',
    image: require('../assets/images/coach_leo.jpg'),
  },
  {
    id: 'zoe',
    label: 'Zoe',
    role: 'Mobility & posture',
    image: require('../assets/images/coach_zoe.jpg'),
  },
];

function QuestionHeader({title, subtitle}: {title: string; subtitle?: string}) {
  return (
    <View style={styles.questionHead}>
      <Text style={styles.questionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.questionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function OnboardingScreen({onComplete}: OnboardingScreenProps) {
  const [step, setStep] = useState<Step>('intro');
  const [gender, setGender] = useState<string | null>('male');
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>(['full-body']);
  const [selectedGoal, setSelectedGoal] = useState<string | null>('muscle');
  const [selectedMotivation, setSelectedMotivation] = useState<string | null>('confidence');
  const [bodyShape, setBodyShape] = useState<string | null>('medium');
  const [targetBodyFat, setTargetBodyFat] = useState(18);
  const [birthYear, setBirthYear] = useState('1997');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weight, setWeight] = useState('74');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [height, setHeight] = useState('176');
  const [targetWeight, setTargetWeight] = useState('68');
  const [bellyType, setBellyType] = useState<string | null>('normal');
  const [idealWeightPeriod, setIdealWeightPeriod] = useState<string | null>('right-now');
  const [workoutFrequency, setWorkoutFrequency] = useState(3);
  const [selectedRole, setSelectedRole] = useState<string | null>('full-time-employee');
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState<string | null>('beginner');
  const [dailyActivity, setDailyActivity] = useState(55);
  const [difficulty, setDifficulty] = useState<string | null>('light-sweat');
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(['At-Home Fitness']);
  const [selectedMuscleHistory, setSelectedMuscleHistory] = useState<string | null>('lost-later');
  const [mindsetAnswer, setMindsetAnswer] = useState<string | null>('yes');
  const [selectedRewards, setSelectedRewards] = useState<string[]>(['Build confidence']);
  const [selectedCoach, setSelectedCoach] = useState<string | null>('maya');
  const [formError, setFormError] = useState<string | null>(null);

  // The personalised targets + advice the reveal card renders. Kept null until the
  // plan step is reached so no other user's cached numbers can ever be shown.
  const [adviceBundle, setAdviceBundle] = useState<UserAdviceBundle | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  // In-flight profile sync. The advice fetch awaits it so the backend has the
  // onboarding answers *before* it is asked to derive the targets.
  const syncPromiseRef = useRef<Promise<unknown> | null>(null);

  // One master driver pair for step transitions. A single fade + slide keeps the
  // step swap cheap: only opacity + transform cross the bridge (native driver).
  const fade = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(0)).current;

  // Continuous, soft logo pulse — the same value drives the orb scale and the
  // halo glow via interpolations, so nothing extra hits the JS thread.
  const logoPulse = useRef(new Animated.Value(0.96)).current;
  const glowOpacity = logoPulse.interpolate({inputRange: [0.96, 1.04], outputRange: [0.28, 0.62]});
  const glowScale = logoPulse.interpolate({inputRange: [0.96, 1.04], outputRange: [0.94, 1.08]});

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {toValue: 1.04, duration: 1400, useNativeDriver: true}),
        Animated.timing(logoPulse, {toValue: 0.96, duration: 1400, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [logoPulse]);

  const currentIndex = STEPS.indexOf(step);
  const progress = (currentIndex + 1) / STEPS.length;

  // Animated progress bar. Percentage width interpolation is intentionally
  // driven on the JS thread (useNativeDriver: false) — a single element is
  // negligible and this is the only way to animate a percentage width.
  const progressAnim = useRef(new Animated.Value(1 / STEPS.length)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Reveal-step data. Runs once when the plan step mounts: wait for the profile
  // sync that `handleNext` kicked off on the coach step, then ask the backend's
  // calculation engine (`get_user_advice()`) for the targets. `fetchUserAdvice`
  // never rejects — it falls back to the on-device derivation — so this can
  // never leave the reveal stuck on a spinner.
  useEffect(() => {
    if (step !== 'plan') {
      return;
    }

    let cancelled = false;
    setAdviceLoading(true);

    const load = async () => {
      try {
        await syncPromiseRef.current;
      } catch {
        /* fire-and-forget sync — a failure simply falls back to local targets */
      }
      const bundle = await fetchUserAdvice();
      if (!cancelled) {
        setAdviceBundle(bundle);
      }
    };

    load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setAdviceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [step]);

  const weightNum = useMemo(() => {
    const n = parseFloat(weight);
    return Number.isFinite(n) ? n : NaN;
  }, [weight]);

  const heightNum = useMemo(() => {
    const n = parseFloat(height);
    return Number.isFinite(n) ? n : NaN;
  }, [height]);

  const measurementOk =
    Number.isFinite(weightNum) && weightNum >= 30 && weightNum <= 250 &&
    Number.isFinite(heightNum) && heightNum >= 120 && heightNum <= 230;

  const transition = useCallback((nextStep: Step) => {
    Animated.parallel([
      Animated.timing(fade, {toValue: 0, duration: 180, useNativeDriver: true}),
      Animated.timing(slideY, {toValue: -10, duration: 180, useNativeDriver: true}),
    ]).start(() => {
      setStep(nextStep);
      setFormError(null);
      slideY.setValue(14);
      Animated.parallel([
        Animated.timing(fade, {toValue: 1, duration: 300, useNativeDriver: true}),
        Animated.timing(slideY, {toValue: 0, duration: 300, useNativeDriver: true}),
      ]).start();
    });
  }, [fade, slideY]);

  const handleBack = () => {
    if (currentIndex === 0) {return;}
    transition(STEPS[currentIndex - 1]);
  };

  const canAdvance = useCallback(() => {
    switch (step) {
      case 'gender':
        return Boolean(gender);
      case 'goal':
        return Boolean(selectedGoal);
      case 'motivation':
        return Boolean(selectedMotivation);
      case 'bodyShape':
        return Boolean(bodyShape);
      case 'measurements':
        return measurementOk;
      case 'bellyType':
        return Boolean(bellyType);
      case 'idealWeight':
        return Boolean(idealWeightPeriod);
      case 'role':
        return Boolean(selectedRole);
      case 'level':
        return Boolean(fitnessLevel);
      case 'difficulty':
        return Boolean(difficulty);
      case 'preferences':
        return selectedPreferences.length > 0;
      case 'coach':
        return Boolean(selectedCoach);
      default:
        return true;
    }
  }, [
    step,
    gender,
    selectedGoal,
    selectedMotivation,
    bodyShape,
    measurementOk,
    bellyType,
    idealWeightPeriod,
    selectedRole,
    fitnessLevel,
    difficulty,
    selectedPreferences,
    selectedCoach,
  ]);

  const validateStep = useCallback((): string | null => {
    if (step === 'measurements') {
      return measurementOk ? null : 'Weight should be 30–250 and height 120–230.';
    }
    if (step === 'bellyType' || step === 'idealWeight' || step === 'role') {
      return canAdvance() ? null : 'Please complete the body profile before continuing.';
    }
    if (step === 'level' || step === 'difficulty' || step === 'preferences' || step === 'coach') {
      return canAdvance() ? null : 'Please complete the fitness assessment before continuing.';
    }
    if (step === 'gender' || step === 'goal' || step === 'motivation' || step === 'bodyShape') {
      return canAdvance() ? null : 'Please finish all goal and focus details before continuing.';
    }
    return null;
  }, [step, measurementOk, canAdvance]);

  const toggleSelection = (value: string, arr: string[], setFn: (next: string[]) => void) => {
    const exists = arr.includes(value);
    setFn(exists ? arr.filter(item => item !== value) : [...arr, value]);
  };

  const handleNext = useCallback(async () => {
    const error = validateStep();
    if (error) {
      setFormError(error);
      return;
    }

    // `coach` is the last step that collects an answer, so the profile is
    // persisted on the way out of it — before the plan reveal — which is what
    // lets the reveal show targets derived from the answers just given.
    if (step === 'coach') {
      const finalWeight = Math.max(30, Math.min(250, Math.round(weightNum || 72)));
      const finalHeight = Math.max(120, Math.min(230, Math.round(heightNum || 176)));
      const finalTargetWeight = Number.parseFloat(targetWeight) || finalWeight;
      const finalBirthYear = Number.parseInt(birthYear, 10) || null;

      // Derive the activity band from the daily-movement answer so the local
      // targets (calories/steps) and the backend derivation agree.
      const derivedActivityLevel: UserProfile['activityLevel'] =
        dailyActivity < 25 ? 'sedentary'
        : dailyActivity < 45 ? 'light'
        : dailyActivity < 65 ? 'moderate'
        : dailyActivity < 85 ? 'active'
        : 'athlete';

      const finalProfile: Partial<UserProfile> = {
        weightKg: finalWeight,
        heightCm: finalHeight,
        goal: (selectedGoal as UserProfile['goal']) ?? null,
        activityLevel: derivedActivityLevel,
        bodyType: (bodyShape as UserProfile['bodyType']) ?? null,
        stress: 'medium',
        experience: (fitnessLevel as UserProfile['experience']) ?? 'beginner',
        sessionDuration: 'standard',
        gender: (gender as UserProfile['gender']) ?? null,
        focusAreas: selectedFocusAreas,
        motivation: selectedMotivation,
        bodyShape,
        targetBodyFat,
        birthYear: finalBirthYear,
        heightUnit,
        bellyType,
        lastIdealWeight: idealWeightPeriod,
        workoutFrequency,
        currentRole: selectedRole,
        injuries: selectedInjuries,
        fitnessLevel: (fitnessLevel as UserProfile['fitnessLevel']) ?? 'beginner',
        dailyActivity,
        workoutDifficulty: difficulty,
        activityPreferences: selectedPreferences,
        muscleHistory: selectedMuscleHistory,
        mindsetBlocker: mindsetAnswer,
        postGoalRewards: selectedRewards,
        guideCoach: selectedCoach,
        targetWeightKg: finalTargetWeight,
      };

      setUserProfile(finalProfile);

      // Persist every answer to the backend. Fire-and-forget — the UI must never
      // block on the network here. The SQL trigger turns these answers into the
      // user's calorie / step targets and personalised fitness advice. The
      // promise is retained so the plan reveal can await it before asking the
      // backend's calculation engine for those targets.
      const payload: OnboardingAnswersPayload = {
        sex: finalProfile.gender ?? null,
        heightCm: finalHeight,
        weightKg: finalWeight,
        targetWeightKg: finalTargetWeight,
        birthYear: finalBirthYear,
        goal: selectedGoal,
        activityLevel: derivedActivityLevel,
        fitnessLevel: finalProfile.fitnessLevel ?? 'beginner',
        workoutFrequency,
        dailyActivity,
        answers: {
          gender,
          goal: selectedGoal,
          motivation: selectedMotivation,
          focusAreas: selectedFocusAreas,
          bodyShape,
          targetBodyFat,
          bellyType,
          idealWeightPeriod,
          role: selectedRole,
          injuries: selectedInjuries,
          fitnessLevel,
          workoutDifficulty: difficulty,
          activityPreferences: selectedPreferences,
          muscleHistory: selectedMuscleHistory,
          mindsetBlocker: mindsetAnswer,
          postGoalRewards: selectedRewards,
          guideCoach: selectedCoach,
          heightUnit,
          weightUnit,
          weightInput: weight,
          heightInput: height,
          targetWeightInput: targetWeight,
          birthYearInput: birthYear,
        },
      };

      syncPromiseRef.current = syncOnboardingToBackend(payload);
    }

    if (step === 'permissions') {
      try {
        cacheUserLocally({onboardingComplete: true});
        markOnboardingComplete().catch(() => undefined);
      } catch { /* non-critical */ }

      // Fire permissions and location detection in background — NEVER block entering the app
      requestAllPermissionsAsync().catch(e => {
        console.warn('[Onboarding] Background permission request error:', e);
      });
      detectAndSyncLocation().then(async loc => {
        try {
          await saveAndSyncWorkoutSchedule({
            timezone: loc.timezone,
            country: loc.country,
            region: loc.region,
            city: loc.city,
          });
        } catch { /* non-critical */ }
      }).catch(e => {
        console.warn('[Onboarding] Background location sync failed:', e);
      });

      onComplete();
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      transition(STEPS[nextIndex]);
    }
  }, [
    currentIndex,
    step,
    gender,
    selectedGoal,
    selectedMotivation,
    bodyShape,
    bellyType,
    idealWeightPeriod,
    selectedRole,
    fitnessLevel,
    difficulty,
    selectedCoach,
    selectedPreferences,
    selectedFocusAreas,
    targetBodyFat,
    birthYear,
    heightUnit,
    weightNum,
    heightNum,
    weightUnit,
    workoutFrequency,
    selectedInjuries,
    dailyActivity,
    selectedMuscleHistory,
    mindsetAnswer,
    selectedRewards,
    targetWeight,
    onComplete,
    height,
    weight,
    transition,
    validateStep,
  ]);

  const renderIntro = () => (
    <View style={styles.introWrap}>
      <View style={styles.logoWrap}>
        <Animated.View
          style={[styles.haloGlow, {opacity: glowOpacity, transform: [{scale: glowScale}]}]}
          pointerEvents="none"
        />
        <Animated.View style={[styles.logoOrb, {transform: [{scale: logoPulse}]}]}>
          <Image source={require('../assets/logo_master.png')} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
      </View>

      <Text style={styles.brandWordmark}>ATHLEO</Text>
      <Text style={styles.helloText}>Hello!</Text>
      <Text style={styles.introLead}>I’m your personal coach.</Text>
      <Text style={styles.introSubtitle}>
        I’ll ask a few quick questions to tailor your personalized plan around your body, goals, and daily routine.
      </Text>

      <View style={styles.coachIntroCard}>
        <View style={styles.coachIntroBadge}>
          {/* 3D Face Scan Hero Image replaces emoji */}
          <Image
            source={FACE_SCAN_IMG}
            style={styles.coachIntroImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.coachIntroCopy}>
          <Text style={styles.coachIntroBadgeText}>ATHLEO COACH</Text>
          <Text style={styles.coachIntroText}>
            Your plan will be built around your current body, lifestyle, and recovery needs.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderGender = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What’s your gender?"
        subtitle="This helps us tune intensity, recovery, and calorie targets."
      />
      <View style={styles.optionList}>
        {GENDERS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            icon={option.icon}
            selected={gender === option.id}
            onPress={() => setGender(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderGoal = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What’s your main goal?"
        subtitle="We’ll tailor a plan around what you want to change most."
      />
      <View style={styles.optionList}>
        {MAIN_GOALS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            icon={option.icon}
            iconColor={option.color}
            selected={selectedGoal === option.id}
            onPress={() => setSelectedGoal(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderMotivation = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What’s driving you?"
        subtitle="Pick the motivation that matters most right now."
      />
      <View style={styles.optionList}>
        {MOTIVATIONS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={selectedMotivation === option.id}
            onPress={() => setSelectedMotivation(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderBodyShape = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="How would you describe your body?"
        subtitle="Choose the shape that feels closest to you today."
      />
      <View style={styles.gridTwo}>
        {BODY_SHAPES.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            image={option.image}
            style={styles.gridItem}
            selected={bodyShape === option.id}
            onPress={() => setBodyShape(option.id)}
          />
        ))}
      </View>

      <View style={styles.fatSection}>
        <Text style={styles.fatLabel}>Target fat range</Text>
        <View style={styles.fatSliderWrap}>
          <Text style={styles.fatValue}>{targetBodyFat}%</Text>
          <View style={styles.fatTrack}>
            <View style={[styles.fatFill, {width: `${((targetBodyFat - 10) / 20) * 100}%`}]} />
            <View style={[styles.fatThumb, {left: `${((targetBodyFat - 10) / 20) * 100}%`}]} />
          </View>
          <View style={styles.fatScaleRow}>
            <Text style={styles.fatScaleText}>10%</Text>
            <Text style={styles.fatScaleText}>20%</Text>
            <Text style={styles.fatScaleText}>30%</Text>
          </View>
        </View>
        <View style={styles.sliderRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTargetBodyFat(v => Math.max(10, v - 1))}
            style={styles.sliderButton}>
            <Text style={styles.sliderButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTargetBodyFat(v => Math.min(30, v + 1))}
            style={styles.sliderButton}>
            <Text style={styles.sliderButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBirthYear = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What year were you born?"
        subtitle="Age helps us calibrate heart-rate zones and recovery."
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
        {Array.from({length: 60}, (_, i) => 1970 + i).map(year => (
          <TouchableOpacity
            key={year}
            activeOpacity={0.8}
            onPress={() => setBirthYear(String(year))}
            style={[styles.yearChip, birthYear === String(year) && styles.yearChipActive]}>
            <Text style={[styles.yearText, birthYear === String(year) && styles.yearTextActive]}>{year}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderMeasurements = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Tell us your measurements"
        subtitle="This helps us build smarter, safer progress targets."
      />

      <View style={styles.metricGroup}>
        <Text style={styles.metricLabel}>Height</Text>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setHeightUnit('cm')}
            style={[styles.segmentBtn, heightUnit === 'cm' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, heightUnit === 'cm' && styles.segmentTextActive]}>cm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setHeightUnit('ft')}
            style={[styles.segmentBtn, heightUnit === 'ft' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, heightUnit === 'ft' && styles.segmentTextActive]}>ft/in</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.counterCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setHeight(v => String(Math.max(120, Number.parseFloat(v || '176') - 1)))}>
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{height} {heightUnit}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setHeight(v => String(Math.min(230, Number.parseFloat(v || '176') + 1)))}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metricGroup}>
        <Text style={styles.metricLabel}>Current weight</Text>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setWeightUnit('kg')}
            style={[styles.segmentBtn, weightUnit === 'kg' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, weightUnit === 'kg' && styles.segmentTextActive]}>kg</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setWeightUnit('lb')}
            style={[styles.segmentBtn, weightUnit === 'lb' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, weightUnit === 'lb' && styles.segmentTextActive]}>lbs</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.counterCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setWeight(v => String(Math.max(30, Number.parseFloat(v || '74') - 1)))}>
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{weight} {weightUnit}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setWeight(v => String(Math.min(250, Number.parseFloat(v || '74') + 1)))}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metricGroup}>
        <Text style={styles.metricLabel}>Target weight</Text>
        <View style={styles.counterCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setTargetWeight(v => String(Math.max(30, Number.parseFloat(v || '68') - 1)))}>
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{targetWeight} kg</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.counterBtn}
            onPress={() => setTargetWeight(v => String(Math.min(250, Number.parseFloat(v || '68') + 1)))}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBellyType = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What does your belly look like?"
        subtitle="Body fat distribution helps us target the right workouts."
      />
      <View style={styles.optionList}>
        {BODY_TYPES.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={bellyType === option.id}
            onPress={() => setBellyType(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderIdealWeight = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="When were you last at your ideal weight?"
        subtitle="This helps us understand your body’s natural set point."
      />
      <View style={styles.optionList}>
        {IDEAL_WEIGHT_PERIODS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={idealWeightPeriod === option.id}
            onPress={() => setIdealWeightPeriod(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderFrequency = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="How often can you train?"
        subtitle="Pick a realistic weekly rhythm you can stick to."
      />
      <View style={styles.freqRow}>
        {[1, 2, 3, 4].map(v => (
          <TouchableOpacity
            key={v}
            activeOpacity={0.8}
            onPress={() => setWorkoutFrequency(v)}
            style={[styles.freqBtn, workoutFrequency === v && styles.freqBtnActive]}>
            <Text style={[styles.freqText, workoutFrequency === v && styles.freqTextActive]}>{v}x</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setWorkoutFrequency(5)}
          style={[styles.freqBtn, workoutFrequency === 5 && styles.freqBtnActive]}>
          <Text style={[styles.freqText, workoutFrequency === 5 && styles.freqTextActive]}>4+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRole = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What best describes your day?"
        subtitle="Your routine shapes when and how long you can train."
      />
      <View style={styles.gridTwo}>
        {ROLES.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            style={styles.gridItem}
            selected={selectedRole === option.id}
            onPress={() => setSelectedRole(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderInjuries = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Any recent injuries?"
        subtitle="Select all that apply — we’ll avoid movements that aggravate them."
      />
      <View style={styles.chipWrap}>
        {INJURY_OPTIONS.map(option => (
          <SelectableOption
            variant="pill"
            key={option}
            label={option}
            selected={selectedInjuries.includes(option)}
            onPress={() => toggleSelection(option, selectedInjuries, setSelectedInjuries)}
          />
        ))}
      </View>
    </View>
  );

  const renderLevel = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="How fit are you today?"
        subtitle="These answers shape your recovery and session intensity."
      />
      <View style={styles.optionList}>
        {FITNESS_LEVELS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={fitnessLevel === option.id}
            onPress={() => setFitnessLevel(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderDifficulty = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="How hard should it feel?"
        subtitle="We’ll ramp the intensity to match your preference."
      />
      <View style={styles.optionList}>
        {DIFFICULTY_LEVELS.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={difficulty === option.id}
            onPress={() => setDifficulty(option.id)}
          />
        ))}
      </View>

      <View style={styles.activityCard}>
        <View style={styles.activityHead}>
          <Text style={styles.activityLabel}>Daily activity</Text>
          <Text style={styles.activityValue}>{dailyActivity}%</Text>
        </View>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, {width: `${dailyActivity}%`}]} />
          <View style={[styles.sliderThumb, {left: `${dailyActivity}%`}]} />
        </View>
        <View style={styles.sliderRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.sliderButton}
            onPress={() => setDailyActivity(v => Math.max(0, v - 5))}>
            <Text style={styles.sliderButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.sliderButton}
            onPress={() => setDailyActivity(v => Math.min(100, v + 5))}>
            <Text style={styles.sliderButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFocus = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Where do you want to focus?"
        subtitle="Select every area you want to prioritise."
      />
      <View style={styles.gridTwo}>
        {FOCUS_AREAS.map(area => (
          <SelectableOption
            key={area.id}
            label={area.label}
            style={styles.gridItem}
            selected={selectedFocusAreas.includes(area.id)}
            onPress={() => toggleSelection(area.id, selectedFocusAreas, setSelectedFocusAreas)}
          />
        ))}
      </View>
    </View>
  );

  const renderPreferences = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What kind of workouts do you enjoy?"
        subtitle="Pick as many as you like — variety keeps you consistent."
      />
      <View style={styles.chipWrap}>
        {ACTIVITY_TAGS.map(tag => (
          <SelectableOption
            variant="pill"
            key={tag}
            label={tag}
            selected={selectedPreferences.includes(tag)}
            onPress={() => toggleSelection(tag, selectedPreferences, setSelectedPreferences)}
          />
        ))}
      </View>
    </View>
  );

  const renderMuscleHistory = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Tell us about your past progress"
        subtitle="Past experience helps us set an honest starting point."
      />
      <View style={styles.optionList}>
        {MUSCLE_HISTORY.map(option => (
          <SelectableOption
            key={option.id}
            label={option.label}
            selected={selectedMuscleHistory === option.id}
            onPress={() => setSelectedMuscleHistory(option.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderMindset = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Feeling in tune with the statement below?"
        subtitle="“I stay consistent even when motivation fades — I may need accountability.”"
      />
      <View style={styles.optionList}>
        <SelectableOption
          label="Yes, I need accountability"
          selected={mindsetAnswer === 'yes'}
          onPress={() => setMindsetAnswer('yes')}
        />
        <SelectableOption
          label="No, I feel confident"
          selected={mindsetAnswer === 'no'}
          onPress={() => setMindsetAnswer('no')}
        />
      </View>
    </View>
  );

  const renderRewards = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="What do you want to feel?"
        subtitle="Your rewards keep the plan motivating long-term."
      />
      <View style={styles.chipWrap}>
        {REWARDS.map(reward => (
          <SelectableOption
            variant="pill"
            key={reward}
            label={reward}
            selected={selectedRewards.includes(reward)}
            onPress={() => toggleSelection(reward, selectedRewards, setSelectedRewards)}
          />
        ))}
      </View>
    </View>
  );

  const renderCoach = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Pick your guide coach"
        subtitle="Your coach shapes the tone and focus of your plan."
      />
      <View style={styles.coachGrid}>
        {COACHES.map(option => {
          const active = selectedCoach === option.id;
          return (
            <PressableScale
              key={option.id}
              onPress={() => setSelectedCoach(option.id)}
              style={[styles.coachCard, active && styles.coachCardActive]}>
              <View style={[styles.coachAvatar, active && styles.coachAvatarActive]}>
                <Image source={option.image} style={styles.coachAvatarImg} resizeMode="cover" />
              </View>
              <Text style={[styles.coachName, active && styles.coachNameActive]}>{option.label}</Text>
              <Text style={styles.coachRole}>{option.role}</Text>
              {active ? <Icon name="checkmark-circle" size={18} color={ATHLEO_COLORS.accent} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  // Deliverable #4 — the calculation engine's output, rendered in the Black &
  // Lime language. The card owns the empty / loading / backend-vs-offline states.
  const renderPlan = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Your plan is ready."
        subtitle="Your daily targets, calculated from the body data and goals you just gave us."
      />
      <DynamicFeedbackCard bundle={adviceBundle} loading={adviceLoading || !adviceBundle} />
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.stepBlock}>
      <QuestionHeader
        title="Enable notifications and tracking"
        subtitle="This helps us remind you about workouts, recovery, and progress updates."
      />
      <View style={styles.permissionList}>
        {[
          {
            icon: 'notifications-outline',
            title: 'Push notifications',
            text: 'ATHLEO would like to send you reminders for training sessions and recovery.',
          },
          {
            icon: 'location-outline',
            title: 'Location',
            text: 'We use this to track outdoor activity and distance for more accurate progress data.',
          },
          {
            icon: 'fitness-outline',
            title: 'Health & body sensors',
            text: 'Connect your health data to calculate active calories and heart-rate zones.',
          },
        ].map(permission => (
          <View key={permission.title} style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Icon name={permission.icon} size={20} color={ATHLEO_COLORS.accent} />
            </View>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>{permission.title}</Text>
              <Text style={styles.permissionText}>{permission.text}</Text>
            </View>
            <Icon name="checkmark-circle-outline" size={20} color={ATHLEO_COLORS.accent} />
          </View>
        ))}
      </View>
      <Text style={styles.permissionNote}>You can change these anytime in your device settings.</Text>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return renderIntro();
      case 'gender':
        return renderGender();
      case 'goal':
        return renderGoal();
      case 'motivation':
        return renderMotivation();
      case 'bodyShape':
        return renderBodyShape();
      case 'birthYear':
        return renderBirthYear();
      case 'measurements':
        return renderMeasurements();
      case 'bellyType':
        return renderBellyType();
      case 'idealWeight':
        return renderIdealWeight();
      case 'frequency':
        return renderFrequency();
      case 'role':
        return renderRole();
      case 'injuries':
        return renderInjuries();
      case 'level':
        return renderLevel();
      case 'difficulty':
        return renderDifficulty();
      case 'focus':
        return renderFocus();
      case 'preferences':
        return renderPreferences();
      case 'muscleHistory':
        return renderMuscleHistory();
      case 'mindset':
        return renderMindset();
      case 'rewards':
        return renderRewards();
      case 'coach':
        return renderCoach();
      case 'plan':
        return renderPlan();
      case 'permissions':
        return renderPermissions();
      default:
        return renderIntro();
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          disabled={step === 'intro'}
          style={[styles.backBtn, step === 'intro' && styles.backBtnHidden]}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-back" size={20} color={ATHLEO_COLORS.text} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, {width: progressWidth}]} />
        </View>
        <Text style={styles.stepCount}>{currentIndex + 1}/{STEPS.length}</Text>
      </View>

      <Animated.View style={[styles.body, {opacity: fade, transform: [{translateY: slideY}]}]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {renderStep()}
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </ScrollView>
      </Animated.View>

      <View style={styles.footer}>
        <PrimaryButton
          label={
            step === 'permissions' ? 'Enter Athleo' : step === 'intro' ? 'Get started' : 'Continue'
          }
          onPress={handleNext}
          disabled={!canAdvance()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: ATHLEO_SPACING.lg,
    paddingTop: 18,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  backBtnHidden: {opacity: 0},
  // Thin progress line — lime fill tracking over the inactive border colour.
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: ATHLEO_COLORS.track,
  },
  progressFill: {height: '100%', borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent},
  stepCount: {color: ATHLEO_COLORS.muted, fontSize: 12, fontWeight: '700', minWidth: 38, textAlign: 'right'},

  body: {flex: 1},
  scrollContent: {paddingHorizontal: ATHLEO_SPACING.lg, paddingTop: 8, paddingBottom: 28},

  stepBlock: {gap: 16},
  questionHead: {marginBottom: 4},
  questionTitle: {
    color: ATHLEO_COLORS.text,
    fontSize: ATHLEO_TYPE.question,
    fontWeight: '800',
    lineHeight: ATHLEO_TYPE.questionLine,
    marginBottom: 8,
  },
  questionSubtitle: {
    color: ATHLEO_COLORS.muted,
    fontSize: ATHLEO_TYPE.subtitle,
    lineHeight: ATHLEO_TYPE.subtitleLine,
    marginBottom: 20,
  },

  optionList: {gap: 10},

  gridTwo: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  gridItem: {flexBasis: '47%', flexGrow: 1},

  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},

  fatSection: {gap: 10},
  fatLabel: {
    color: ATHLEO_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  fatSliderWrap: {
    backgroundColor: ATHLEO_COLORS.glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    padding: 16,
  },
  fatValue: {color: ATHLEO_COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 12},
  fatTrack: {
    position: 'relative',
    height: 6,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.track,
  },
  fatFill: {position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent},
  fatThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.text,
    ...ATHLEO_GLOW,
    transform: [{translateX: -7}],
  },
  fatScaleRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 8},
  fatScaleText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700'},

  sliderRow: {flexDirection: 'row', gap: 10},
  sliderButton: {
    flex: 1,
    height: 46,
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {color: ATHLEO_COLORS.text, fontSize: 20, fontWeight: '800'},
  sliderTrack: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.track,
  },
  sliderFill: {height: '100%', borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent},
  // White thumb with the lime glow, matching the body-fat slider.
  sliderThumb: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.text,
    ...ATHLEO_GLOW,
    transform: [{translateX: -7}],
  },

  yearRow: {paddingVertical: 6, gap: 8},
  yearChip: {
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  yearChipActive: {borderColor: ATHLEO_COLORS.accent, backgroundColor: 'rgba(184, 255, 77, 0.08)', ...ATHLEO_GLOW},
  yearText: {color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700'},
  yearTextActive: {color: ATHLEO_COLORS.text},

  metricGroup: {gap: 10},
  metricLabel: {
    color: ATHLEO_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  segmentRow: {flexDirection: 'row', gap: 8},
  segmentBtn: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentBtnActive: {borderColor: ATHLEO_COLORS.accent, backgroundColor: 'rgba(184, 255, 77, 0.08)', ...ATHLEO_GLOW},
  segmentText: {color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase'},
  segmentTextActive: {color: ATHLEO_COLORS.text},
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800'},
  counterValue: {color: ATHLEO_COLORS.text, fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center'},

  freqRow: {flexDirection: 'row', gap: 8},
  freqBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
  },
  freqBtnActive: {borderColor: ATHLEO_COLORS.accent, backgroundColor: 'rgba(184, 255, 77, 0.08)', ...ATHLEO_GLOW},
  freqText: {color: ATHLEO_COLORS.muted, fontSize: 15, fontWeight: '800'},
  freqTextActive: {color: ATHLEO_COLORS.text},

  activityCard: {
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  activityHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  activityLabel: {
    color: ATHLEO_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  activityValue: {color: ATHLEO_COLORS.text, fontSize: 20, fontWeight: '800'},

  coachGrid: {flexDirection: 'row', gap: 10},
  coachCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  coachCardActive: {borderColor: ATHLEO_COLORS.accent, backgroundColor: 'rgba(184, 255, 77, 0.08)', ...ATHLEO_GLOW},
  coachAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coachAvatarActive: {
    borderColor: ATHLEO_COLORS.accent,
    borderWidth: 2.5,
  },
  coachAvatarImg: {
    width: '100%',
    height: '100%',
  },
  coachName: {color: ATHLEO_COLORS.text, fontSize: 15, fontWeight: '800', textAlign: 'center'},
  coachNameActive: {color: ATHLEO_COLORS.text},
  coachRole: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15},

  permissionList: {gap: 10},
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 18,
    padding: 16,
  },
  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ATHLEO_COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCopy: {flex: 1},
  permissionTitle: {color: ATHLEO_COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 4},
  permissionText: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18},
  permissionNote: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center'},

  formError: {color: '#FF9E9E', fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4},

  footer: {
    paddingHorizontal: ATHLEO_SPACING.lg,
    paddingTop: 12,
    paddingBottom: ATHLEO_SPACING.xxl,
  },

  introWrap: {alignItems: 'center', paddingTop: 12, gap: 10},
  logoWrap: {alignItems: 'center', justifyContent: 'center'},
  haloGlow: {
    position: 'absolute',
    top: -25,
    left: -25,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: ATHLEO_COLORS.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.25)',
  },
  logoOrb: {
    width: 150,
    height: 150,
    borderRadius: 38,
    backgroundColor: ATHLEO_COLORS.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...ATHLEO_GLOW,
    shadowRadius: 28,
  },
  logoImage: {width: 120, height: 120},
  brandWordmark: {
    color: ATHLEO_COLORS.accent,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 12,
  },
  helloText: {color: ATHLEO_COLORS.text, fontSize: 36, fontWeight: '800', textAlign: 'center'},
  introLead: {color: ATHLEO_COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center'},
  introSubtitle: {color: ATHLEO_COLORS.muted, fontSize: 14, lineHeight: 22, textAlign: 'center'},

  coachIntroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    backgroundColor: ATHLEO_COLORS.glass,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
  },
  coachIntroBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: ATHLEO_COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.4)',
  },
  coachIntroImage: {
    width: '100%',
    height: '100%',
  },
  coachIntroEmoji: {fontSize: 26},
  coachIntroCopy: {flex: 1},
  coachIntroBadgeText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  coachIntroText: {color: ATHLEO_COLORS.muted, fontSize: 12, lineHeight: 18},
});
