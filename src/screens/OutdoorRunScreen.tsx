/**
 * OutdoorRunScreen.tsx — GPS-tracked outdoor run.
 *
 * Tracking model
 * --------------
 * The timer is the single source of truth for elapsed time (`elapsedRef`), and
 * every derived number is computed from it plus the accumulated GPS distance.
 * The previous version computed pace and calories inside the `watchPosition`
 * callback from a captured `elapsed` state value — because the watch is only
 * registered once, that closure froze at 0 and pace/calories never moved.
 *
 * Nothing here is synthesised: distance, pace and the route come from real GPS
 * fixes, steps come from the device's own step sensor via dailyTracker, and the
 * "zone" is a real pace zone. There is no heart-rate sensor in this app, so no
 * bpm figure is invented.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Image, LayoutChangeEvent, StyleSheet, TouchableOpacity, View} from 'react-native';
import Svg, {Circle, Polyline} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {getActiveStepSource} from '../services/activityTracker';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {getUserProfile} from '../services/userProfile';
import {
  addCaloriesBurned,
  flushMirrorToHistory,
  getSteps,
  incrementWorkoutsCompleted,
  subscribe,
} from '../services/dailyTracker';
import {requestLocationPermission} from '../services/permissionsService';

let Geolocation: any = null;
try {
  Geolocation = require('@react-native-community/geolocation').default;
} catch {
  Geolocation = null;
}

let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch {}

const triggerHaptic = (type: string = 'impactLight') => {
  try {
    ReactNativeHapticFeedback?.trigger(type, {enableVibrateFallback: true});
  } catch {}
};

// ─── Geo helpers ─────────────────────────────────────────────────────────────

/** Great-circle distance in km. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) * Math.sin(dL / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dO / 2) *
      Math.sin(dO / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** MET value used for the distance-based calorie estimate. */
const RUN_MET = 8;
/** Fixes worse than this are too noisy to measure distance from. */
const MAX_ACCURACY_METERS = 20;
/** Ignore tiny movement jitter while standing still. */
const MIN_MOVE_METERS = 2.5;
/** Cap on stored route points (a 3 h run at 1 fix/2 s still fits comfortably). */
const MAX_ROUTE_POINTS = 5000;

type RunState = 'idle' | 'running' | 'paused' | 'finished';
type RoutePoint = {lat: number; lon: number; ts: number};

// ─── Pace zones ──────────────────────────────────────────────────────────────

type PaceZone = {label: string; color: string};

const PACE_ZONES: {maxMinPerKm: number; zone: PaceZone}[] = [
  {maxMinPerKm: 4.75, zone: {label: 'Zone 5', color: '#FF4444'}},
  {maxMinPerKm: 5.5, zone: {label: 'Zone 4', color: '#FF8C00'}},
  {maxMinPerKm: 6.5, zone: {label: 'Zone 3', color: '#FFB020'}},
  {maxMinPerKm: 7.5, zone: {label: 'Zone 2', color: '#3AB4FF'}},
  {maxMinPerKm: Infinity, zone: {label: 'Zone 1', color: ATHLEO_COLORS.accent}},
];

function paceZone(minPerKm: number): PaceZone {
  return PACE_ZONES.find(entry => minPerKm < entry.maxMinPerKm)!.zone;
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function formatPace(minPerKm: number): string {
  if (!minPerKm || !isFinite(minPerKm) || minPerKm > 60) {return '--:--';}
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Route trace ─────────────────────────────────────────────────────────────

/**
 * Draws the *actual* recorded points, scaled to fit the card.
 * The previous version scattered decorative dots at `(i * 5) % 90 %` — a fake
 * pattern that never resembled where the user had been.
 */
function RouteTrace({route}: {route: RoutePoint[]}) {
  const [size, setSize] = useState({width: 0, height: 0});

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setSize({width, height});
  }, []);

  const projected = useMemo(() => {
    if (route.length < 2 || size.width <= 0 || size.height <= 0) {return null;}

    const pad = 18;
    const usableW = Math.max(1, size.width - pad * 2);
    const usableH = Math.max(1, size.height - pad * 2);

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    route.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    });

    const latSpan = Math.max(maxLat - minLat, 1e-6);
    const lonSpan = Math.max(maxLon - minLon, 1e-6);

    // Uniform scale so the trace keeps its real shape instead of stretching.
    const scale = Math.min(usableW / lonSpan, usableH / latSpan);

    const toXY = (point: RoutePoint) => ({
      x: pad + (point.lon - minLon) * scale + (usableW - lonSpan * scale) / 2,
      // Latitude grows northwards, the SVG y-axis grows downwards.
      y: pad + (maxLat - point.lat) * scale + (usableH - latSpan * scale) / 2,
    });

    const coords = route.map(toXY);
    return {
      points: coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      start: coords[0],
      end: coords[coords.length - 1],
    };
  }, [route, size]);

  return (
    <View style={styles.mapGrid} onLayout={onLayout}>
      {projected ? (
        <Svg width={size.width} height={size.height}>
          <Polyline
            points={projected.points}
            fill="none"
            stroke={ATHLEO_COLORS.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={projected.start.x} cy={projected.start.y} r={5} fill="#3AB4FF" />
          <Circle cx={projected.end.x} cy={projected.end.y} r={5} fill={ATHLEO_COLORS.accent} />
        </Svg>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Icon name="map-outline" size={32} color={ATHLEO_COLORS.muted} />
          <Text style={styles.mapPlaceholderText}>
            Your route appears here once GPS locks on.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OutdoorRunScreen() {
  const [runState, setRunState] = useState<RunState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [avgPace, setAvgPace] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'pending' | 'locked' | 'denied' | 'weak'>('pending');
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [sessionSteps, setSessionSteps] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  // Mirrors of state that the GPS callback needs. Reading state directly inside
  // that callback captured the values from the render it was registered in.
  const elapsedRef = useRef(0);
  const distanceRef = useRef(0);
  const routeRef = useRef<RoutePoint[]>([]);
  const lastPointRef = useRef<RoutePoint | null>(null);
  const sessionStartStepsRef = useRef(0);
  const disappearedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const weightKg = useRef(Math.max(40, getUserProfile().weightKg || 72)).current;

  const stopGpsWatch = useCallback(() => {
    if (gpsWatchRef.current !== null && Geolocation) {
      try {Geolocation.clearWatch(gpsWatchRef.current);} catch {/* ignore */}
    }
    gpsWatchRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {clearInterval(timerRef.current);}
    timerRef.current = null;
  }, []);

  // Live steps come from the device sensor, not from the run distance.
  useEffect(() => {
    return subscribe('steps', value => {
      if (disappearedRef.current) {return;}
      setSessionSteps(Math.max(0, value - sessionStartStepsRef.current));
    });
  }, []);

  // Pulse animation for live indicator
  useEffect(() => {
    if (runState === 'running') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.2, duration: 600, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [runState, pulseAnim]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disappearedRef.current = true;
      stopTimer();
      stopGpsWatch();
    };
  }, [stopTimer, stopGpsWatch]);

  const startGPS = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setGpsStatus('denied');
      Alert.alert(
        'Location Required',
        'Enable location permission to track your outdoor run with GPS.',
        [{text: 'OK'}],
      );
      return;
    }

    if (!Geolocation) {
      setGpsStatus('weak');
      return;
    }

    stopGpsWatch();
    lastPointRef.current = null;
    setGpsStatus('pending');

    gpsWatchRef.current = Geolocation.watchPosition(
      (pos: any) => {
        if (disappearedRef.current) {return;}

        const accuracy = pos.coords.accuracy ?? 999;
        const point: RoutePoint = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          ts: Date.now(),
        };
        const previous = lastPointRef.current;

        if (accuracy > MAX_ACCURACY_METERS) {
          setGpsStatus('weak');
          return;
        }

        let computedDistanceMeters = 0;
        let computedSpeedKmh = 0;

        if (previous) {
          const deltaKm = haversineKm(previous.lat, previous.lon, point.lat, point.lon);
          const deltaMeters = deltaKm * 1000;
          const deltaSeconds = Math.max((point.ts - previous.ts) / 1000, 1);

          if (deltaMeters >= MIN_MOVE_METERS) {
            computedDistanceMeters = deltaMeters;
            const measuredSpeed = (deltaMeters / deltaSeconds) * 3.6;
            const nativeSpeed = pos.coords.speed != null ? pos.coords.speed * 3.6 : measuredSpeed;
            computedSpeedKmh = Number.isFinite(nativeSpeed) ? nativeSpeed : measuredSpeed;
            distanceRef.current += computedDistanceMeters;
            routeRef.current = [...routeRef.current, point].slice(-MAX_ROUTE_POINTS);
          }
        } else {
          routeRef.current = [...routeRef.current, point];
        }

        lastPointRef.current = point;

        setGpsStatus('locked');
        const seconds = Math.max(1, elapsedRef.current);
        const distance = distanceRef.current;

        const speedFromDistance = distance > 0 && seconds > 0 ? (distance / 1000 / (seconds / 3600)) : 0;
        const smoothedSpeed = computedSpeedKmh > 0 ? computedSpeedKmh : speedFromDistance;
        const currentSpeedKmh = smoothedSpeed > 0 ? Math.min(smoothedSpeed, 60) : 0;
        const currentPaceMinPerKm = currentSpeedKmh > 0 ? 60 / currentSpeedKmh : 0;
        const avgPaceMinPerKm = distance > 0.01 ? seconds / 60 / (distance / 1000) : 0;

        setDistanceKm(Number(distance / 1000).toFixed(2) ? Number((distance / 1000).toFixed(2)) : 0);
        setRoute(routeRef.current);
        setSpeedKmh(currentSpeedKmh > 0 ? Number(currentSpeedKmh.toFixed(1)) : 0);
        setCurrentPace(currentPaceMinPerKm);
        setAvgPace(avgPaceMinPerKm);
        setCaloriesBurned(Math.round(RUN_MET * weightKg * (seconds / 3600)));
      },
      (err: any) => {
        if (disappearedRef.current) {return;}
        console.warn('GPS error:', err);
        setGpsStatus(err?.code === 1 ? 'denied' : 'weak');
      },
      {enableHighAccuracy: true, distanceFilter: 1, interval: 1000, fastestInterval: 500},
    );
  }, [stopGpsWatch, weightKg]);

  const startRun = useCallback(async () => {
    setRunState('running');
    setElapsed(0);
    setDistanceKm(0);
    setRoute([]);
    setCaloriesBurned(0);
    setCurrentPace(0);
    setAvgPace(0);
    setSpeedKmh(0);
    elapsedRef.current = 0;
    distanceRef.current = 0;
    routeRef.current = [];
    lastPointRef.current = null;
    sessionStartStepsRef.current = getSteps();
    setSessionSteps(0);
    triggerHaptic('impactHeavy');

    stopTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);

    await startGPS();
  }, [startGPS, stopTimer]);

  const pauseRun = useCallback(() => {
    setRunState('paused');
    triggerHaptic('impactMedium');
    stopTimer();
    stopGpsWatch();
  }, [stopGpsWatch, stopTimer]);

  const resumeRun = useCallback(async () => {
    setRunState('running');
    triggerHaptic('impactMedium');
    stopTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    await startGPS();
  }, [startGPS, stopTimer]);

  const finishRun = useCallback(() => {
    setRunState('finished');
    triggerHaptic('notificationSuccess');
    stopTimer();
    stopGpsWatch();

    const seconds = elapsedRef.current;
    const distance = distanceRef.current;

    // The step sensor already converts every counted step into burned calories,
    // so adding the MET estimate on top would count the same effort twice.
    if (getActiveStepSource() === 'none' && caloriesBurned > 0) {
      addCaloriesBurned(caloriesBurned);
    }
    incrementWorkoutsCompleted();
    flushMirrorToHistory();

    Alert.alert(
      'Run Complete',
      `Distance: ${distance.toFixed(2)} km\nTime: ${formatTime(seconds)}\nAvg pace: ${formatPace(
        distance > 0.01 ? seconds / 60 / distance : 0,
      )} /km`,
      [{text: 'Nice'}],
    );
  }, [caloriesBurned, stopGpsWatch, stopTimer]);

  const resetRun = useCallback(() => {
    setRunState('idle');
    setElapsed(0);
    setDistanceKm(0);
    setRoute([]);
    setCaloriesBurned(0);
    setCurrentPace(0);
    setAvgPace(0);
    setSpeedKmh(0);
    setSessionSteps(0);
    setGpsStatus('pending');
    elapsedRef.current = 0;
    distanceRef.current = 0;
    routeRef.current = [];
    lastPointRef.current = null;
  }, []);

  const zone = useMemo(
    () => (currentPace > 0 ? paceZone(currentPace) : {label: 'Zone --', color: ATHLEO_COLORS.muted}),
    [currentPace],
  );

  const gpsLabel =
    gpsStatus === 'locked'
      ? 'GPS live'
      : gpsStatus === 'denied'
      ? 'GPS denied'
      : gpsStatus === 'weak'
      ? 'GPS weak'
      : 'Acquiring GPS…';

  const gpsColor =
    gpsStatus === 'locked'
      ? ATHLEO_COLORS.accent
      : gpsStatus === 'denied'
      ? '#FF4444'
      : '#FFB020';

  return (
    <View style={styles.screen}>
      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <View style={styles.gpsRow}>
            <Animated.View
              style={[styles.gpsDot, {transform: [{scale: pulseAnim}], backgroundColor: gpsColor}]}
            />
            <Text style={styles.gpsLabel}>{gpsLabel}</Text>
            <Text style={styles.routePts}>{sessionSteps.toLocaleString()} steps</Text>
          </View>
          <View style={[styles.zonePill, {borderColor: zone.color}]}>
            <Text style={[styles.zoneText, {color: zone.color}]}>{zone.label}</Text>
          </View>
        </View>

        {/* ── Hero Banner (idle only) ── */}
        {runState === 'idle' && (
          <View style={styles.runHeroBanner}>
            <Image
              source={require('../assets/images/running-shoes.png')}
              style={styles.runHeroImg}
              resizeMode="contain"
            />
            <View style={styles.runHeroText}>
              <Text style={styles.runHeroTitle}>Outdoor Run</Text>
              <Text style={styles.runHeroSub}>GPS-tracked · Real-time pace · Calories</Text>
            </View>
          </View>
        )}

        {/* ── Route ── */}
        <View style={styles.mapCard}>
          <RouteTrace route={route} />
          <View style={styles.mapBadgeRow} pointerEvents="none">
            <Text style={styles.mapBadge}>ROUTE</Text>
            {runState === 'running' && (
              <View style={styles.liveTag}>
                <Animated.View style={[styles.liveDot, {transform: [{scale: pulseAnim}]}]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── AI Coach ── */}
        <AppCard style={styles.aiCard}>
          <View style={styles.aiRow}>
            <Image
              source={require('../assets/images/heart-beat.png')}
              style={styles.aiHeartImg}
              resizeMode="contain"
            />
            <View style={styles.aiTextWrap}>
              <Text style={styles.aiLabel}>Athena AI Coach</Text>
              <Text style={styles.aiText}>
                {runState === 'idle'
                  ? '"Ready when you are. GPS will lock in a few seconds."'
                  : runState === 'running'
                  ? `"Pace is ${formatPace(currentPace)} min/km at ${speedKmh.toFixed(1)} km/h. ${
                      distanceKm < 1 ? 'Warm-up phase' : distanceKm < 3 ? 'Finding your rhythm' : 'Strong effort — maintain form'
                    }."`
                  : runState === 'paused'
                  ? '"Paused. Hydrate and stretch before resuming."'
                  : `"Great run — ${distanceKm.toFixed(2)} km done. Recovery window: about 24 h."`}
              </Text>
            </View>
          </View>
        </AppCard>

        {/* ── Hero Timer ── */}
        <AppCard style={styles.heroTimer}>
          <Text style={styles.muted}>Elapsed Time</Text>
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          <Text
            style={[
              styles.sessionText,
              {
                color:
                  runState === 'running'
                    ? ATHLEO_COLORS.accent
                    : runState === 'paused'
                    ? '#FFB020'
                    : ATHLEO_COLORS.muted,
              },
            ]}>
            {runState === 'idle'
              ? 'Ready to run'
              : runState === 'running'
              ? 'Session in progress'
              : runState === 'paused'
              ? 'Paused'
              : 'Finished'}
          </Text>
        </AppCard>

        {/* ── Metrics Grid ── */}
        <View style={styles.metricGrid}>
          <AppCard style={styles.metricCell}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>
              {distanceKm.toFixed(2)}<Text style={styles.unit}> km</Text>
            </Text>
          </AppCard>
          <AppCard style={styles.metricCell}>
            <Text style={styles.metricLabel}>Current Pace</Text>
            <Text style={styles.metricValue}>
              {formatPace(currentPace)}<Text style={styles.unit}> /km</Text>
            </Text>
          </AppCard>
          <AppCard style={styles.metricCell}>
            <Text style={styles.metricLabel}>Avg Pace</Text>
            <Text style={styles.metricValue}>
              {formatPace(avgPace)}<Text style={styles.unit}> /km</Text>
            </Text>
          </AppCard>
          <AppCard style={styles.metricCell}>
            <Text style={styles.metricLabel}>Calories</Text>
            <Text style={styles.metricValue}>
              {caloriesBurned}<Text style={styles.unit}> kcal</Text>
            </Text>
          </AppCard>
        </View>

        <Text style={styles.footNote}>
          Distance, pace and the route come from live GPS fixes. Steps come from your device's own
          step sensor.
        </Text>
      </SmoothScrollView>

      {/* ── Controls (outside the scroll view so they are always reachable) ── */}
      <View style={styles.controls}>
        {runState === 'idle' && (
          <TouchableOpacity style={styles.mainBtn} onPress={startRun}>
            <Icon name="play" size={22} color={ATHLEO_COLORS.background} />
            <Text style={styles.mainBtnText}>START RUN</Text>
          </TouchableOpacity>
        )}
        {runState === 'running' && (
          <>
            <TouchableOpacity style={[styles.mainBtn, styles.pauseBtn]} onPress={pauseRun}>
              <Icon name="pause" size={22} color={ATHLEO_COLORS.background} />
              <Text style={styles.mainBtnText}>PAUSE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mainBtn, styles.stopBtn]} onPress={finishRun}>
              <Icon name="stop" size={22} color="#FFF" />
              <Text style={[styles.mainBtnText, {color: '#FFF'}]}>FINISH</Text>
            </TouchableOpacity>
          </>
        )}
        {runState === 'paused' && (
          <>
            <TouchableOpacity style={styles.mainBtn} onPress={resumeRun}>
              <Icon name="play" size={22} color={ATHLEO_COLORS.background} />
              <Text style={styles.mainBtnText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mainBtn, styles.stopBtn]} onPress={finishRun}>
              <Icon name="checkmark" size={22} color="#FFF" />
              <Text style={[styles.mainBtnText, {color: '#FFF'}]}>FINISH</Text>
            </TouchableOpacity>
          </>
        )}
        {runState === 'finished' && (
          <TouchableOpacity style={styles.mainBtn} onPress={resetRun}>
            <Icon name="refresh" size={22} color={ATHLEO_COLORS.background} />
            <Text style={styles.mainBtnText}>NEW RUN</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING + 16, gap: ATHLEO_SPACING.md},
  topBar: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  gpsRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  gpsDot: {width: 8, height: 8, borderRadius: 4},
  gpsLabel: {color: ATHLEO_COLORS.text, fontSize: 12, fontWeight: '700'},
  routePts: {color: ATHLEO_COLORS.muted, fontSize: 11},
  zonePill: {borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1},
  zoneText: {fontSize: 11, fontWeight: '800', letterSpacing: 1},
  mapCard: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F1214',
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    position: 'relative',
  },
  mapGrid: {flex: 1},
  mapPlaceholder: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24},
  mapPlaceholderText: {color: ATHLEO_COLORS.muted, fontSize: 12, textAlign: 'center'},
  mapBadgeRow: {position: 'absolute', left: 12, top: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  mapBadge: {backgroundColor: 'rgba(10,12,14,0.85)', color: ATHLEO_COLORS.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, letterSpacing: 1.5, fontWeight: '800'},
  liveTag: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(10,12,14,0.85)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5},
  liveDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4444'},
  liveText: {color: '#FF4444', fontSize: 9, fontWeight: '800', letterSpacing: 1.5},
  aiCard: {paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16},
  aiRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  aiHeartImg: {width: 36, height: 36, flexShrink: 0},
  aiIcon: {width: 36, height: 36, borderRadius: 10, backgroundColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center'},
  aiIconText: {color: '#111', fontSize: 16, fontWeight: '800'},
  aiTextWrap: {flex: 1},
  aiLabel: {color: ATHLEO_COLORS.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700'},
  aiText: {color: ATHLEO_COLORS.text, fontSize: 12, marginTop: 4, lineHeight: 18},
  runHeroBanner: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E1A11', borderRadius: 18, padding: 16, gap: 14, borderWidth: 1, borderColor: 'rgba(184,255,77,0.2)'},
  runHeroImg: {width: 56, height: 56},
  runHeroText: {flex: 1},
  runHeroTitle: {color: ATHLEO_COLORS.text, fontSize: 20, fontWeight: '800'},
  runHeroSub: {color: ATHLEO_COLORS.muted, fontSize: 12, marginTop: 3},
  heroTimer: {padding: 18, borderRadius: 18, alignItems: 'center'},
  muted: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase'},
  timer: {fontSize: 46, fontWeight: '800', color: ATHLEO_COLORS.text, marginTop: 6},
  sessionText: {fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, fontWeight: '700'},
  metricGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  metricCell: {width: '48%', padding: 14, borderRadius: 14},
  metricLabel: {color: ATHLEO_COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase'},
  metricValue: {color: ATHLEO_COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 8},
  unit: {fontSize: 11, color: ATHLEO_COLORS.muted},
  footNote: {color: ATHLEO_COLORS.muted, fontSize: 11, lineHeight: 16},
  controls: {flexDirection: 'row', gap: 10, paddingHorizontal: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING + 12, paddingTop: 10},
  mainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 16,
    shadowColor: ATHLEO_COLORS.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: {width: 0, height: 0},
  },
  pauseBtn: {backgroundColor: '#FFB020', shadowColor: '#FFB020'},
  stopBtn: {backgroundColor: '#1E1E22', borderWidth: 1, borderColor: '#FF4444', shadowColor: '#FF4444'},
  mainBtnText: {color: ATHLEO_COLORS.background, fontWeight: '800', fontSize: 13, letterSpacing: 1},
});
