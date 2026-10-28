import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {type TabKey} from '../navigation/AppNavigator';

// ── BlurView (defensive import) ───────────────────────────────────────────────
let BlurView: any = null;
try {
  const blurModule = require('@react-native-community/blur');
  BlurView = blurModule?.BlurView ?? blurModule?.default?.BlurView ?? null;
} catch {
  BlurView = null;
}

// ── Haptics ───────────────────────────────────────────────────────────────────
let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  ReactNativeHapticFeedback = null;
}
const triggerHaptic = (type = 'selection') => {
  try {
    ReactNativeHapticFeedback?.trigger(type, {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {}
};

// ── Dimensions ────────────────────────────────────────────────────────────────
const SCREEN_WIDTH   = Dimensions.get('window').width;
const H_PAD          = 20;
const BORDER_RADIUS  = 32;
const BOTTOM_SAFE    = Platform.OS === 'ios' ? 28 : 12;

export interface FabTabBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onNavigate: (tab: TabKey) => void;
  jellyEnabled?: boolean;
  onReselect?: (tab: TabKey) => void;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  iconActive: string;
}

const TABS: TabDef[] = [
  {key: 'home',     label: 'Home',     icon: 'home-outline',     iconActive: 'home'},
  {key: 'workouts', label: 'Train',    icon: 'barbell-outline',  iconActive: 'barbell'},
  {key: 'ai',       label: 'AI Coach', icon: 'sparkles-outline', iconActive: 'sparkles'},
  {key: 'profile',  label: 'Me',       icon: 'person-outline',   iconActive: 'person'},
];

const PARENT_TAB_MAP: Partial<Record<TabKey, TabKey>> = {
  settings: 'profile', editProfile: 'profile', notifications: 'profile',
  gym: 'workouts', builder: 'workouts', technique: 'workouts',
  outdoor: 'home', pedometer: 'home', health: 'profile',
  recovery: 'profile', activity: 'profile', community: 'home',
  challenges: 'home', plan: 'profile', paywall: 'profile',
};

const ESTIMATED_WIDTH = SCREEN_WIDTH - H_PAD * 2;

export function FabTabBar({activeTab, onSelectTab, jellyEnabled = true, onReselect}: FabTabBarProps) {
  const [dockWidth, setDockWidth] = useState(0);

  const effectiveTab: TabKey = TABS.some(t => t.key === activeTab)
    ? activeTab
    : (PARENT_TAB_MAP[activeTab] ?? 'home');

  const activeIdx = Math.max(0, TABS.findIndex(t => t.key === effectiveTab));

  const indicatorAnim = useRef(new Animated.Value(activeIdx)).current;
  const jellySquish   = useRef(new Animated.Value(0)).current;
  const iconBounces   = useRef(TABS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const target = Math.max(0, TABS.findIndex(t => t.key === effectiveTab));

    const anims: Animated.CompositeAnimation[] = [
      Animated.spring(indicatorAnim, {toValue: target, bounciness: 9, speed: 16, useNativeDriver: false}),
    ];

    if (jellyEnabled) {
      anims.push(
        Animated.sequence([
          Animated.timing(jellySquish, {toValue: 1, duration: 90, easing: Easing.bezier(0.34, 0.06, 0.2, 0.98), useNativeDriver: false}),
          Animated.spring(jellySquish, {toValue: 0, friction: 5, tension: 120, useNativeDriver: false}),
        ]),
      );
    }

    if (iconBounces[target]) {
      anims.push(
        Animated.sequence([
          Animated.timing(iconBounces[target], {toValue: 0.74, duration: 70, useNativeDriver: true}),
          Animated.spring(iconBounces[target], {toValue: 1, friction: 4, tension: 140, useNativeDriver: true}),
        ]),
      );
    }

    Animated.parallel(anims).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTab]);

  const handlePress = useCallback((key: TabKey) => {
    triggerHaptic('selection');
    if (key === activeTab) { onReselect?.(key); }
    else { onSelectTab(key); }
  }, [activeTab, onReselect, onSelectTab]);

  // Jelly
  const scaleX = jellySquish.interpolate({inputRange: [0, 1], outputRange: [1, 1.06]});
  const scaleY = jellySquish.interpolate({inputRange: [0, 1], outputRange: [1, 0.92]});

  const totalW    = dockWidth > 0 ? dockWidth : ESTIMATED_WIDTH;
  const slotW     = totalW / TABS.length;
  const INSET     = 5;
  const capsuleW  = Math.max(0, slotW - INSET * 2);

  const capsuleLeft = indicatorAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: [INSET, slotW + INSET, slotW * 2 + INSET, slotW * 3 + INSET],
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const PillContent = (
    <>
      {/* Sliding accent capsule */}
      {dockWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.capsuleWrap, {left: capsuleLeft, width: capsuleW}]}>
          <Animated.View style={[styles.capsule, {transform: [{scaleX}, {scaleY}]}]} />
        </Animated.View>
      )}

      {/* Top specular rim */}
      <View style={styles.specularRim} pointerEvents="none" />

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab, idx) => {
          const isActive = effectiveTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handlePress(tab.key)}
              activeOpacity={0.8}
              style={styles.tabSlot}>
              <Animated.View style={[styles.iconWrap, {transform: [{scale: iconBounces[idx]}]}]} pointerEvents="none">
                <Icon
                  name={isActive ? tab.iconActive : tab.icon}
                  size={22}
                  color={isActive ? '#B8FF4D' : 'rgba(255,255,255,0.42)'}
                />
              </Animated.View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                  !isActive && styles.tabLabelInactive,
                ]}
                numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  return (
    <View style={styles.outerWrap} pointerEvents="box-none">
      {/* Depth glow */}
      <View style={styles.depthGlow} />

      {/* The pill */}
      <View
        style={styles.pill}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== dockWidth) { setDockWidth(w); }
        }}>
        {BlurView ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={Platform.OS === 'ios' ? 28 : 14}
            reducedTransparencyFallbackColor="rgba(8,16,11,0.96)"
            overlayColor="transparent"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.solidFallback]} />
        )}
        {PillContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    bottom: BOTTOM_SAFE,
    left: H_PAD,
    right: H_PAD,
    zIndex: 100,
    height: 76,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  depthGlow: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    bottom: -4,
    borderRadius: BORDER_RADIUS + 8,
    backgroundColor: 'transparent',
  },
  pill: {
    width: '100%',
    height: 76,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(17,20,18,0.72)',
  },
  solidFallback: {
    backgroundColor: 'rgba(12,16,13,0.92)',
  },

  // ── Top specular rim ──
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 1,
  },

  // ── Active capsule ──
  capsuleWrap: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    zIndex: 1,
  },
  capsule: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(184,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.26)',
    shadowColor: '#B8FF4D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 0},
  },

  // ── Tabs ──
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 7,
    gap: 2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
    opacity: 1,
    marginTop: 1,
  },
  tabLabelInactive: {
    color: 'rgba(255,255,255,0.58)',
  },
  tabLabelActive: {
    color: '#D9FF8C',
    fontWeight: '800',
    fontSize: 10.8,
    textShadowColor: 'rgba(184,255,77,0.35)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 8,
  },
});
