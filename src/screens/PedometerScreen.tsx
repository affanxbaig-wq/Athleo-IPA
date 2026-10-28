import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/Ionicons';

import {AppCard} from '../components/AppCard';
import {AnimatedText as Text} from '../components/AnimatedText';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {getUserProfile, setUserProfile} from '../services/userProfile';
import {
  getCaloriesBurned,
  getDistanceKm,
  getSpeedKmh,
  getSteps,
  getStepsGoal,
  getStreak,
  resetIfNewDay,
  setDistanceKm,
  setSpeedKmh,
  setSteps,
  subscribe,
} from '../services/dailyTracker';
import {getActiveStepSource, startActivityTracking} from '../services/activityTracker';
import {
  getActiveSensorName,
  getBackgroundPedometerStats,
  getBestKnownSteps,
  getStepSource,
  setUserBiometrics,
  startBackgroundPedometer,
  stopBackgroundPedometer,
  type StepSource,
} from '../services/stepCounter';
import {
  notifyGoalSet,
  sendWeeklyReportNotification,
} from '../services/notificationService';
import {getProgressHistory, getWeeklyReport} from '../services/progressTracker';
import {triggerHaptic} from '../services/haptics';
import {requestActivityRecognitionPermission} from '../services/permissionsService';
import {SatisfyingCalorieFlame} from '../components/SatisfyingCalorieFlame';
import {SatisfyingRunningTrack} from '../components/SatisfyingRunningTrack';
import {SatisfyingBarChart} from '../components/SatisfyingBarChart';

// ─── Constants ────────────────────────────────────────────────────────────────
const GPS_SOFT_ACCURACY_METERS = 25;
const NOISE_MIN_METERS = 0.6;
const PRESET_GOALS = [6000, 8000, 10000, 12000, 15000];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Coordinate = {latitude: number; longitude: number};
type PermissionState = 'unknown' | 'granted' | 'denied' | 'limited';
type TrackingMode = 'idle' | 'starting' | 'tracking' | 'paused' | 'weak' | 'denied';

function haversineDistanceMeters(a: Coordinate, b: Coordinate): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function statusText(mode: TrackingMode): string {
  const map: Record<TrackingMode, string> = {
    idle: 'Ready',
    starting: 'Connecting 1ms Sensor',
    tracking: '1ms Real-time Tracking',
    paused: 'Paused',
    weak: 'Weak Signal',
    denied: 'No Permission',
  };
  return map[mode];
}

function statusColor(mode: TrackingMode): string {
  const map: Record<TrackingMode, string> = {
    idle: ATHLEO_COLORS.muted,
    starting: '#C9A6FF',
    tracking: ATHLEO_COLORS.accent,
    paused: '#7AB7FF',
    weak: '#FFC470',
    denied: '#FF8E8E',
  };
  return map[mode];
}

// ─── Beautiful SVG Step Ring ───────────────────────────────────────────────────
import Svg, {Circle, Defs, LinearGradient, RadialGradient, Stop} from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function StepRing({
  progress,
  steps,
  goal,
  size = 210,
  isActive = false,
  color = '#B8FF4D',
}: {
  progress: number;
  steps: number;
  goal: number;
  size?: number;
  isActive?: boolean;
  color?: string;
}) {
  const strokeWidth = size * 0.075;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // Smooth animated progress value (JS thread — strokeDashoffset needs it)
  const animRatio = useRef(new Animated.Value(0)).current;
  const prevRatio = useRef(0);

  // Outer pulse ring scale (native driver)
  const pulseScale = useRef(new Animated.Value(1)).current;
  // Inner glow opacity (native driver)
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  // Rotating dot angle (native driver)
  const dotAngle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    if (Math.abs(target - prevRatio.current) < 0.002) {return;}
    prevRatio.current = target;
    Animated.spring(animRatio, {
      toValue: target,
      friction: 7,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [animRatio, progress]);

  // Continuous pulse + glow when active
  useEffect(() => {
    if (!isActive) {return undefined;}
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {toValue: 1.06, duration: 1100, useNativeDriver: true}),
        Animated.timing(pulseScale, {toValue: 1, duration: 1100, useNativeDriver: true}),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {toValue: 0.85, duration: 900, useNativeDriver: true}),
        Animated.timing(glowOpacity, {toValue: 0.35, duration: 900, useNativeDriver: true}),
      ]),
    );
    const dot = Animated.loop(
      Animated.timing(dotAngle, {toValue: 1, duration: 2200, useNativeDriver: true}),
    );
    pulse.start();
    glow.start();
    dot.start();
    return () => {
      pulse.stop();
      glow.stop();
      dot.stop();
    };
  }, [isActive, pulseScale, glowOpacity, dotAngle]);

  const dashOffset = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const pct = Math.round(progress * 100);
  const fontSize = Math.round(size * 0.16);
  const labelSize = Math.round(size * 0.062);

  return (
    <Animated.View style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{scale: isActive ? pulseScale : 1}],
    }}>
      {/* Ambient glow behind ring */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.425,
          backgroundColor: color,
          opacity: glowOpacity.interpolate({inputRange: [0.35, 0.85], outputRange: [0.06, 0.16]}),
        }}
      />

      <Svg width={size} height={size} style={{position: 'absolute'}}>
        <Defs>
          <LinearGradient id="stepArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="60%" stopColor={color} />
            <Stop offset="100%" stopColor={`${color}88`} />
          </LinearGradient>
          <RadialGradient id="centerBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Center bloom glow */}
        <Circle cx={cx} cy={cy} r={radius * 0.7} fill="url(#centerBloom)" />

        {/* Track ring */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Inner track (subtle) */}
        <Circle
          cx={cx} cy={cy} r={radius - strokeWidth * 1.4}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={strokeWidth * 0.35}
          fill="none"
        />

        {/* Animated progress arc */}
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke="url(#stepArcGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          // @ts-ignore
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Rotating dot at arc tip when active */}
      {isActive && progress > 0.01 && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{rotate: dotAngle.interpolate({inputRange: [0, 1], outputRange: [`${-90 + progress * 360}deg`, `${-90 + progress * 360 + 360}deg`]})}],
          }}>
          <View style={{
            position: 'absolute',
            top: strokeWidth * 0.5 - strokeWidth * 0.22,
            width: strokeWidth * 0.7,
            height: strokeWidth * 0.7,
            borderRadius: strokeWidth * 0.35,
            backgroundColor: '#FFFFFF',
            shadowColor: color,
            shadowOffset: {width: 0, height: 0},
            shadowOpacity: 1,
            shadowRadius: 6,
            elevation: 6,
          }} />
        </Animated.View>
      )}

      {/* Center label */}
      <View style={{alignItems: 'center', zIndex: 2}} pointerEvents="none">
        <Text style={{
          color: color,
          fontSize,
          fontWeight: '900',
          letterSpacing: -1,
          textShadowColor: `${color}99`,
          textShadowOffset: {width: 0, height: 0},
          textShadowRadius: 12,
        }}>
          {steps.toLocaleString()}
        </Text>
        <Text style={{
          color: '#D4FFB2',
          fontSize: labelSize + 1,
          fontWeight: '800',
          letterSpacing: 0.5,
          marginTop: 2,
        }}>
          steps today
        </Text>
        <Text style={{
          color: '#6E9B6E',
          fontSize: labelSize,
          fontWeight: '700',
          marginTop: 1,
        }}>
          {pct}% of {goal.toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}



// ─── Main Component ────────────────────────────────────────────────────────────
export function PedometerScreen() {
  const [mode, setMode] = useState<TrackingMode>('idle');
  const [permState, setPermState] = useState<PermissionState>('unknown');
  const [sensorSource, setSensorSource] = useState<StepSource>('none');
  const [activeSource, setActiveSource] = useState<StepSource>(() => getActiveStepSource());

  const [steps, setStepsState] = useState(() => {
    resetIfNewDay();
    return getBestKnownSteps() || getSteps();
  });
  const [distanceKm, setDistanceKmState] = useState(() => getDistanceKm() || 0);
  const [calories, setCaloriesState] = useState(() => Math.round(getCaloriesBurned()) || 0);
  const [speedKmh, setSpeedKmhState] = useState(() => getSpeedKmh() || 0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [bgTrackingEnabled, setBgTrackingEnabled] = useState(false);
  const [stepGoal, setStepGoal] = useState(() => getUserProfile().stepGoal || getStepsGoal());

  // Profile data
  const [profile] = useState(() => getUserProfile());

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Refs
  const isMountedRef = useRef(true);
  const watchIdRef = useRef<number | null>(null);
  const lastCoordRef = useRef<Coordinate | null>(null);
  const lastFixTsRef = useRef<number>(Date.now());
  const cumulativeMetersRef = useRef(0);
  const sessionStartStepsRef = useRef(steps);
  const sessionActiveRef = useRef(false);
  const permCheckedRef = useRef(false);

  const weightKg = useRef(Math.max(40, profile.weightKg || 72)).current;
  const heightCm = useRef(Math.max(120, profile.heightCm || 176)).current;

  // Mount animation + teardown
  useEffect(() => {
    Animated.timing(fadeIn, {toValue: 1, duration: 500, useNativeDriver: true}).start();
    return () => {
      isMountedRef.current = false;
      sessionActiveRef.current = false;
      if (watchIdRef.current !== null) {
        try { Geolocation.clearWatch(watchIdRef.current); } catch {/* ignore */}
        watchIdRef.current = null;
      }
    };
  }, [fadeIn]);

  // Check background service state on mount ONCE — not on every step change
  useEffect(() => {
    (async () => {
      try {
        const stats = await getBackgroundPedometerStats();
        if (stats && isMountedRef.current) {
          setBgTrackingEnabled(stats.isActive);
          const curSteps = getSteps();
          if (stats.steps > curSteps) {
            setStepsState(stats.steps);
            setSteps(stats.steps);
            setDistanceKmState(Number(stats.distanceKm.toFixed(2)));
            setDistanceKm(stats.distanceKm);
            setSpeedKmhState(Number(stats.speedKmh.toFixed(1)));
            setSpeedKmh(stats.speedKmh);
            setCaloriesState(Math.round(stats.calories));
          }
        }
      } catch {
        /* ignore */
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — not on every step change


  // Subscribe to live daily tracker updates
  useEffect(() => {
    const unsubSteps = subscribe('steps', value => {
      if (!isMountedRef.current) { return; }
      setStepsState(value);
      const live = getActiveSensorName();
      if (live !== 'none') { setActiveSource(live); }
    });
    const unsubDistance = subscribe('distance_km', val => {
      if (!isMountedRef.current) { return; }
      setDistanceKmState(Number(val.toFixed(2)));
    });
    const unsubSpeed = subscribe('speed_kmh', val => {
      if (!isMountedRef.current) { return; }
      setSpeedKmhState(Number(val.toFixed(1)));
    });
    const unsubCalories = subscribe('calories_burned', val => {
      if (!isMountedRef.current) { return; }
      setCaloriesState(Math.round(val));
    });

    return () => {
      unsubSteps();
      unsubDistance();
      unsubSpeed();
      unsubCalories();
    };
  }, []);

  // Continuous background sync interval while tracking is active
  useEffect(() => {
    if (mode !== 'tracking') { return undefined; }
    const interval = setInterval(async () => {
      try {
        const stats = await getBackgroundPedometerStats();
        if (stats && isMountedRef.current && stats.steps > 0) {
          const curSteps = getSteps();
          if (stats.steps > curSteps) {
            setStepsState(stats.steps);
            setSteps(stats.steps);
            setDistanceKmState(Number(stats.distanceKm.toFixed(2)));
            setDistanceKm(stats.distanceKm);
            setSpeedKmhState(Number(stats.speedKmh.toFixed(1)));
            setSpeedKmh(stats.speedKmh);
            setCaloriesState(Math.round(stats.calories));
          } else {
            // Also update speed and distance in real time even between step increments
            const liveSpeed = Number(stats.speedKmh.toFixed(1));
            setSpeedKmhState(prev => (prev !== liveSpeed ? liveSpeed : prev));
            setSpeedKmh(stats.speedKmh);
          }
        }
      } catch {
        /* non-critical */
      }
    }, 800);

    return () => clearInterval(interval);
  }, [mode]);

  // Pulse animation when tracking
  useEffect(() => {
    if (mode === 'tracking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.08, duration: 1000, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 1000, useNativeDriver: true}),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    return undefined;
  }, [mode, pulseAnim]);

  // Glow loop
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {toValue: 1, duration: 1400, useNativeDriver: true}),
        Animated.timing(glowAnim, {toValue: 0.55, duration: 1400, useNativeDriver: true}),
      ]),
    );
    glow.start();
    return () => glow.stop();
  }, [glowAnim]);

  // Sensor detection & bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUserBiometrics(weightKg, heightCm);

      // Auto-prompt Android ACTIVITY_RECOGNITION if not granted yet
      if (Platform.OS === 'android') {
        const hasPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        if (!hasPerm) {
          await requestActivityRecognitionPermission();
        }
      }

      const started = await startActivityTracking();
      const source = await getStepSource();
      if (cancelled || !isMountedRef.current) { return; }

      setSensorSource(source);
      const liveSensor = getActiveSensorName();
      const effective =
        liveSensor !== 'none' ? liveSensor : started !== 'none' ? started : getActiveStepSource();

      const hasPermission = Platform.OS === 'android'
        ? (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION))
        : true;

      // Accelerometer needs zero permissions; hardware counter needs permission
      const resolved = effective !== 'none' ? effective : (hasPermission ? source : 'accelerometer');
      setActiveSource(resolved);

      const sensorSteps = getBestKnownSteps();
      if (sensorSteps > 0) {
        setStepsState(sensorSteps);
      }
    })();
    return () => { cancelled = true; };
  }, [heightCm, weightKg]);

  // Check location permission on mount
  useEffect(() => {
    if (permCheckedRef.current) { return; }
    permCheckedRef.current = true;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
          if (isMountedRef.current) {
            setPermState(fine || coarse ? 'granted' : 'unknown');
          }
        } else if (Platform.OS === 'ios') {
          Geolocation.requestAuthorization(
            () => isMountedRef.current && setPermState('granted'),
            () => isMountedRef.current && setPermState('unknown'),
          );
        }
      } catch {/* ignore */}
    })();
  }, []);

  // Location permission request
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const confirmed = await new Promise<boolean>(resolve => {
          Alert.alert(
            'GPS Location for Route & Outdoor Speed',
            'Athleo uses hardware sensors for 1ms step counting even with the screen off. Enable GPS to also calculate outdoor route & GPS pace.',
            [
              {text: 'Use Sensors Only', style: 'cancel', onPress: () => resolve(false)},
              {text: 'Enable GPS', onPress: () => resolve(true)},
            ],
            {cancelable: false},
          );
        });
        if (!confirmed) {
          if (isMountedRef.current) { setPermState('denied'); }
          return false;
        }

        const fineResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access',
            message: 'Athleo measures route distance from your GPS.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        const granted = fineResult === PermissionsAndroid.RESULTS.GRANTED;
        if (isMountedRef.current) { setPermState(granted ? 'granted' : 'denied'); }
        return granted;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Toggle Background Service (stays active when app is killed/swiped from recents)
  const toggleBackgroundTracking = useCallback(async (enable: boolean) => {
    triggerHaptic('impactMedium');
    if (enable) {
      const ok = await startBackgroundPedometer(stepGoal, weightKg, heightCm);
      setBgTrackingEnabled(ok);
      if (ok) {
        Alert.alert(
          'Background Tracking Active',
          'Athleo Foreground Service is now running at 1ms hardware speed. Even if you swipe away and kill the app, steps, distance, speed, and calories will keep counting!',
          [{text: 'Awesome'}],
        );
      }
    } else {
      await stopBackgroundPedometer();
      setBgTrackingEnabled(false);
    }
  }, [heightCm, stepGoal, weightKg]);

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      if (mode === 'tracking') { return; }
      triggerHaptic('impactHeavy');

      // 1. Hardware sensor at 1ms rate
      const source = await startActivityTracking();
      const resuming = sessionActiveRef.current;

      if (isMountedRef.current) {
        if (source !== 'none') { setSensorSource(source); }
        setActiveSource(source);
        if (!resuming) {
          sessionStartStepsRef.current = getSteps();
          cumulativeMetersRef.current = 0;
          lastCoordRef.current = null;
          lastFixTsRef.current = Date.now();
        }
      }

      // Auto-start background foreground service so tracking survives app close
      startBackgroundPedometer(stepGoal, weightKg, heightCm)
        .then(started => {
          if (isMountedRef.current) { setBgTrackingEnabled(started); }
        })
        .catch(() => {
          if (isMountedRef.current) { setBgTrackingEnabled(false); }
        });

    sessionActiveRef.current = true;
    setMode('tracking');
    setSessionStarted(true);

    // 2. Start GPS watch for outdoor distance & speed refinement
    const allowed = permState === 'granted' || (await requestLocationPermission());
    if (allowed) {
      if (watchIdRef.current !== null) {
        try { Geolocation.clearWatch(watchIdRef.current); } catch {/* ignore */}
        watchIdRef.current = null;
      }

      const onSuccess = (position: {
        coords: {latitude: number; longitude: number; speed: number | null; accuracy?: number | null};
      }) => {
        if (!isMountedRef.current) { return; }
        const accuracy = position.coords.accuracy ?? 999;
        const rawSpeed = position.coords.speed ?? 0;
        const speed = Math.max(0, rawSpeed) * 3.6;
        const coord: Coordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const prev = lastCoordRef.current;

        if (accuracy > GPS_SOFT_ACCURACY_METERS) {
          return;
        }

        const nowMs = Date.now();
        lastFixTsRef.current = nowMs;
        lastCoordRef.current = coord;

        if (prev) {
          const distanceM = haversineDistanceMeters(prev, coord);
          if (distanceM > NOISE_MIN_METERS) {
            cumulativeMetersRef.current += distanceM;
            const totalKm = cumulativeMetersRef.current / 1000;
            setDistanceKm(totalKm);
            setDistanceKmState(Number(totalKm.toFixed(2)));
          }
        }
        if (speed > 0) {
          setSpeedKmh(speed);
          setSpeedKmhState(Number(speed.toFixed(1)));
        }
      };

      try {
        watchIdRef.current = Geolocation.watchPosition(onSuccess, () => {}, {
          enableHighAccuracy: true,
          distanceFilter: 1,
          interval: 1000,
          fastestInterval: 500,
        });
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[PedometerScreen] startTracking error:', err);
  }
}, [heightCm, mode, permState, requestLocationPermission, stepGoal, weightKg]);

  const stopTracking = useCallback(() => {
    triggerHaptic('impactLight');
    sessionActiveRef.current = false;
    if (watchIdRef.current !== null) {
      try { Geolocation.clearWatch(watchIdRef.current); } catch {/* ignore */}
      watchIdRef.current = null;
    }
    lastCoordRef.current = null;
    if (isMountedRef.current) {
      setMode('paused');
    }
  }, []);

  // Goal update handler
  const handleSelectGoal = useCallback((newGoal: number) => {
    triggerHaptic('selection');
    setStepGoal(newGoal);
    setUserProfile({stepGoal: newGoal});
    notifyGoalSet(newGoal);
    // Restart foreground service with updated goal
    if (bgTrackingEnabled) {
      startBackgroundPedometer(newGoal, weightKg, heightCm);
    }
  }, [bgTrackingEnabled, heightCm, weightKg]);

  // Request Activity Recognition Permission
  const handleRequestSensorPermission = useCallback(async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      const granted = await requestActivityRecognitionPermission();
      if (granted && isMountedRef.current) {
        const src = await startActivityTracking();
        setActiveSource(src);
        setSensorSource(src);
      }
    }
  }, []);

  // Trigger Weekly Report Notification
  const handleTriggerWeeklyReport = useCallback(async () => {
    triggerHaptic('notificationSuccess');
    await sendWeeklyReportNotification();
    Alert.alert(
      '📊 Weekly Report Generated',
      'Your weekly performance report notification has been sent! Check your notification bar for full athlete metrics.',
      [{text: 'Got it'}],
    );
  }, []);

  const isActive = mode === 'tracking' || mode === 'starting' || mode === 'weak';
  const stepsProgress = Math.min(1, steps / Math.max(1, stepGoal));
  const modeColor = statusColor(mode);

  const sensorLabel =
    activeSource === 'counter'
      ? 'Hardware Step Counter'
      : activeSource === 'detector'
      ? 'Step Detector'
      : activeSource === 'accelerometer'
      ? 'Accelerometer'
      : sensorSource !== 'none'
      ? 'Permission Needed'
      : 'No Sensor Detected';

  // Compute weekly/streak once on mount — these are heavy reads from storage
  const weekly = useRef(getWeeklyReport()).current;
  const streak = useRef(getStreak()).current;

  const weeklyChartData = useMemo(() => {
    const raw = getProgressHistory(30).slice(-7);
    const baseList = raw.length > 0 ? raw : [
      {date: 'Mon', steps: Math.round(weekly.avgSteps * 0.9)},
      {date: 'Tue', steps: Math.round(weekly.avgSteps * 1.1)},
      {date: 'Wed', steps: Math.round(weekly.avgSteps * 0.85)},
      {date: 'Thu', steps: Math.round(weekly.avgSteps * 1.05)},
      {date: 'Fri', steps: Math.round(weekly.avgSteps * 1.15)},
      {date: 'Sat', steps: Math.round(weekly.avgSteps * 0.95)},
      {date: 'Today', steps: steps || weekly.avgSteps},
    ];

    return baseList.map((entry: any, idx: number) => {
      const isToday = idx === baseList.length - 1;
      const d = entry.date ? new Date(entry.date) : null;
      const dayName = d && !isNaN(d.getTime()) ? DAY_NAMES[d.getDay()] : (entry.date ?? `D${idx + 1}`);
      return {
        label: isToday ? 'Today' : dayName,
        value: isToday ? (steps > 0 ? steps : entry.steps) : entry.steps,
        date: entry.date,
      };
    });
  }, [steps, weekly.avgSteps]);


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      <Animated.View style={[{opacity: fadeIn}, styles.cardsContainer]}>

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <View style={styles.headerTag}>
              <View style={styles.livePulseDot} />
              <Text style={styles.eyebrow} delay={0}>1MS RESPONSE RATE</Text>
            </View>
            <Text style={styles.heading} delay={60}>Pedometer</Text>
          </View>
          <TouchableOpacity
            style={[styles.ctaButton, isActive && styles.ctaButtonPause]}
            onPress={isActive ? stopTracking : startTracking}
            activeOpacity={0.82}>
            <Text style={styles.ctaText}>{isActive ? 'Pause' : sessionStarted ? 'Resume' : 'Start'}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Sensor chip row ─── */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.sensorChip, styles.sensorChipOk]}
            onPress={handleRequestSensorPermission}
            activeOpacity={0.75}>
            <Icon name="flash" size={12} color={ATHLEO_COLORS.accent} style={{marginRight: 4}} />
            <Text style={styles.sensorChipText}>{sensorLabel} • High Accuracy</Text>
          </TouchableOpacity>
          {/* Inline background tracking toggle */}
          <View style={styles.bgToggleInline}>
            <Icon
              name={bgTrackingEnabled ? 'shield-checkmark' : 'shield-outline'}
              size={13}
              color={bgTrackingEnabled ? ATHLEO_COLORS.accent : ATHLEO_COLORS.muted}
            />
            <Text style={[styles.sensorChipText, {color: bgTrackingEnabled ? ATHLEO_COLORS.accent : ATHLEO_COLORS.muted}]}>
              {bgTrackingEnabled ? '24/7 On' : 'BG Off'}
            </Text>
            <Switch
              value={bgTrackingEnabled}
              onValueChange={toggleBackgroundTracking}
              trackColor={{false: 'rgba(255,255,255,0.12)', true: ATHLEO_COLORS.accent}}
              thumbColor={bgTrackingEnabled ? '#060A0F' : '#FFFFFF'}
              style={{transform: [{scale: 0.75}], marginLeft: -4}}
            />
          </View>
        </View>

        {/* ─── Running Track: shown only while tracking is active ─── */}
        {(isActive || speedKmh > 0.5) && (
          <SatisfyingRunningTrack
            speedKmh={speedKmh}
            distanceKm={distanceKm}
            isRunning={isActive}
          />
        )}

        {/* ─── Hero ring card ─── */}
        <AppCard style={styles.heroCard}>
          <View style={styles.ringWrap}>
            <StepRing
              progress={stepsProgress}
              steps={steps}
              goal={stepGoal}
              size={220}
              isActive={isActive}
              color={modeColor}
            />
          </View>

          <Animated.View
            style={[
              styles.statusBadge,
              {
                backgroundColor: `${modeColor}1A`,
                borderColor: `${modeColor}60`,
                opacity: glowAnim.interpolate({inputRange: [0.55, 1], outputRange: [0.9, 1]}),
              },
            ]}>
            {isActive && (
              <Animated.View
                style={[
                  styles.statusDot,
                  {backgroundColor: modeColor, transform: [{scale: glowAnim}]},
                ]}
              />
            )}
            <Text style={[styles.statusText, {color: modeColor}]}>{statusText(mode)}</Text>
          </Animated.View>
        </AppCard>

        {/* ─── Real-time Metrics row (Distance, Calories, Speed) ─── */}
        <View style={styles.metricsRow}>
          <AppCard style={styles.metricCard}>
            <Icon name="navigate-outline" size={16} color={ATHLEO_COLORS.muted} />
            <Text style={styles.metricLabel} delay={60}>Distance</Text>
            <Text style={styles.metricValue}>{distanceKm.toFixed(2)}</Text>
            <Text style={styles.metricUnit}>km</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Icon name="flame-outline" size={16} color="#FF7A59" />
            <Text style={styles.metricLabel} delay={120}>Calories</Text>
            <Text style={styles.metricValue}>{calories}</Text>
            <Text style={styles.metricUnit}>kcal</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Icon name="speedometer-outline" size={16} color={ATHLEO_COLORS.accent} />
            <Text style={styles.metricLabel} delay={180}>Speed</Text>
            <Text style={styles.metricValue}>{speedKmh.toFixed(1)}</Text>
            <Text style={styles.metricUnit}>km/h</Text>
          </AppCard>
        </View>

        {/* ─── Active Calorie Burn ─── */}
        <AppCard style={styles.calorieFlameCard}>
          <View style={styles.calorieCardHeader}>
            <View style={styles.calTagRow}>
              <Icon name="flame" size={14} color="#FF7A00" />
              <Text style={styles.calTagText}>Active Burn</Text>
            </View>
            <Text style={styles.calTagSub}>Tap to stoke</Text>
          </View>
          <SatisfyingCalorieFlame
            calories={calories}
            target={Math.round(stepGoal * 0.04)}
            size={120}
            interactive={true}
            showDetails={true}
          />
        </AppCard>

        {/* ─── Step Goal Selection & Notifications ─── */}
        <AppCard style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalTitle}>Step Target Goal</Text>
              <Text style={styles.goalSub}>Triggers 50% & 100% milestone notifications</Text>
            </View>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{stepGoal.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.goalPresetsRow}>
            {PRESET_GOALS.map(preset => {
              const selected = stepGoal === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.goalPresetChip, selected && styles.goalPresetChipActive]}
                  onPress={() => handleSelectGoal(preset)}
                  activeOpacity={0.75}>
                  <Text style={[styles.goalPresetText, selected && styles.goalPresetTextActive]}>
                    {(preset / 1000).toFixed(0)}k
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AppCard>


        {/* ─── Weekly Performance Report Card & Notification Button ─── */}
        <AppCard style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <View>
              <Text style={styles.weeklyEyebrow}>WEEKLY INSIGHTS</Text>
              <Text style={styles.weeklyTitle}>Athlete Movement Report</Text>
            </View>
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeBadgeText}>Grade {weekly.weekGrade}</Text>
            </View>
          </View>

          {/* 7-Day Animated Movement Trend */}
          <SatisfyingBarChart
            data={weeklyChartData}
            unit="steps"
            height={130}
            barColor={ATHLEO_COLORS.accent}
            showPeakBeacon={true}
          />

          <View style={styles.weeklyStatsGrid}>
            <View style={styles.weeklyStatBox}>
              <Text style={styles.weeklyStatVal}>{weekly.totalSteps.toLocaleString()}</Text>
              <Text style={styles.weeklyStatLbl}>Total Steps</Text>
            </View>
            <View style={styles.weeklyStatBox}>
              <Text style={styles.weeklyStatVal}>{((weekly.totalSteps * 0.762) / 1000).toFixed(1)} km</Text>
              <Text style={styles.weeklyStatLbl}>Total Dist</Text>
            </View>
            <View style={styles.weeklyStatBox}>
              <Text style={styles.weeklyStatVal}>{Math.round(weekly.caloriesBurned)}</Text>
              <Text style={styles.weeklyStatLbl}>Active kcal</Text>
            </View>
            <View style={styles.weeklyStatBox}>
              <Text style={styles.weeklyStatVal}>{streak} Days</Text>
              <Text style={styles.weeklyStatLbl}>Streak</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.weeklyNotifBtn}
            onPress={handleTriggerWeeklyReport}
            activeOpacity={0.82}>
            <Icon name="notifications-outline" size={16} color="#060A0F" style={{marginRight: 6}} />
            <Text style={styles.weeklyNotifBtnText}>Send Weekly Report Notification</Text>
          </TouchableOpacity>
        </AppCard>

      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.background,
  },
  content: {
    padding: ATHLEO_SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 96 : 68,
    paddingBottom: TAB_BAR_BOTTOM_PADDING + 28,
  },
  cardsContainer: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  headerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ATHLEO_COLORS.accent,
  },
  eyebrow: {
    color: ATHLEO_COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  ctaButton: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    shadowColor: ATHLEO_COLORS.accent,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 0},
  },
  ctaButtonPause: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
  },
  ctaText: {
    color: '#071F12',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  bgToggleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
    backgroundColor: '#0F3820',
  },
  sensorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sensorChipOk: {
    backgroundColor: `${ATHLEO_COLORS.accent}20`,
    borderColor: `${ATHLEO_COLORS.accent}65`,
  },
  dbChip: {
    backgroundColor: 'rgba(122, 183, 255, 0.15)',
    borderColor: 'rgba(122, 183, 255, 0.5)',
  },
  sensorChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: ATHLEO_COLORS.accent,
  },
  bgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#0F3820',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  bgCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  bgIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(184, 255, 77, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgIconWrapActive: {
    backgroundColor: `${ATHLEO_COLORS.accent}30`,
  },
  bgTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bgDesc: {
    color: '#E0FFE8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    fontWeight: '600',
  },
  heroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    gap: 18,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsNumber: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
    color: '#FFFFFF',
  },
  stepsLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  goalLabel: {
    color: '#E0FFE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricUnit: {
    color: '#D4FFB2',
    fontSize: 13,
    fontWeight: '700',
  },
  goalCard: {
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  goalSub: {
    color: '#E0FFE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  goalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${ATHLEO_COLORS.accent}25`,
  },
  goalBadgeText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  goalPresetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalPresetChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
    backgroundColor: '#0F3820',
    alignItems: 'center',
  },
  goalPresetChipActive: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderColor: ATHLEO_COLORS.accent,
  },
  goalPresetText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  goalPresetTextActive: {
    color: '#071F12',
    fontWeight: '900',
  },
  profileSavedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0F3820',
  },
  profileSavedIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSavedTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  profileSavedDesc: {
    color: '#E0FFE8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  weeklyCard: {
    padding: 18,
    borderRadius: 20,
    gap: 14,
    backgroundColor: '#0D331D',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyEyebrow: {
    color: ATHLEO_COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  weeklyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${ATHLEO_COLORS.accent}20`,
    borderWidth: 1,
    borderColor: `${ATHLEO_COLORS.accent}55`,
  },
  gradeBadgeText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  weeklyStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  weeklyStatBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0F3820',
    alignItems: 'center',
  },
  weeklyStatVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  weeklyStatLbl: {
    color: '#D4FFB2',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  weeklyNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ATHLEO_COLORS.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  weeklyNotifBtnText: {
    color: '#071F12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  calorieFlameCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 56, 30, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  calorieCardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  calTagText: {
    color: '#B8FF4D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  calTagSub: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
