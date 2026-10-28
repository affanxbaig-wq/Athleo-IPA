/**
 * AppNavigator — Primary navigation shell for Athleo
 *
 * ═══════════════════════════════════════════════════════════════
 * COMPREHENSIVE FIX LOG — this session
 * ═══════════════════════════════════════════════════════════════
 *
 * Crash fixes:
 *  R1  Stale closure bug: handleAuthSuccess and handleSignOut are now
 *      stabilized with useCallback + correct deps AND exposed via refs.
 *      screenContent useMemo reads from refs → never captures stale values.
 *  R2  WelcomeLoginScreen remount: onContinue / onNewUser are now stable
 *      refs that screenContent useMemo can reference without re-creating
 *      the element on every render.
 *  G3  JellyCapsule elevation removed (inside overflow:hidden, elevation was
 *      clipped anyway and caused Android shadow-tree warnings).
 *  G4  Capsule stretch math now accounts for padding correctly — uses
 *      raw slot width for position math and subtracts inset for displayed width.
 *  G5  renderToHardwareTextureAndroid applied to JellyCapsule for GPU offload.
 *
 * Navigation fixes:
 *  N2  Auth listener token-refresh guard: if the app already has an
 *      authenticated tab active, a silent token refresh won't re-navigate.
 *  N3  tabContentWidth + tabBarKnownWidth merged into a single state batch
 *      (one re-render instead of two on first layout).
 *  N4  navigate() and handleTabSelectCallback() consolidated into one function.
 *  N5  parentMap moved to module-level constant — no inline object on every render.
 *
 * Previously applied fixes (retained):
 *  C1  Stale PanResponder closure → handleTabSelectRef.
 *  C2  JellyCapsule always mounted, opacity:0 until width known.
 *  C3  No duplicate onLayout.
 *  N1  Platform-aware back button top offset.
 *
 * Jelly physics enhancements:
 *  •   3-stage spring: compress → overshoot → settle.
 *  •   Bezier easing on compress phase mimics rubber deformation.
 *  •   Area-conservation scaleX/scaleY (squish one axis, expand the other).
 *  •   Specular brightness pulses with wobble intensity.
 *  •   Shimmer sweep animation on tab activation (JS thread — capsule already
 *      uses JS driver for width/position).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import {FabTabBar} from '../components/FabTabBar';
import {DynamicIslandTimer} from '../components/DynamicIslandTimer';
import {DashboardScreen} from '../screens/DashboardScreen';
import {WelcomeLoginScreen} from '../screens/WelcomeLoginScreen';
import {SignUpScreen} from '../screens/SignUpScreen';
import {WorkoutScreen} from '../screens/WorkoutScreen';
import {AICoachScreen} from '../screens/AICoachScreen';
import {ChallengesScreen} from '../screens/ChallengesScreen';
import {SmartGymScreen} from '../screens/SmartGymScreen';
import {PlanRevealScreen} from '../screens/PlanRevealScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {EditProfileScreen} from '../screens/EditProfileScreen';
import {CustomWorkoutBuilderScreen} from '../screens/CustomWorkoutBuilderScreen';
import {ExerciseBiomechanicsScreen} from '../screens/ExerciseBiomechanicsScreen';
import {OutdoorRunScreen} from '../screens/OutdoorRunScreen';
import {PedometerScreen} from '../screens/PedometerScreen';
import {HealthRecoveryScreen} from '../screens/HealthRecoveryScreen';
import {HealthActivityScreen} from '../screens/HealthActivityScreen';
import {SocialFeedScreen} from '../screens/SocialFeedScreen';
import {OnboardingScreen} from '../screens/OnboardingScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PaywallScreen} from '../screens/PaywallScreen';
import {SplashVideoScreen} from '../components/SplashVideoScreen';
import {getSupabaseClient} from '../services/auth';
import {isSupabaseConfigured} from '../config/supabase';
import {ATHLEO_COLORS} from '../theme/theme';
import {appStorage} from '../services/storage';
import {upsertUserProfile, fetchUserProfile, cacheUserLocally, markOnboardingComplete} from '../services/profileSync';
import {getCachedOnboardingComplete} from '../services/profileSync';
import {resetIfNewDay} from '../services/dailyTracker';
import {startActivityTracking, stopActivityTracking} from '../services/activityTracker';
import {resetUserDataForNewUser} from '../services/userDataReset';
import {hydrateDeviceBoundAuthState, registerTrustedDeviceForUser} from '../services/deviceAuth';
import {isHighEndDevice} from '../services/deviceCapability';
import {signOutGoogle} from '../services/googleAuth';

/**
 * Which account the locally stored profile belongs to.
 *
 * `isProfileComplete()` only says whether *someone* finished onboarding on this
 * device — never **who** finished it. Without this binding the next account that
 * signs in inherits the previous user's answers, `isProfileComplete()` reports
 * true, and that user is dropped on Home without ever being asked a single
 * onboarding question.
 */
const PROFILE_OWNER_KEY = 'athleo_profile_owner';

/**
 * Binds the device's local profile to `userId` and reports whether it may be
 * reused. Returns `true` when the stored profile must NOT be trusted for this
 * account — it belongs to a different account (wiped first, so no user's data
 * leaks into another's) or was never bound to one. Either way onboarding runs.
 */
function claimProfileForAccount(userId: string): boolean {
  const owner = appStorage.getString(PROFILE_OWNER_KEY);

  if (owner === userId) {
    return false;
  }

  if (owner != null) {
    resetUserDataForNewUser();
  }

  appStorage.setString(PROFILE_OWNER_KEY, userId);
  return true;
}

export type TabKey =
  | 'welcome'
  | 'signup'
  | 'onboarding'
  | 'home'
  | 'workouts'
  | 'profile'
  | 'editProfile'
  | 'settings'
  | 'ai'
  | 'challenges'
  | 'gym'
  | 'plan'
  | 'builder'
  | 'technique'
  | 'outdoor'
  | 'pedometer'
  | 'health'
  | 'recovery'
  | 'activity'
  | 'community'
  | 'notifications'
  | 'paywall';

const MAIN_TABS: TabKey[] = ['home', 'workouts', 'ai', 'profile'];

// N1 Fix: Platform-aware back-button top offset so it never overlaps screen headers
const BACK_BUTTON_TOP = Platform.OS === 'ios' ? 54 : 20;

// N5 Fix: parentMap at module level — not re-created on every render
const PARENT_TAB_MAP: Partial<Record<TabKey, TabKey>> = {
  signup:        'welcome',
  settings:      'profile',
  editProfile:   'profile',
  notifications: 'profile',
  gym:           'workouts',
  builder:       'workouts',
  technique:     'workouts',
  outdoor:       'home',
  pedometer:     'home',
  health:        'profile',
  recovery:      'profile',
  activity:      'profile',
  community:     'home',
  challenges:    'home',
  plan:          'profile',
  paywall:       'settings',
};

// ─── AppNavigator ────────────────────────────────────────────────────────────
export function AppNavigator() {
  const [activeTab, setActiveTab] = useState<TabKey>('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [_isNewUser, setIsNewUser] = useState(false);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Resolved once per launch. Low-end Android cannot composite the frosted
  // layer stack, so the dock degrades to a flat black bar there.
  const jellyEnabled = useRef(isHighEndDevice()).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSetActiveTab = useCallback((tab: TabKey) => {
    if (isMountedRef.current) { setActiveTab(tab); }
  }, []);

  const safeSetAuthenticated = useCallback((value: boolean) => {
    if (isMountedRef.current) { setIsAuthenticated(value); }
  }, []);

  const handleSplashFinish = useCallback(() => {
    if (isMountedRef.current) {
      setSplashFinished(true);
    }
  }, []);

  // ── Global activity tracking ────────────────────────────────────────────
  // The hardware step sensor is owned here for the whole authenticated session
  // so the dashboard / pedometer counters keep moving even when the user never
  // opens the tracker screen. Idempotent + fully defensive internally.
  useEffect(() => {
    if (isAuthenticated) {
      void startActivityTracking();
    } else {
      void stopActivityTracking();
    }
  }, [isAuthenticated]);

  // ── Navigation handler ────────────────────────────────────────────────
  const handleTabSelect = useCallback((tab: TabKey) => {
    if (!isAuthenticated && tab !== 'welcome' && tab !== 'signup' && tab !== 'onboarding') {
      safeSetActiveTab('welcome');
      return;
    }
    safeSetActiveTab(tab);
  }, [isAuthenticated, safeSetActiveTab]);

  // Stable ref that screenContent useMemo and child callbacks read
  const handleTabSelectRef = useRef(handleTabSelect);
  useEffect(() => {
    handleTabSelectRef.current = handleTabSelect;
  }, [handleTabSelect]);

  // ── Auth state sync ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async () => {
      try {
        const deviceState = await hydrateDeviceBoundAuthState();

        if (!isMounted) { return; }

        if (deviceState.status === 'new-device') {
          const notice = 'New device detected. For your security, please sign in again to authorize this device.';
          if (isMounted) {
            setSecurityNotice(notice);
          }
          safeSetAuthenticated(false);
          safeSetActiveTab('welcome');
          setAuthReady(true);
          return;
        }

        if (!isSupabaseConfigured()) {
          if (isMounted) {
            const hasSeenWelcome = appStorage.getString('athleo_welcome_seen');
            if (hasSeenWelcome === 'true') {
              safeSetAuthenticated(true);
              safeSetActiveTab(getCachedOnboardingComplete() ? 'home' : 'onboarding');
            } else {
              safeSetAuthenticated(false);
              safeSetActiveTab('welcome');
            }
            setAuthReady(true);
          }
          return;
        }

        const supabase = getSupabaseClient();
        const {data: {session}} = await supabase.auth.getSession();

        if (!isMounted) { return; }

        const hasSession = Boolean(session);
        safeSetAuthenticated(hasSession);

        if (hasSession) {
          // A profile left on this device by a *different* account is wiped
          // here, so this user is actually asked the onboarding questions
          // instead of silently inheriting answers they never gave.
          const claimed = session?.user ? claimProfileForAccount(session.user.id) : true;
          const onboardingDone = getCachedOnboardingComplete();
          const onboardedForThisAccount = !claimed && onboardingDone;
          safeSetActiveTab(onboardedForThisAccount ? 'home' : 'onboarding');
        } else {
          safeSetActiveTab('welcome');
        }
      } catch (error) {
        console.error('Auth sync error:', error);
        if (isMounted) {
          safeSetAuthenticated(false);
          safeSetActiveTab('welcome');
        }
      } finally {
        if (isMounted) { setAuthReady(true); }
      }
    };

    syncAuthState();

    // Reset daily counters if it's a new day
    resetIfNewDay();

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    const authListener = supabase?.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) { return; }
      const hasSession = Boolean(session);
      safeSetAuthenticated(hasSession);

      if (!hasSession) {
        safeSetActiveTab('welcome');
      } else {
        // Claim before writing anything for this account: if the device still
        // holds another account's profile it is cleared first, and only then is
        // this user's server data cached — so no answer ever leaks across users.
        const claimed = session?.user ? claimProfileForAccount(session.user.id) : true;

        // Read onboarding status NOW, before the async upsert, so the server's
        // potentially-stale false value cannot downgrade an already-confirmed
        // local true (profileSync.ts guards against this too, but belt-and-braces).
        const onboardingAlreadyDone = getCachedOnboardingComplete();

        try {
          if (session?.user) {
            await upsertUserProfile(session.user);
            const name = session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0];
            if (name) { cacheUserLocally({displayName: name}); }
          }
        } catch { /* non-critical */ }

        setActiveTab(prev => {
          const alreadyAuthenticated = prev !== 'welcome' && prev !== 'onboarding';
          if (alreadyAuthenticated) { return prev; }
          // Use the pre-upsert snapshot OR check again (whichever is true)
          const onboardingDone = onboardingAlreadyDone || (!claimed && getCachedOnboardingComplete());
          return onboardingDone ? 'home' : 'onboarding';
        });
      }
    });

    return () => {
      isMounted = false;
      authListener?.data?.subscription?.unsubscribe?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── R1 + R2 Fix: Stable auth callback refs ──────────────────────────
  // handleAuthSuccess and handleSignOut are defined with useCallback and correct
  // deps, then exposed via refs. screenContent useMemo reads from these refs so
  // WelcomeLoginScreen props are stable objects that never cause remounts.
  const handleAuthSuccess = useCallback(async (newUser = false) => {
    if (!isMountedRef.current) { return; }
    appStorage.setString('athleo_welcome_seen', 'true');
    safeSetAuthenticated(true);
    setIsNewUser(newUser);

    // A brand-new account must start empty: the demo/previous user's locally
    // stored data is wiped here, and everything the user does afterwards is
    // written back to their own profile + progress stores.
    // Runs BEFORE the profile sync below so fresh server data is not cleared.
    if (newUser) {
      resetUserDataForNewUser();
      try { cacheUserLocally({onboardingComplete: false}); } catch { /* non-critical */ }
    }

    // Bind this device's stored profile to the account that just signed in.
    // A profile left behind by a *different* account is wiped first, so this
    // user is actually asked the onboarding questions instead of being dropped
    // on Home holding answers they never gave.

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const {data: {user}} = await supabase.auth.getUser();
        if (user) {
          claimProfileForAccount(user.id);
          await upsertUserProfile(user);
          await fetchUserProfile(user.id);
          const name = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0];
          if (name) { cacheUserLocally({displayName: name}); }

          const didRegister = await registerTrustedDeviceForUser(user.id);
          if (!didRegister) {
            console.warn('Device trust registration failed for user', user.id);
          }
        }
      }
    } catch { /* non-critical */ }

    const onboardingDone = getCachedOnboardingComplete();
    if (!onboardingDone || newUser) {
      safeSetActiveTab('onboarding');
      return;
    }
    safeSetActiveTab('home');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSetAuthenticated, safeSetActiveTab]);

  /**
   * Dedicated callback for when the onboarding questionnaire finishes.
   * Unlike handleAuthSuccess, this does NOT re-fetch the user profile from
   * Supabase — that fetch would overwrite the locally-cached onboardingComplete=true
   * with the server's stale false value (the backend write is fire-and-forget and
   * may not have landed yet), causing the navigator to loop back to onboarding.
   * Instead we pin onboardingComplete=true locally and go straight to home.
   */
  const handleOnboardingComplete = useCallback(async () => {
    if (!isMountedRef.current) { return; }
    // Pin onboarding complete both locally and to the backend (fire-and-forget)
    try {
      cacheUserLocally({onboardingComplete: true});
      appStorage.setString('athleo_welcome_seen', 'true');
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const {data: {user}} = await supabase.auth.getUser();
        if (user) {
          appStorage.setString(PROFILE_OWNER_KEY, user.id);
        }
      }
    } catch { /* non-critical */ }
    try { markOnboardingComplete().catch(() => undefined); } catch { /* non-critical */ }
    safeSetAuthenticated(true);
    safeSetActiveTab('home');
  }, [safeSetAuthenticated, safeSetActiveTab]);

  const handleSignOut = useCallback(() => {
    if (!isMountedRef.current) { return; }
    appStorage.setString('athleo_welcome_seen', 'false');
    safeSetAuthenticated(false);
    setIsNewUser(false);
    safeSetActiveTab('welcome');
    // Also drop the cached Google account, otherwise the next tap on "Continue
    // with Google" signs straight back in with it instead of showing the picker.
    signOutGoogle().catch(() => undefined);
  }, [safeSetAuthenticated, safeSetActiveTab]);

  // Stable refs so useMemo can reference them without adding to dep array
  const handleAuthSuccessRef = useRef(handleAuthSuccess);
  const handleSignOutRef = useRef(handleSignOut);
  const handleOnboardingCompleteRef = useRef(handleOnboardingComplete);
  useEffect(() => { handleAuthSuccessRef.current = handleAuthSuccess; }, [handleAuthSuccess]);
  useEffect(() => { handleSignOutRef.current = handleSignOut; }, [handleSignOut]);
  useEffect(() => { handleOnboardingCompleteRef.current = handleOnboardingComplete; }, [handleOnboardingComplete]);

  // Navigate alias (reads from ref — always current)
  const navigate = useCallback((tab: TabKey) => {
    handleTabSelectRef.current(tab);
  }, []);
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // ── N3 Fix: memoized screen render ────────────────────────────────────
  const [authPrefillEmail, setAuthPrefillEmail] = useState('');

  const handleNavigateToSignUp = useCallback(() => {
    safeSetActiveTab('signup');
  }, [safeSetActiveTab]);

  const handleNavigateToLogin = useCallback((registeredEmail?: string) => {
    if (registeredEmail) {
      setAuthPrefillEmail(registeredEmail);
    }
    safeSetActiveTab('welcome');
  }, [safeSetActiveTab]);

  const stableOnContinue = useCallback(() => handleAuthSuccessRef.current(false), []);
  const stableOnNewUser  = useCallback(() => handleAuthSuccessRef.current(true),  []);
  const stableOnSignOut  = useCallback(() => handleSignOutRef.current(),           []);
  const stableNavigate   = useCallback((tab: TabKey) => navigateRef.current(tab), []);
  const stableOnboardingComplete = useCallback(() => handleOnboardingCompleteRef.current(), []);

  const screenContent = useMemo(() => {
    switch (activeTab) {
      case 'welcome':
        return (
          <WelcomeLoginScreen
            onContinue={stableOnContinue}
            onNewUser={stableOnNewUser}
            onNavigateToSignUp={handleNavigateToSignUp}
            initialEmail={authPrefillEmail}
            securityNotice={securityNotice}
          />
        );
      case 'signup':
        return (
          <SignUpScreen
            onNavigateToLogin={handleNavigateToLogin}
          />
        );
      case 'onboarding':
        return (
          <OnboardingScreen
            onComplete={stableOnboardingComplete}
          />
        );
      case 'home':       return <DashboardScreen navigate={stableNavigate} />;
      case 'workouts':   return <WorkoutScreen navigate={stableNavigate} />;
      case 'profile':    return <ProfileScreen navigate={stableNavigate} onSignOut={stableOnSignOut} />;
      case 'editProfile': return <EditProfileScreen navigate={stableNavigate} />;
      case 'settings':   return <SettingsScreen navigate={stableNavigate} onSignOut={stableOnSignOut} />;
      case 'notifications': return <NotificationsScreen navigate={stableNavigate} />;
      case 'ai':         return <AICoachScreen />;
      case 'challenges': return <ChallengesScreen />;
      case 'gym':        return <SmartGymScreen />;
      case 'plan':       return <PlanRevealScreen />;
      case 'builder':    return <CustomWorkoutBuilderScreen />;
      case 'technique':  return <ExerciseBiomechanicsScreen />;
      case 'outdoor':    return <OutdoorRunScreen />;
      case 'pedometer':  return <PedometerScreen />;
      case 'health':
      case 'recovery':   return <HealthRecoveryScreen />;
      case 'activity':   return <HealthActivityScreen />;
      case 'community':  return <SocialFeedScreen />;
      case 'paywall':    return <PaywallScreen navigate={stableNavigate} />;
      default:           return <DashboardScreen navigate={stableNavigate} />;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authPrefillEmail, handleNavigateToSignUp, handleNavigateToLogin]);

  const showBottomTab = isAuthenticated && !['welcome', 'signup', 'onboarding'].includes(activeTab);
  const isMainTab = MAIN_TABS.includes(activeTab);


  // ── Main App Shell ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
        translucent={false}
      />
      <View style={styles.appShell}>
        {/* Active screen: mount when auth is ready AND splash has finished to prevent any mixing or resource competition */}
        {authReady && splashFinished ? screenContent : null}

        {/* Back button for sub-screens */}
        {showBottomTab && !isMainTab && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              safeSetActiveTab(PARENT_TAB_MAP[activeTab] ?? 'home');
            }}>
            <Icon name="chevron-back" size={20} color={ATHLEO_COLORS.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}

        {/* ── iOS 26 / 27 Liquid Glass FabBar with Tinted Action Button ──── */}
        {showBottomTab && (
          <FabTabBar
            activeTab={activeTab}
            onSelectTab={tab => handleTabSelectRef.current(tab)}
            onNavigate={tab => safeSetActiveTab(tab)}
            jellyEnabled={jellyEnabled}
            onReselect={tab => handleTabSelectRef.current(tab)}
          />
        )}

        {/* 2D Animated Logo Video Splash Screen */}
        {!splashFinished && (
          <SplashVideoScreen
            isAppReady={authReady}
            onFinish={handleSplashFinish}
          />
        )}
      </View>

      {/* Dynamic Island floating workout/rest timer */}
      <DynamicIslandTimer onNavigate={tab => safeSetActiveTab(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appShell: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.background,
  },



  // ── N1 Fix: Back button ──────────────────────────────────────────────
  backButton: {
    position: 'absolute',
    top: BACK_BUTTON_TOP,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F3820',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.45)',
    zIndex: 100,
    elevation: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Tab bar inner row (PanResponder attached here) ───────────────────
  // G6 Fix: No paddingHorizontal here. GlassBottomTabBar's tabContentRow
  // had paddingHorizontal:8 which was removed. This row must also be
  // padding-free so icon slots align 1:1 with the JellyCapsule slots.
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  // ── Tab buttons ──────────────────────────────────────────────────────
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    position: 'relative',
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(184, 255, 77, 0.18)',
  },
  tabLabel: {
    color: '#D4FFB2',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ATHLEO_COLORS.accent,
    marginTop: 2,
    shadowColor: ATHLEO_COLORS.accent,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },

  // ── Enhanced Jelly Capsule ────────────────────────────────────────────
  // OUTER — geometry only (position/size animated on the JS thread).
  jellyCapsule: {
    position: 'absolute',
    top: 6,
    bottom: 6,
  },
  // INNER — the visible capsule body. Scales about its own centre (native
  // driver), so the rubber squish is centred on the capsule, not the bar.
  jellyBody: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    // Vivid accent tint
    backgroundColor: 'rgba(184, 255, 77, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 77, 0.32)',
    // G3 Fix: elevation removed — capsule is inside overflow:hidden.
    // iOS shadow only (no elevation on Android):
    overflow: 'hidden',
  },
  jellyGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(184, 255, 77, 0.07)',
  },
  jellySpecular: {
    position: 'absolute',
    top: 2,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 1,
  },
  // Shimmer sweep — a narrow diagonal beam (rotated vertical white strip)
  jellyShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    transform: [{skewX: '-20deg'}],
  },
  jellyBottomRim: {
    position: 'absolute',
    bottom: 2,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(184, 255, 77, 0.22)',
    borderRadius: 1,
  },
  jellyCornerLeft: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  jellyCornerRight: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
