import React, {useEffect, useState} from 'react';
import {Alert, Modal, StyleSheet, Switch, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';
import {deleteUserAccount, signOut} from '../services/auth';
import {isSupabaseConfigured} from '../config/supabase';
import {appStorage} from '../services/storage';
import {clearUserProfile} from '../services/userProfile';
import {resetDailyStore} from '../services/dailyCalories';
import {triggerHaptic} from '../services/haptics';
import {getTrustedDevices, revokeTrustedDevice, type TrustedDevice} from '../services/deviceAuth';

interface SettingsScreenProps {
  navigate?: (tab: TabKey) => void;
  onSignOut?: () => void;
}

type NavTile = {key: TabKey; label: string; icon: string; color: string; description: string};
type ToggleKey = 'notifications' | 'biometrics' | 'darkMode' | 'haptics' | 'weeklyReport';

const navTiles: NavTile[] = [
  {key: 'gym', label: 'Smart Gym Mode', icon: 'flame-outline', color: '#FF6B35', description: 'Live workout cockpit'},
  {key: 'outdoor', label: 'Outdoor Run', icon: 'walk-outline', color: '#3AB4FF', description: 'GPS-tracked cardio'},
  {key: 'pedometer', label: 'Step Tracker', icon: 'footsteps-outline', color: '#6AE28D', description: 'Daily step counter'},
  {key: 'health', label: 'Health & Recovery', icon: 'heart-outline', color: '#FF6B6B', description: 'Readiness & HRV'},
  {key: 'builder', label: 'Workout Builder', icon: 'construct-outline', color: '#C87AFF', description: 'Custom routines'},
  {key: 'technique', label: 'Biomechanics', icon: 'body-outline', color: '#FFD700', description: 'Form & technique guide'},
  {key: 'community', label: 'Social Feed', icon: 'people-outline', color: '#3AB4FF', description: 'Athlete community'},
  {key: 'notifications', label: 'Notifications', icon: 'notifications-outline', color: ATHLEO_COLORS.accent, description: 'Push alert settings'},
];

const SETTINGS_STORAGE_KEY = 'athleo_settings_toggles';

export function SettingsScreen({navigate, onSignOut}: SettingsScreenProps) {
  const cachedToggles = appStorage.getObject<Record<ToggleKey, boolean>>(SETTINGS_STORAGE_KEY);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(
    cachedToggles ?? {
      notifications: true,
      biometrics: true,
      darkMode: true,
      haptics: true,
      weeklyReport: false,
    },
  );
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [activeModal, setActiveModal] = useState<'privacy' | 'support' | null>(null);

  useEffect(() => {
    const loadTrustedDevices = async () => {
      if (!isSupabaseConfigured()) {
        return;
      }

      setLoadingDevices(true);
      try {
        const devices = await getTrustedDevices();
        setTrustedDevices(devices);
      } catch {
        setTrustedDevices([]);
      } finally {
        setLoadingDevices(false);
      }
    };

    loadTrustedDevices();
  }, []);

  const flip = (key: ToggleKey) => {
    triggerHaptic('selection');
    setToggles(prev => {
      const next = {...prev, [key]: !prev[key]};
      appStorage.setObject(SETTINGS_STORAGE_KEY, next);
      return next;
    });
  };

  const handleSignOut = () => {
    triggerHaptic('impactLight');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isSupabaseConfigured()) {
              await signOut();
            }
          } catch (_) {}
          onSignOut?.();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    triggerHaptic('notificationWarning');
    Alert.alert(
      'Delete Account & Data',
      'This will permanently delete your Athleo account, cloud backups, and all local training telemetry (workouts, PRs, body metrics). This action cannot be undone.\n\nAre you sure you want to proceed?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationError');
              await deleteUserAccount();
              clearUserProfile();
              resetDailyStore();
              Alert.alert(
                'Account Purged',
                'Your account and all associated data have been permanently removed.',
              );
              onSignOut?.();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to delete account.');
            }
          },
        },
      ],
    );
  };

  const handleRevokeDevice = async (device: TrustedDevice) => {
    Alert.alert(
      'Revoke Device',
      `Remove access for ${device.device_name || 'this device'}? This device will need to sign in again before it can access the app.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const ok = await revokeTrustedDevice(device.device_id);
            if (ok) {
              setTrustedDevices(prev => prev.filter(item => item.device_id !== device.device_id));
              Alert.alert('Device revoked', 'This device has been removed from the trusted device list.');
            } else {
              Alert.alert('Unable to revoke', 'This device could not be removed at this time.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Quick Access */}
        <Text style={styles.sectionLabel}>Features</Text>
        <View style={styles.tileGrid}>
          {navTiles.map(tile => (
            <TouchableOpacity
              key={tile.key}
              style={styles.navTile}
              onPress={() => {
                triggerHaptic('impactLight');
                navigate?.(tile.key);
              }}>
              <View style={[styles.tileIcon, {backgroundColor: `${tile.color}18`}]}>
                <Icon name={tile.icon} size={20} color={tile.color} />
              </View>
              <View style={styles.tileBody}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileDesc}>{tile.description}</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={ATHLEO_COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Toggles */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <AppCard style={styles.section}>
          {(
            [
              {key: 'notifications' as ToggleKey, label: 'Push Notifications', icon: 'notifications-outline'},
              {key: 'biometrics' as ToggleKey, label: 'Biometric Login', icon: 'finger-print-outline'},
              {key: 'haptics' as ToggleKey, label: 'Haptic Feedback', icon: 'phone-portrait-outline'},
              {key: 'weeklyReport' as ToggleKey, label: 'Weekly Report', icon: 'bar-chart-outline'},
            ] as {key: ToggleKey; label: string; icon: string}[]
          ).map((item, idx, arr) => (
            <View
              key={item.key}
              style={[styles.toggleRow, idx < arr.length - 1 && styles.toggleRowBorder]}>
              <Icon name={item.icon} size={18} color={ATHLEO_COLORS.muted} />
              <Text style={styles.toggleLabel}>{item.label}</Text>
              <Switch
                value={toggles[item.key]}
                onValueChange={() => flip(item.key)}
                trackColor={{false: '#2A2A2E', true: 'rgba(184,255,77,0.45)'}}
                thumbColor={toggles[item.key] ? ATHLEO_COLORS.accent : '#6B6E75'}
              />
            </View>
          ))}
        </AppCard>

        {/* Trusted Devices */}
        <Text style={styles.sectionLabel}>Trusted Devices</Text>
        <AppCard style={styles.section}>
          {loadingDevices ? (
            <View style={styles.deviceRow}><Text style={styles.menuLabel}>Loading devices…</Text></View>
          ) : trustedDevices.length === 0 ? (
            <View style={styles.deviceRow}><Text style={styles.menuLabel}>No trusted devices saved yet.</Text></View>
          ) : (
            trustedDevices.map((device, idx, arr) => (
              <View key={device.id} style={[styles.menuRow, idx < arr.length - 1 && styles.menuRowBorder]}>
                <View style={styles.deviceMetaWrap}>
                  <Icon name={device.platform === 'ios' ? 'phone-portrait-outline' : device.platform === 'android' ? 'phone-portrait-outline' : 'laptop-outline'} size={18} color={ATHLEO_COLORS.muted} />
                  <View style={styles.deviceMetaText}>
                    <Text style={styles.menuLabel}>{device.device_name || 'Athleo Device'}</Text>
                    <Text style={styles.deviceSubText}>{device.platform.toUpperCase()} • {device.os_version || 'Unknown OS'} • {new Date(device.last_seen_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleRevokeDevice(device)} style={styles.deviceRevokeButton}>
                  <Text style={styles.deviceRevokeText}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </AppCard>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account & Compliance</Text>
        <AppCard style={styles.section}>
          {[
            {
              label: 'Edit Profile',
              icon: 'person-outline',
              onPress: () => navigate?.('editProfile'),
            },
            {
              label: 'Subscription Plans',
              icon: 'star-outline',
              onPress: () => navigate?.('paywall'),
            },
            {
              label: 'Privacy Policy & Data Safety',
              icon: 'shield-checkmark-outline',
              onPress: () => setActiveModal('privacy'),
            },
            {
              label: 'Help Center & Support',
              icon: 'help-circle-outline',
              onPress: () => setActiveModal('support'),
            },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => {
                triggerHaptic('impactLight');
                item.onPress();
              }}
              style={[styles.menuRow, idx < arr.length - 1 && styles.menuRowBorder]}>
              <Icon name={item.icon} size={18} color={ATHLEO_COLORS.muted} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Icon name="chevron-forward" size={16} color={ATHLEO_COLORS.muted} />
            </TouchableOpacity>
          ))}
        </AppCard>

        {/* Delete Account (Google Play Mandatory) */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Icon name="trash-outline" size={18} color="#FF5A5F" />
          <Text style={styles.deleteButtonText}>Delete Account & Data</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Athleo v1.0.0 (Build 2026.10) • Production Edition</Text>
          <Text style={styles.appInfoText}>© 2026 Athleo Performance Inc. All Rights Reserved.</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Icon name="log-out-outline" size={18} color={ATHLEO_COLORS.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </SmoothScrollView>

      {/* Privacy Policy Modal */}
      <Modal visible={activeModal === 'privacy'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy & Data Safety</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Icon name="close" size={20} color={ATHLEO_COLORS.text} />
              </TouchableOpacity>
            </View>
            <SmoothScrollView style={styles.modalScroll}>
              <Text style={styles.modalSubheading}>1. Google Play Data Safety Compliance</Text>
              <Text style={styles.modalBody}>
                Athleo complies with Google Play Store User Data Policy. We collect workout metrics, caloric logs, and health statistics solely to provide personalized athletic feedback.
              </Text>

              <Text style={styles.modalSubheading}>2. Zero Third-Party Advertising</Text>
              <Text style={styles.modalBody}>
                We do not sell, rent, or monetize your health or biometric information to third parties, ad networks, or data brokers.
              </Text>

              <Text style={styles.modalSubheading}>3. Biometrics Security</Text>
              <Text style={styles.modalBody}>
                Face ID and Fingerprint data remain strictly inside your device’s secure hardware enclave (TEE/Secure Enclave). Biometric signatures are never sent to our servers.
              </Text>

              <Text style={styles.modalSubheading}>4. Right to Erasure (Data Deletion)</Text>
              <Text style={styles.modalBody}>
                You have the full right to delete your account and all associated telemetry at any time via the "Delete Account & Data" option in Settings or by contacting privacy@athleo.app.
              </Text>
            </SmoothScrollView>
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal visible={activeModal === 'support'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Icon name="close" size={20} color={ATHLEO_COLORS.text} />
              </TouchableOpacity>
            </View>
            <SmoothScrollView style={styles.modalScroll}>
              <Text style={styles.modalSubheading}>How do I log a workout?</Text>
              <Text style={styles.modalBody}>
                Go to the Train tab, browse the Exercise Library or choose a Starter Program, and tap "Start Workout" to launch the real-time session cockpit.
              </Text>

              <Text style={styles.modalSubheading}>How are macro targets calculated?</Text>
              <Text style={styles.modalBody}>
                Athleo uses the Mifflin-St Jeor metabolic expenditure equation, factoring in your target goal (Muscle Gain, Fat Loss, Strength), activity level, and recovery index.
              </Text>

              <Text style={styles.modalSubheading}>Contact Athlete Support</Text>
              <Text style={styles.modalBody}>
                Need assistance? Our concierge team is ready 24/7 at support@athleo.app.
              </Text>
            </SmoothScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 120, gap: 12},
  title: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 4},
  sectionLabel: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  tileGrid: {gap: 1, borderRadius: 18, overflow: 'hidden'},
  navTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F3820',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    marginBottom: 6,
    borderRadius: 14,
  },
  tileIcon: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  tileBody: {flex: 1},
  tileLabel: {color: '#FFFFFF', fontWeight: '800', fontSize: 15},
  tileDesc: {color: '#E2FCE8', fontSize: 13, fontWeight: '700', marginTop: 2},
  section: {
    backgroundColor: '#0D331D',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleRowBorder: {borderBottomWidth: 1, borderBottomColor: 'rgba(184, 255, 77, 0.2)'},
  toggleLabel: {flex: 1, color: '#FFFFFF', fontWeight: '800', fontSize: 15},
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuRowBorder: {borderBottomWidth: 1, borderBottomColor: 'rgba(184, 255, 77, 0.2)'},
  menuLabel: {flex: 1, color: '#FFFFFF', fontWeight: '800', fontSize: 15},
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deviceMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceMetaText: {
    flex: 1,
  },
  deviceSubText: {
    color: '#E2FCE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  deviceRevokeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,95,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,95,0.35)',
  },
  deviceRevokeText: {
    color: '#FF5A5F',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,90,95,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,95,0.25)',
    marginTop: 6,
  },
  deleteButtonText: {
    color: '#FF5A5F',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  appInfo: {alignItems: 'center', gap: 4, marginTop: 6},
  appInfoText: {color: ATHLEO_COLORS.muted, fontSize: 11},
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  signOutText: {color: ATHLEO_COLORS.text, fontWeight: '700', fontSize: 14},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#161719',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: ATHLEO_COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSubheading: {
    color: ATHLEO_COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  modalBody: {
    color: ATHLEO_COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
});
