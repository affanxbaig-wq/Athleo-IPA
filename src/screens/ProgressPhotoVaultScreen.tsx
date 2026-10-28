import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Icon from 'react-native-vector-icons/Ionicons';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {
  type PhotoAngle,
  type ProgressPhoto,
  addProgressPhoto,
  deleteProgressPhoto,
  getAllCheckIns,
  getAllProgressPhotos,
  getComparisonPair,
  getVaultStats,
} from '../services/progressPhotoService';
import {getUserProfile} from '../services/userProfile';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANGLE_TABS: {key: PhotoAngle; label: string}[] = [
  {key: 'front', label: 'Front Relaxed'},
  {key: 'side', label: 'Side Profile'},
  {key: 'back', label: 'Back Lat Spread'},
];

// Placeholder URIs shown when the vault is empty (Unsplash, gym/fitness theme)
const PLACEHOLDER_URIS: Record<PhotoAngle, {before: string; after: string}> = {
  front: {
    before: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    after: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=80',
  },
  side: {
    before: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
    after: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80',
  },
  back: {
    before: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80',
    after: 'https://images.unsplash.com/photo-1541534401786-2077eed87a74?auto=format&fit=crop&w=900&q=80',
  },
  custom: {
    before: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    after: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=80',
  },
};

// ─── Add-Photo Modal ──────────────────────────────────────────────────────────

interface AddPhotoModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (uri: string, angle: PhotoAngle, weightKg: number) => void;
  currentWeightKg: number;
}

function AddPhotoModal({visible, onClose, onAdd, currentWeightKg}: AddPhotoModalProps) {
  const [angle, setAngle] = useState<PhotoAngle>('front');
  const [weightInput, setWeightInput] = useState(String(currentWeightKg));
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleLaunchCamera = async () => {
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        saveToPhotos: true,
        quality: 0.9,
      });
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert('Camera Notice', response.errorMessage || 'Could not open camera.', [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Use Demo Photo',
            onPress: () => finishAdd(PLACEHOLDER_URIS[angle].after),
          },
        ]);
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (uri) {
        finishAdd(uri);
      }
    } catch {
      Alert.alert('Camera Notice', 'Native camera is unavailable on this device/emulator.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Use Demo Photo',
          onPress: () => finishAdd(PLACEHOLDER_URIS[angle].after),
        },
      ]);
    }
  };

  const handlePickLibrary = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        selectionLimit: 1,
      });
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert('Library Notice', response.errorMessage || 'Could not open photo library.', [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Use Demo Photo',
            onPress: () => finishAdd(PLACEHOLDER_URIS[angle].after),
          },
        ]);
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (uri) {
        finishAdd(uri);
      }
    } catch {
      Alert.alert('Library Notice', 'Photo library is unavailable on this device.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Use Demo Photo',
          onPress: () => finishAdd(PLACEHOLDER_URIS[angle].after),
        },
      ]);
    }
  };

  const finishAdd = (uri: string) => {
    const weight = parseFloat(weightInput);
    const validWeight = Number.isFinite(weight) && weight > 0 ? weight : currentWeightKg;
    onAdd(uri, angle, validWeight);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, {transform: [{translateY: slideAnim}]}]}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>Log Progress Check-In</Text>
          <Text style={styles.sheetSub}>Select angle and capture a photo to track your transformation.</Text>

          {/* Angle Picker */}
          <Text style={styles.sheetLabel}>ANGLE</Text>
          <View style={styles.anglePicker}>
            {ANGLE_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.angleChip, angle === tab.key && styles.angleChipActive]}
                onPress={() => setAngle(tab.key)}>
                <Text style={[styles.angleChipText, angle === tab.key && styles.angleChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weight Input */}
          <Text style={styles.sheetLabel}>CURRENT WEIGHT (kg)</Text>
          <View style={styles.weightInputWrap}>
            <Icon name="barbell-outline" size={18} color={ATHLEO_COLORS.accent} />
            <TextInput
              style={styles.weightInput}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholderTextColor={ATHLEO_COLORS.muted}
              placeholder="e.g. 74.5"
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.cameraBtn} onPress={handleLaunchCamera}>
            <Icon name="camera" size={20} color="#071F12" />
            <Text style={styles.cameraBtnText}>TAKE PHOTO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.libraryBtn} onPress={handlePickLibrary}>
            <Icon name="image-outline" size={20} color={ATHLEO_COLORS.accent} />
            <Text style={styles.libraryBtnText}>CHOOSE FROM LIBRARY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ProgressPhotoVaultScreen() {
  const [selectedAngle, setSelectedAngle] = useState<PhotoAngle>('front');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const profile = getUserProfile();
  const currentWeight = profile.weightKg || 74.5;

  const refresh = useCallback(() => {
    const all = getAllProgressPhotos();
    setPhotos(all);
    // Auto-select the latest photo for the current angle
    const forAngle = all.filter(p => p.angle === selectedAngle);
    if (forAngle.length > 0) {
      setSelectedPhoto(forAngle[forAngle.length - 1]);
    } else {
      setSelectedPhoto(null);
    }
  }, [selectedAngle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = getVaultStats();
  const checkIns = getAllCheckIns();
  const comparisonPair = getComparisonPair(selectedAngle);

  // Determine what to show in the comparison viewer
  const beforePhoto = comparisonPair
    ? comparisonPair[0]
    : {uri: PLACEHOLDER_URIS[selectedAngle].before, label: 'Baseline'};
  const afterPhoto = comparisonPair
    ? comparisonPair[1]
    : selectedPhoto ?? {uri: PLACEHOLDER_URIS[selectedAngle].after, label: 'Current'};

  const photosForAngle = photos.filter(p => p.angle === selectedAngle);

  const handleAddPhoto = (uri: string, angle: PhotoAngle, weightKg: number) => {
    addProgressPhoto({uri, angle, weightKg});
    refresh();
  };

  const handleLongPressPhoto = (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Remove this photo from the vault?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProgressPhoto(photoId);
            refresh();
          },
        },
      ],
    );
  };

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Vault Header ── */}
      <AppCard style={styles.vaultHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.lockIcon}>
            <Text style={styles.lockText}>🔒</Text>
          </View>
          <View>
            <Text style={styles.title}>Encrypted Vault</Text>
            <Text style={styles.meta}>FaceID guard · hardware encrypted</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.securePill}
          onPress={() => setShowAddModal(true)}>
          <Icon name="add" size={14} color={ATHLEO_COLORS.accent} />
          <Text style={styles.secureText}>Add Photo</Text>
        </TouchableOpacity>
      </AppCard>

      {/* ── Vault Stats Bar ── */}
      {stats.totalCheckIns > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalCheckIns}</Text>
            <Text style={styles.statLabel}>CHECK-INS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalPhotos}</Text>
            <Text style={styles.statLabel}>PHOTOS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              stats.weightDeltaKg !== null && stats.weightDeltaKg < 0 && styles.statValueGreen,
            ]}>
              {stats.weightDeltaKg !== null
                ? `${stats.weightDeltaKg > 0 ? '+' : ''}${stats.weightDeltaKg} kg`
                : '—'}
            </Text>
            <Text style={styles.statLabel}>WEIGHT DELTA</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.daysSinceStart}d</Text>
            <Text style={styles.statLabel}>JOURNEY</Text>
          </View>
        </View>
      )}

      {/* ── Angle Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}>
        {ANGLE_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, selectedAngle === tab.key && styles.tabButtonActive]}
            onPress={() => setSelectedAngle(tab.key)}>
            <Text style={[styles.tabText, selectedAngle === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Before/After Comparison Card ── */}
      <View style={styles.compareCard}>
        {/* AFTER (Current) — full bleed */}
        <Image
          style={styles.compareImage}
          source={{uri: (afterPhoto as ProgressPhoto).uri ?? afterPhoto.uri}}
          resizeMode="cover"
        />
        {/* BEFORE — left half clipped */}
        <View style={styles.compareImageWrapBefore}>
          <Image
            style={styles.compareImage}
            source={{uri: (beforePhoto as ProgressPhoto).uri ?? beforePhoto.uri}}
            resizeMode="cover"
          />
        </View>
        {/* Divider handle */}
        <View style={styles.sliderHandle}>
          <Text style={styles.sliderText}>⟺</Text>
        </View>
        {/* Badges */}
        <Text style={styles.badgeCurrent}>
          {comparisonPair ? comparisonPair[1].label : 'Current'}
        </Text>
        <Text style={styles.badgeBefore}>
          {comparisonPair ? comparisonPair[0].label : 'Baseline'}
        </Text>

        {/* Empty vault CTA overlay */}
        {photos.length === 0 && (
          <TouchableOpacity style={styles.emptyOverlay} onPress={() => setShowAddModal(true)}>
            <Icon name="camera-outline" size={36} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emptyOverlayText}>Tap to log your first check-in</Text>
            <Text style={styles.emptyOverlaySub}>Showing example photos</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Measurement Deltas (when vault has data) ── */}
      {checkIns.length > 0 && (
        <View style={styles.deltaGrid}>
          <AppCard style={styles.deltaCard}>
            <Text style={styles.deltaLabel}>Total mass evolution</Text>
            <Text style={styles.deltaValue}>
              {stats.weightDeltaKg !== null
                ? `${stats.weightDeltaKg > 0 ? '+' : ''}${stats.weightDeltaKg}`
                : '—'}
              <Text style={styles.deltaUnit}>kg</Text>
            </Text>
            <Text style={styles.deltaMeta}>
              {stats.weightDeltaKg !== null && stats.weightDeltaKg < 0
                ? 'Net fat tissue deficit'
                : 'Body mass delta'}
            </Text>
          </AppCard>
          <AppCard style={styles.deltaCard}>
            <Text style={styles.deltaLabel}>Check-in streak</Text>
            <Text style={styles.deltaValueAccent}>
              {checkIns.length}
              <Text style={styles.deltaUnit}> logs</Text>
            </Text>
            <Text style={styles.deltaMeta}>{stats.daysSinceStart} days of tracking</Text>
          </AppCard>
        </View>
      )}

      {/* ── Progression Timeline ── */}
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitle}>
          {photosForAngle.length > 0 ? 'Progression Timeline' : 'Start Tracking'}
        </Text>
        <Text style={styles.timelineMeta}>
          {photosForAngle.length > 0
            ? `${photosForAngle.length} photo${photosForAngle.length === 1 ? '' : 's'}`
            : 'No photos yet'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineRow}>
        {/* Add new photo card */}
        <TouchableOpacity style={styles.addCard} onPress={() => setShowAddModal(true)}>
          <Icon name="add-circle-outline" size={28} color={ATHLEO_COLORS.accent} />
          <Text style={styles.addCardText}>New</Text>
        </TouchableOpacity>

        {/* Existing photos */}
        {[...photosForAngle].reverse().map(photo => (
          <TouchableOpacity
            key={photo.id}
            style={[
              styles.photoCard,
              selectedPhoto?.id === photo.id && styles.photoCardActive,
            ]}
            onPress={() => setSelectedPhoto(photo)}
            onLongPress={() => handleLongPressPhoto(photo.id)}
            delayLongPress={500}>
            <Image
              style={styles.photoThumb}
              source={{uri: photo.uri}}
              resizeMode="cover"
            />
            <Text style={[styles.photoLabel, selectedPhoto?.id === photo.id && styles.photoLabelActive]}>
              {photo.label}
            </Text>
            <Text style={styles.photoWeight}>{photo.weightKg} kg</Text>
          </TouchableOpacity>
        ))}

        {photosForAngle.length === 0 && (
          <View style={styles.emptyTimelineCard}>
            <Icon name="body-outline" size={22} color={ATHLEO_COLORS.muted} />
            <Text style={styles.emptyTimelineText}>No {selectedAngle} photos yet</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Add Photo Modal ── */}
      <AddPhotoModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddPhoto}
        currentWeightKg={currentWeight}
      />


    </SmoothScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 110, gap: ATHLEO_SPACING.md},

  // Header
  vaultHeader: {padding: 16, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  lockIcon: {width: 40, height: 40, borderRadius: 12, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  lockText: {fontSize: 18},
  title: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
  meta: {color: '#E2FCE8', fontSize: 13, marginTop: 4, fontWeight: '700'},
  securePill: {backgroundColor: '#0F3820', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)', flexDirection: 'row', alignItems: 'center', gap: 6},
  secureText: {color: ATHLEO_COLORS.accent, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},

  // Stats Row
  statsRow: {flexDirection: 'row', backgroundColor: '#0D331D', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)', paddingVertical: 14, paddingHorizontal: 8},
  statItem: {flex: 1, alignItems: 'center'},
  statValue: {color: '#FFFFFF', fontSize: 18, fontWeight: '900'},
  statValueGreen: {color: ATHLEO_COLORS.accent},
  statLabel: {color: '#E2FCE8', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2},
  statDivider: {width: 1, backgroundColor: 'rgba(184, 255, 77, 0.2)'},

  // Tabs
  tabs: {flexDirection: 'row', gap: 8, paddingRight: 4},
  tabButton: {backgroundColor: '#0F3820', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  tabButtonActive: {backgroundColor: ATHLEO_COLORS.accent, borderColor: ATHLEO_COLORS.accent},
  tabText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  tabTextActive: {color: '#071F12', fontWeight: '900'},

  // Compare Card
  compareCard: {height: 360, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0D331D', position: 'relative', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  compareImage: {width: '100%', height: '100%', opacity: 0.85},
  compareImageWrapBefore: {position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', overflow: 'hidden'},
  badgeCurrent: {position: 'absolute', top: 14, right: 12, backgroundColor: 'rgba(13,51,29,0.92)', color: ATHLEO_COLORS.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900', borderWidth: 1, borderColor: ATHLEO_COLORS.accent},
  badgeBefore: {position: 'absolute', top: 14, left: 12, backgroundColor: 'rgba(13,51,29,0.92)', color: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900', borderWidth: 1, borderColor: 'rgba(184, 255, 77, 0.4)'},
  sliderHandle: {position: 'absolute', left: '50%', top: 0, bottom: 0, width: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -17},
  sliderText: {fontSize: 16, color: ATHLEO_COLORS.accent, backgroundColor: '#0F3820', borderRadius: 999, width: 32, height: 32, textAlign: 'center', lineHeight: 32, borderWidth: 1.5, borderColor: ATHLEO_COLORS.accent},
  emptyOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,31,18,0.72)', alignItems: 'center', justifyContent: 'center', gap: 10},
  emptyOverlayText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center'},
  emptyOverlaySub: {color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700'},

  // Delta Grid
  deltaGrid: {flexDirection: 'row', gap: 8},
  deltaCard: {flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  deltaLabel: {color: '#E2FCE8', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  deltaValue: {color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 8},
  deltaValueAccent: {color: ATHLEO_COLORS.accent, fontSize: 30, fontWeight: '900', marginTop: 8},
  deltaUnit: {fontSize: 14, color: '#E2FCE8', fontWeight: '700'},
  deltaMeta: {color: ATHLEO_COLORS.accent, fontSize: 12, marginTop: 6, fontWeight: '800'},

  // Timeline
  timelineHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  timelineTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
  timelineMeta: {color: '#E2FCE8', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  timelineRow: {flexDirection: 'row', gap: 8, paddingRight: 4},
  addCard: {width: 88, backgroundColor: '#0F3820', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: ATHLEO_COLORS.accent, borderStyle: 'dashed', gap: 6, minHeight: 130},
  addCardText: {color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.8},
  photoCard: {width: 96, backgroundColor: '#0F3820', borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  photoCardActive: {borderWidth: 2, borderColor: ATHLEO_COLORS.accent},
  photoThumb: {height: 104, width: '100%'},
  photoLabel: {paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800', color: '#FFFFFF'},
  photoLabelActive: {color: ATHLEO_COLORS.accent},
  photoWeight: {paddingHorizontal: 8, paddingBottom: 8, fontSize: 12, color: ATHLEO_COLORS.accent, fontWeight: '800'},
  emptyTimelineCard: {width: 160, backgroundColor: '#0D331D', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(184,255,77,0.2)', minHeight: 130, paddingHorizontal: 12},
  emptyTimelineText: {color: ATHLEO_COLORS.muted, fontSize: 13, fontWeight: '700', textAlign: 'center'},

  // Modal / Sheet
  modalOverlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)'},
  modalSheet: {backgroundColor: '#0D1C12', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  sheetHandle: {width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(184,255,77,0.4)', alignSelf: 'center', marginBottom: 20},
  sheetTitle: {color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 6},
  sheetSub: {color: '#E2FCE8', fontSize: 14, fontWeight: '700', marginBottom: 20, lineHeight: 20},
  sheetLabel: {color: ATHLEO_COLORS.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, marginTop: 4},
  anglePicker: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  angleChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#0F3820', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  angleChipActive: {backgroundColor: ATHLEO_COLORS.accent, borderColor: ATHLEO_COLORS.accent},
  angleChipText: {color: '#E2FCE8', fontSize: 13, fontWeight: '800'},
  angleChipTextActive: {color: '#071F12', fontWeight: '900'},
  weightInputWrap: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F3820', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)', marginBottom: 20, gap: 10},
  weightInput: {flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800'},
  weightUnit: {color: ATHLEO_COLORS.muted, fontSize: 14, fontWeight: '700'},
  cameraBtn: {width: '100%', height: 52, borderRadius: 16, backgroundColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexDirection: 'row', gap: 8},
  cameraBtnText: {color: '#071F12', fontSize: 15, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase'},
  libraryBtn: {width: '100%', height: 52, borderRadius: 16, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexDirection: 'row', gap: 8, borderWidth: 1.5, borderColor: ATHLEO_COLORS.accent},
  libraryBtnText: {color: ATHLEO_COLORS.accent, fontSize: 15, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase'},
  cancelBtn: {paddingVertical: 14, alignItems: 'center'},
  cancelBtnText: {color: ATHLEO_COLORS.muted, fontSize: 15, fontWeight: '700'},
});
