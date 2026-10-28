/**
 * EditProfileScreen.tsx — the missing "edit my answers" door.
 *
 * Onboarding collects the whole athlete profile exactly once and, until now,
 * there was no way to correct a single answer afterwards. This screen re-opens
 * the same questions the onboarding flow asks (goal, body shape, fitness level,
 * measurements, training frequency, focus areas, injuries) using the same
 * design-system controls, and writes the result back through the *same* two
 * channels onboarding uses:
 *
 *   1. `setUserProfile()`         — local MMKV store, so every screen that
 *                                   reads the profile sees the edit instantly.
 *   2. `syncOnboardingToBackend()` — Supabase, so the SQL layer that derives
 *                                   calorie/step targets and coaching advice
 *                                   re-derives them from the corrected data.
 *
 * Nothing here is a new source of truth: the screen is a form over the existing
 * profile, and the button simply re-submits it.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePicker from 'react-native-image-crop-picker';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {PrimaryButton} from '../components/PrimaryButton';
import {SelectableOption} from '../components/SelectableOption';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {type TabKey} from '../navigation/AppNavigator';
import {triggerHaptic} from '../services/haptics';
import {getSupabaseClient} from '../services/auth';
import {uploadAvatar} from '../services/storageService';
import {
  cacheUserLocally,
  getCachedDisplayName,
  syncOnboardingToBackend,
  type OnboardingAnswersPayload,
} from '../services/profileSync';
import {
  getUserProfile,
  setUserProfile,
  updateAvatarInSupabase,
  type UserProfile,
} from '../services/userProfile';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';

interface EditProfileScreenProps {
  navigate?: (tab: TabKey) => void;
}


// Same option sets onboarding asks with — an edit must be able to express every
// answer the first-run flow could, otherwise the form would silently narrow the
// user's choices.
const GENDERS: {id: NonNullable<UserProfile['gender']>; label: string}[] = [
  {id: 'male', label: 'Male'},
  {id: 'female', label: 'Female'},
  {id: 'other', label: 'Other'},
];

const GOALS: {id: NonNullable<UserProfile['goal']>; label: string; icon: string; color: string}[] = [
  {id: 'fat', label: 'Lose Weight', icon: 'flame-outline', color: '#FFB020'},
  {id: 'muscle', label: 'Build Muscle', icon: 'barbell-outline', color: '#FF6B35'},
  {id: 'wellness', label: 'Keep Fit', icon: 'heart-outline', color: '#6AE28D'},
];

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

const FITNESS_LEVELS: {id: NonNullable<UserProfile['fitnessLevel']>; label: string}[] = [
  {id: 'beginner', label: 'Beginner'},
  {id: 'intermediate', label: 'Intermediate'},
  {id: 'advanced', label: 'Advanced'},
];

const ACTIVITY_LEVELS: {id: NonNullable<UserProfile['activityLevel']>; label: string}[] = [
  {id: 'sedentary', label: 'Sedentary'},
  {id: 'light', label: 'Light'},
  {id: 'moderate', label: 'Moderate'},
  {id: 'active', label: 'Active'},
  {id: 'athlete', label: 'Athlete'},
];

const FOCUS_AREAS = ['Arm', 'Shoulder', 'Chest', 'Abs', 'Leg', 'Full Body'];
const INJURY_OPTIONS = ['None', 'Shoulder', 'Wrist', 'Knee', 'Ankle', 'Lower Back'];

const BIRTH_YEARS = Array.from({length: 66}, (_, i) => 1940 + i); // 1940 → 2005

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));

/** − / + stepper used by every numeric answer on this screen. */
function CounterRow({
  value,
  unit,
  onChange,
  min,
  max,
}: {
  value: number;
  unit: string;
  onChange: (next: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.counterCard}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.counterBtn}
        onPress={() => {
          triggerHaptic('selection');
          onChange(clamp(value - 1, min, max));
        }}>
        <Text style={styles.counterBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.counterValue}>{value} {unit}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.counterBtn}
        onPress={() => {
          triggerHaptic('selection');
          onChange(clamp(value + 1, min, max));
        }}>
        <Text style={styles.counterBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EditProfileScreen({navigate}: EditProfileScreenProps) {
  // Snapshot the profile once — this is the form's initial value, and the
  // baseline that any field the user does NOT touch keeps.
  const initial = useMemo(() => getUserProfile(), []);

  const [name, setName] = useState(getCachedDisplayName());
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = useCallback(async () => {
    try {
      triggerHaptic('selection');
      const image = await ImagePicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        cropperCircleOverlay: true,
        compressImageQuality: 0.8,
        mediaType: 'photo',
        loadingLabelText: 'Processing...',
        includeBase64: true,
      });

      // 2MB Size Limit Check
      const MAX_SIZE = 2 * 1024 * 1024; // 2MB
      if (image.size > MAX_SIZE) {
        Alert.alert('File too large', 'Please select an image smaller than 2MB.');
        return;
      }

      setIsUploading(true);
      const supabase = getSupabaseClient();

      // Resilient auth check: try session first (fast) then user (secure/network)
      const {data: {session}} = await supabase.auth.getSession();
      let user = session?.user ?? null;

      if (!user) {
        const {data: {user: freshUser}} = await supabase.auth.getUser();
        user = freshUser;
      }

      if (!user) {
        Alert.alert('Error', 'User not authenticated. Please sign in again.');
        setIsUploading(false);
        return;
      }

      const mimeType = image.mime || 'image/jpeg';
      const fileExt = mimeType.includes('/') ? mimeType.split('/')[1] : 'jpg';

      const publicUrl = await uploadAvatar(
        user.id,
        image.data || image.path,
        `avatar.${fileExt}`,
        mimeType
      );

      if (!publicUrl) {
        throw new Error('Upload succeeded but no public URL was returned.');
      }

      setAvatarUrl(publicUrl);
      
      try {
        await updateAvatarInSupabase(publicUrl);
        cacheUserLocally({avatarUrl: publicUrl});
      } catch (updateErr: any) {
        console.warn('Avatar uploaded but profile update failed:', updateErr);
        // We don't alert here because the avatar is already uploaded and shown
      }
      
      triggerHaptic('notificationSuccess');
    } catch (err: any) {
      if (err.code !== 'E_PICKER_CANCELLED') {
        console.error('Image upload failed:', err.message || err);
        Alert.alert('Error', `Failed to upload image: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setIsUploading(false);
    }
  }, []);

  const [gender, setGender] = useState<NonNullable<UserProfile['gender']>>(initial.gender ?? 'male');
  const [goal, setGoal] = useState<NonNullable<UserProfile['goal']>>(initial.goal ?? 'wellness');
  const [bodyShape, setBodyShape] = useState(initial.bodyShape ?? 'medium');
  const [fitnessLevel, setFitnessLevel] = useState<NonNullable<UserProfile['fitnessLevel']>>(
    initial.fitnessLevel ?? 'beginner',
  );
  const [activityLevel, setActivityLevel] = useState<NonNullable<UserProfile['activityLevel']>>(
    initial.activityLevel ?? 'moderate',
  );
  const [heightCm, setHeightCm] = useState(clamp(initial.heightCm || 176, 120, 230));
  const [weightKg, setWeightKg] = useState(clamp(initial.weightKg || 72, 30, 250));
  const [targetWeightKg, setTargetWeightKg] = useState(
    clamp(initial.targetWeightKg ?? initial.weightKg ?? 72, 30, 250),
  );
  const [birthYear, setBirthYear] = useState<number>(
    initial.birthYear && initial.birthYear > 1900 ? initial.birthYear : 1997,
  );
  const [workoutFrequency, setWorkoutFrequency] = useState(
    clamp(initial.workoutFrequency ?? 3, 1, 7),
  );
  const [focusAreas, setFocusAreas] = useState<string[]>(initial.focusAreas ?? []);
  const [injuries, setInjuries] = useState<string[]>(initial.injuries ?? []);

  const toggle = useCallback((value: string, list: string[], setList: (next: string[]) => void) => {
    triggerHaptic('selection');
    setList(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  }, []);

  const handleSave = useCallback(() => {
    const next: Partial<UserProfile> = {
      weightKg,
      heightCm,
      targetWeightKg,
      goal,
      activityLevel,
      // Onboarding stores the visual body-shape id straight onto `bodyType`;
      // the edit keeps that mapping identical so the two paths stay in sync.
      bodyType: bodyShape as UserProfile['bodyType'],
      bodyShape,
      fitnessLevel,
      experience: fitnessLevel as UserProfile['experience'],
      gender,
      birthYear,
      workoutFrequency,
      focusAreas,
      injuries,
      heightUnit: 'cm',
    };

    setUserProfile(next);
    if (name.trim()) {
      cacheUserLocally({displayName: name.trim()});
    }

    // Merge the untouched answers back in, so re-syncing the profile never
    // blanks out an answer the user did not edit.
    const answers: Record<string, any> = {...getUserProfile()};

    const payload: OnboardingAnswersPayload = {
      displayName: name.trim() || null,
      sex: gender,
      heightCm,
      weightKg,
      targetWeightKg,
      birthYear,
      goal,
      activityLevel,
      fitnessLevel,
      workoutFrequency,
      dailyActivity: initial.dailyActivity ?? null,
      answers,
    };

    // Fire-and-forget: the UI must never block on the network.
    syncOnboardingToBackend(payload).catch(() => undefined);
    triggerHaptic('notificationSuccess');
    navigate?.('profile');
  }, [
    name,
    gender,
    goal,
    bodyShape,
    fitnessLevel,
    activityLevel,
    heightCm,
    weightKg,
    targetWeightKg,
    birthYear,
    workoutFrequency,
    focusAreas,
    injuries,
    initial.dailyActivity,
    navigate,
  ]);

  const bmi = heightCm > 0 ? weightKg / Math.pow(heightCm / 100, 2) : 0;

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Athlete Profile</Text>
        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.subtitle}>
          Update your details — your plan, targets and coaching adjust to match.
        </Text>
      </View>

      {/* Avatar Upload */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickImage}
          disabled={isUploading}
        >
          {avatarUrl ? (
            <Image source={{uri: avatarUrl}} style={styles.avatarImage} />
          ) : (
            <Image source={require('../assets/images/coach_leo.jpg')} style={styles.avatarImage} />
          )}
          <View style={styles.editIconBadge}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Icon name="camera" size={16} color="#000" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change profile picture</Text>
      </View>

      {/* Identity */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Your Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Athlete"
          placeholderTextColor={ATHLEO_COLORS.muted}
          style={styles.textInput}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Gender</Text>
        <View style={styles.wrapRow}>
          {GENDERS.map(option => (
            <SelectableOption
              key={option.id}
              variant="pill"
              label={option.label}
              selected={gender === option.id}
              onPress={() => {
                triggerHaptic('selection');
                setGender(option.id);
              }}
            />
          ))}
        </View>
      </AppCard>

      {/* Goal */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Primary Goal</Text>
        <View style={styles.stack}>
          {GOALS.map(option => (
            <SelectableOption
              key={option.id}
              label={option.label}
              icon={option.icon}
              iconColor={option.color}
              selected={goal === option.id}
              onPress={() => {
                triggerHaptic('selection');
                setGoal(option.id);
              }}
            />
          ))}
        </View>
      </AppCard>

      {/* Body shape */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Body Shape</Text>
        <View style={styles.shapeGrid}>
          {BODY_SHAPES.map(option => (
            <SelectableOption
              key={option.id}
              label={option.label}
              image={option.image}
              selected={bodyShape === option.id}
              onPress={() => {
                triggerHaptic('selection');
                setBodyShape(option.id);
              }}
              style={styles.shapeCard}
            />
          ))}
        </View>
      </AppCard>

      {/* Measurements */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Measurements</Text>

        <Text style={styles.fieldLabel}>Height</Text>
        <CounterRow value={heightCm} unit="cm" onChange={setHeightCm} min={120} max={230} />

        <Text style={styles.fieldLabel}>Current Weight</Text>
        <CounterRow value={weightKg} unit="kg" onChange={setWeightKg} min={30} max={250} />

        <Text style={styles.fieldLabel}>Target Weight</Text>
        <CounterRow value={targetWeightKg} unit="kg" onChange={setTargetWeightKg} min={30} max={250} />

        <View style={styles.bmiPill}>
          <Icon name="analytics-outline" size={14} color={ATHLEO_COLORS.accent} />
          <Text style={styles.bmiText}>BMI {bmi.toFixed(1)}</Text>
        </View>

        <Text style={styles.fieldLabel}>Birth Year</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
          {BIRTH_YEARS.map(year => (
            <TouchableOpacity
              key={year}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('selection');
                setBirthYear(year);
              }}
              style={[styles.yearChip, birthYear === year && styles.yearChipActive]}>
              <Text style={[styles.yearText, birthYear === year && styles.yearTextActive]}>{year}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </AppCard>

      {/* Training */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Training</Text>

        <Text style={styles.fieldLabel}>Fitness Level</Text>
        <View style={styles.wrapRow}>
          {FITNESS_LEVELS.map(option => (
            <SelectableOption
              key={option.id}
              variant="pill"
              label={option.label}
              selected={fitnessLevel === option.id}
              onPress={() => {
                triggerHaptic('selection');
                setFitnessLevel(option.id);
              }}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Daily Activity</Text>
        <View style={styles.wrapRow}>
          {ACTIVITY_LEVELS.map(option => (
            <SelectableOption
              key={option.id}
              variant="pill"
              label={option.label}
              selected={activityLevel === option.id}
              onPress={() => {
                triggerHaptic('selection');
                setActivityLevel(option.id);
              }}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Workout Days / Week</Text>
        <CounterRow
          value={workoutFrequency}
          unit="days"
          onChange={setWorkoutFrequency}
          min={1}
          max={7}
        />
      </AppCard>

      {/* Focus areas */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Focus Areas</Text>
        <View style={styles.wrapRow}>
          {FOCUS_AREAS.map(area => (
            <SelectableOption
              key={area}
              variant="pill"
              label={area}
              selected={focusAreas.includes(area)}
              onPress={() => toggle(area, focusAreas, setFocusAreas)}
            />
          ))}
        </View>
      </AppCard>

      {/* Injuries */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Injuries</Text>
        <Text style={styles.hint}>Select any joint that needs protecting — or none.</Text>
        <View style={styles.wrapRow}>
          {INJURY_OPTIONS.map(injury => (
            <SelectableOption
              key={injury}
              variant="pill"
              label={injury}
              selected={injuries.includes(injury)}
              onPress={() => toggle(injury, injuries, setInjuries)}
            />
          ))}
        </View>
      </AppCard>

      <PrimaryButton label="Save Changes" onPress={handleSave} />
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING, gap: ATHLEO_SPACING.md},
  eyebrow: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6},
  title: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800'},
  subtitle: {color: ATHLEO_COLORS.muted, fontSize: 13, marginTop: 8, lineHeight: 19},
  avatarSection: {alignItems: 'center', marginVertical: 10},
  avatarContainer: {width: 100, height: 100, position: 'relative'},
  avatarImage: {width: 100, height: 100, borderRadius: 35, borderWidth: 3, borderColor: ATHLEO_COLORS.accent},
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 35,
    backgroundColor: 'rgba(184,255,77,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(184,255,77,0.3)',
    borderStyle: 'dashed',
  },
  avatarInitial: {color: ATHLEO_COLORS.accent, fontSize: 36, fontWeight: '800'},
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: ATHLEO_COLORS.accent,
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: ATHLEO_COLORS.background,
  },
  avatarHint: {color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 10, fontWeight: '600'},
  sectionCard: {padding: ATHLEO_SPACING.md, borderRadius: 18, gap: 10},
  sectionTitle: {color: ATHLEO_COLORS.text, fontSize: 16, fontWeight: '800'},
  sectionTitleSpaced: {marginTop: 14},
  hint: {color: ATHLEO_COLORS.muted, fontSize: 12},
  fieldLabel: {
    color: ATHLEO_COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  textInput: {
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: ATHLEO_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  wrapRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  stack: {gap: 8},
  shapeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  // Two per row — 8px gap between them, so each card takes (100% − 8px) / 2.
  shapeCard: {width: '48.5%'},
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  counterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ATHLEO_COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {color: ATHLEO_COLORS.text, fontSize: 24, fontWeight: '800', lineHeight: 26},
  counterValue: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800'},
  bmiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.25)',
  },
  bmiText: {color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '800'},
  yearRow: {gap: 8, paddingVertical: 2},
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.border,
  },
  yearChipActive: {backgroundColor: 'transparent', borderColor: ATHLEO_COLORS.accent},
  yearText: {color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700'},
  yearTextActive: {color: ATHLEO_COLORS.text},
});
