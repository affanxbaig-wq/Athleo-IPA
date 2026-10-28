/**
 * permissionsService.ts
 * Handles runtime permissions for Location, Notifications, and Storage.
 * Works on both Android and iOS.
 */

import {Alert, Linking, PermissionsAndroid, Platform} from 'react-native';
import {setAppPrefs} from './progressTracker';

// ─── Geolocation provider configuration ───────────────────────────────────────

/**
 * Configure the native geolocation module once, at app start.
 *
 * On Android the library defaults to `locationProvider: 'auto'`, which prefers
 * Google Play Services' fused provider. On devices without (or with a broken /
 * outdated) Play Services that provider never returns a fix, so `watchPosition`
 * silently produced nothing — the "GPS is not working" report. Forcing the
 * platform `LocationManager` works on every Android device.
 */
try {
  const Geolocation = require('@react-native-community/geolocation').default;
  Geolocation?.setRNConfiguration?.({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    locationProvider: 'android',
    enableBackgroundLocationUpdates: false,
  });
} catch {
  // Geolocation module missing — GPS screens already degrade to a safe state.
}

// ─── Location Permission ──────────────────────────────────────────────────────

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      const Geolocation = require('@react-native-community/geolocation').default;
      return await new Promise<boolean>(resolve => {
        Geolocation.requestAuthorization(
          () => {
            setAppPrefs({locationEnabled: true});
            resolve(true);
          },
          () => resolve(false),
        );
      });
    } catch {
      return false;
    }
  }

  // Android
  try {
    const isGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (isGranted) {
      setAppPrefs({locationEnabled: true});
      return true;
    }

    const userDecision = await new Promise<'settings' | 'cancel'>(resolve => {
      Alert.alert(
        'Allow Route Tracking & Outdoor Workouts?',
        'Athleo collects location data to map your runs, calculate accurate pacing, and track distance even when the screen is locked or the app is in the background.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve('cancel'),
          },
          {
            text: 'Continue to Settings',
            onPress: () => resolve('settings'),
          },
        ],
        {cancelable: false},
      );
    });

    if (userDecision === 'cancel') {
      return false;
    }

    if (userDecision === 'settings') {
      try {
        await Linking.openSettings();
      } catch (err) {
        console.warn('[permissions] Linking.openSettings error:', err);
      }
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Allow Route Tracking & Outdoor Workouts?',
        message: 'Athleo collects location data to map your runs, calculate accurate pacing, and track distance even when the screen is locked or the app is in the background.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Not Now',
        buttonPositive: 'Allow',
      },
    );
    const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
    if (ok) {setAppPrefs({locationEnabled: true});}
    return ok;
  } catch {
    return false;
  }
}

// ─── Notifications Permission ─────────────────────────────────────────────────

export async function requestNotificationsPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      // react-native-permissions or PushNotificationIOS
      const {PushNotificationIOS} = require('react-native');
      return await new Promise<boolean>(resolve => {
        PushNotificationIOS.requestPermissions({alert: true, badge: true, sound: true})
          .then((result: any) => {
            const ok = Boolean(result?.alert);
            if (ok) {setAppPrefs({pushNotificationsEnabled: true});}
            resolve(ok);
          })
          .catch(() => resolve(false));
      });
    } catch {
      // Fallback — just mark as enabled
      setAppPrefs({pushNotificationsEnabled: true});
      return true;
    }
  }

  // Android 13+ needs POST_NOTIFICATIONS permission
  if (Platform.OS === 'android') {
    try {
      const {PermissionsAndroid, Platform: P} = require('react-native');
      if (P.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Push Notifications',
            message: 'Allow Athleo to send you workout reminders and weekly progress reports.',
            buttonNegative: 'Not now',
            buttonPositive: 'Allow',
          },
        );
        const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
        if (ok) {setAppPrefs({pushNotificationsEnabled: true});}
        return ok;
      }
    } catch {
      // Android < 13 — notifications enabled by default
    }
  }

  setAppPrefs({pushNotificationsEnabled: true});
  return true;
}

// ─── Storage Permission (Android) ────────────────────────────────────────────

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {return true;}

  try {
    const {PermissionsAndroid, Platform: P} = require('react-native');
    // Android 13+ uses READ_MEDIA_IMAGES instead of READ_EXTERNAL_STORAGE
    const permission =
      P.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    const granted = await PermissionsAndroid.request(permission, {
      title: 'Storage Access',
      message: 'Athleo needs storage access to save progress photos and your 3-month history.',
      buttonNegative: 'Deny',
      buttonPositive: 'Allow',
    });

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return true;
  }
}

// ─── Health/Sensor Permission (Android) ───────────────────────────────────────

export async function requestHealthSensorPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {return true;}

  try {
    const {PermissionsAndroid, Platform: P} = require('react-native');
    const permission = P.Version >= 34
      ? PermissionsAndroid.PERMISSIONS.BODY_SENSORS_BACKGROUND
      : PermissionsAndroid.PERMISSIONS.BODY_SENSORS;

    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Connect Your Health Data',
        'To calculate active calories burned and monitor your heart rate zones, Athleo needs permission to access your phone\'s body sensors and step counters.',
        [
          {
            text: 'Grant Access',
            onPress: () => resolve(true),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
        ],
        {cancelable: false},
      );
    });

    if (!confirmed) {return false;}

    const granted = await PermissionsAndroid.request(permission, {
      title: 'Connect Your Health Data',
      message: 'To calculate active calories burned and monitor your heart rate zones, Athleo needs permission to access your phone\'s body sensors and step counters.',
      buttonNegative: 'Cancel',
      buttonPositive: 'Grant Access',
    });

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ─── Activity Recognition Permission (Android 10+) ────────────────────────────

/**
 * Android 10 (API 29) and newer gate the hardware step counter/detector behind
 * the ACTIVITY_RECOGNITION runtime permission — without it the sensor
 * registration silently fails and no step events are ever delivered.
 * Resolves true when step sensing is allowed on this device.
 */
export async function requestActivityRecognitionPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {return true;}

  try {
    const {PermissionsAndroid, Platform: P} = require('react-native');
    if (P.Version < 29) {return true;}

    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    );
    if (already) {return true;}

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Step Tracking',
        message:
          'Athleo uses your device\u2019s motion sensor to count your steps and active calories.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not Now',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ─── Request All ─────────────────────────────────────────────────────────────

export async function requestAllPermissions(): Promise<{
  location: boolean;
  notifications: boolean;
  storage: boolean;
}> {
  Alert.alert(
    'Athleo Needs Access',
    'To give you real-time workout tracking, GPS runs, weekly reports, and progress storage — Athleo needs a few permissions.',
    [
      {
        text: 'Continue',
        onPress: async () => {
          await requestLocationPermission();
          await requestNotificationsPermission();
          await requestStoragePermission();
        },
      },
    ],
    {cancelable: false},
  );

  // Return current state (will resolve before dialogs close on some platforms)
  return {location: false, notifications: false, storage: false};
}

export async function requestAllPermissionsAsync(): Promise<{
  location: boolean;
  notifications: boolean;
  storage: boolean;
}> {
  const location = await requestLocationPermission();
  const notifications = await requestNotificationsPermission();
  const storage = await requestStoragePermission();
  await requestActivityRecognitionPermission();
  return {location, notifications, storage};
}
