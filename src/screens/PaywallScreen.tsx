import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Animated, Image, StyleSheet, TouchableOpacity, View} from 'react-native';

import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {PressableScale} from '../components/PressableScale';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';
import {type TabKey} from '../navigation/AppNavigator';

// Feature rows matching the paywall design
const FEATURES = [
  {title: 'Unlimited AI Coach 2.0', desc: 'Instant form velocity cues & dynamic voice breakdown during reps'},
  {title: 'Smart Cockpit Gym Mode', desc: '1-tap set telemetry, adaptive rest intervals & live 1RM calculator'},
  {title: '600+ Authentic Pakistani Macro Feeds', desc: 'Instant barcode food scanner tuned for hyper-localized regional diets'},
  {title: 'Readiness & Recovery Analytics', desc: 'Wearable telemetry sync via Apple Health & Health Connect'},
];

let Purchases: any = null;

try {
  const purchasesModule = require('react-native-purchases');
  Purchases = purchasesModule.default ?? purchasesModule;
} catch {
  Purchases = null;
}

interface PaywallScreenProps {
  navigate?: (tab: TabKey) => void;
  onSuccess?: () => void;
}

export function PaywallScreen({navigate, onSuccess}: PaywallScreenProps) {
  const [packages, setPackages] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const isMountedRef = useRef(true);
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  // Shimmer animation for CTA button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {toValue: 2, duration: 2000, useNativeDriver: true}),
        Animated.delay(1000),
        Animated.timing(shimmerAnim, {toValue: -1, duration: 0, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    fetchOfferings();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchOfferings = async () => {
    try {
      if (!isMountedRef.current) { return; }
      setIsFetching(true);
      if (!Purchases) {
        setPackages([]);
        return;
      }
      const offerings = await Purchases.getOfferings();
      if (isMountedRef.current && offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        console.warn('RevenueCat error:', e);
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  };

  const handlePurchase = async (pkg: any) => {
    try {
      if (!isMountedRef.current) { return; }
      if (isMountedRef.current) {
        setIsPurchasing(true);
      }
      if (typeof pkg === 'string') {
        if (isMountedRef.current) {
          Alert.alert('Athleo PRO', `Mock ${pkg} plan activated!`);
          if (onSuccess) {onSuccess();}
          else {navigate?.('home');}
        }
        return;
      }

      if (!Purchases) {
        Alert.alert('Pro unavailable', 'This build does not include native purchase support.');
        return;
      }

      const {customerInfo} = await Purchases.purchasePackage(pkg);
      if (isMountedRef.current) {
        checkAccess(customerInfo);
      }
    } catch (e: any) {
      if (isMountedRef.current && !e.userCancelled) {
        Alert.alert('Purchase Error', e.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsPurchasing(false);
      }
    }
  };

  const checkAccess = (info: any) => {
    if (!isMountedRef.current) { return; }
    if (typeof info.entitlements.active.pro !== 'undefined') {
      Alert.alert('Welcome to PRO!', 'Your subscription is now active.');
      if (onSuccess) {onSuccess();}
      else {navigate?.('home');}
    }
  };

  const handleRestore = async () => {
    try {
      if (!isMountedRef.current) { return; }
      if (isMountedRef.current) {
        setIsPurchasing(true);
      }
      if (!Purchases) {
        Alert.alert('Restore unavailable', 'No native purchase SDK is available in this build.');
        return;
      }
      const customerInfo = await Purchases.restorePurchases();
      if (isMountedRef.current) {
        if (typeof customerInfo.entitlements.active.pro !== 'undefined') {
          Alert.alert('Success', 'Purchases restored.');
          if (onSuccess) {onSuccess();}
          else {navigate?.('home');}
        } else {
          Alert.alert('No Subscription', 'No active Pro subscription found.');
        }
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        Alert.alert('Restore Error', e.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsPurchasing(false);
      }
    }
  };

  const handleCTAPress = () => {
    if (packages.length > 0) {
      const pkg = packages.find((p: any) =>
        selectedPlan === 'yearly' ? p.packageType === 'ANNUAL' : p.packageType === 'MONTHLY',
      ) ?? packages[0];
      handlePurchase(pkg);
    } else {
      handlePurchase(selectedPlan === 'yearly' ? 'mock_annual' : 'mock_monthly');
    }
  };

  const renderPlanCards = () => {
    const isYearly = selectedPlan === 'yearly';

    if (packages.length > 0) {
      return packages.map((pkg: any) => {
        const isAnnual = pkg.packageType === 'ANNUAL';
        const isSelected = isAnnual ? isYearly : !isYearly;
        return (
          <PressableScale
            key={pkg.identifier}
            onPress={() => setSelectedPlan(isAnnual ? 'yearly' : 'monthly')}
            style={[styles.planCard, isSelected && styles.planCardSelected]}>
            <View style={styles.planRow}>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                {isAnnual ? 'YEARLY ACCESS' : 'MONTHLY ACCESS'}
              </Text>
              {isAnnual && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>BEST VALUE</Text>
                </View>
              )}
              {!isAnnual && <Text style={styles.standardLabel}>STANDARD</Text>}
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                {pkg.product.priceString}
              </Text>
              <Text style={styles.priceUnit}>/ {isAnnual ? 'year' : 'month'}</Text>
            </View>
            <Text style={styles.planSub}>
              {isAnnual ? 'Billed annually. Cancel anytime.' : 'Billed monthly. Auto-renews unless cancelled.'}
            </Text>
          </PressableScale>
        );
      });
    }

    return (
      <>
        <PressableScale
          onPress={() => setSelectedPlan('yearly')}
          style={[styles.planCard, isYearly && styles.planCardSelected]}>
          <View style={styles.planRow}>
            <View style={[styles.radio, isYearly && styles.radioSelected]}>
              {isYearly && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.planLabel, isYearly && styles.planLabelSelected]}>YEARLY ACCESS</Text>
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>BEST VALUE • 7-DAY FREE TRIAL</Text>
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceAmount, isYearly && styles.priceAmountSelected]}>$6.67</Text>
            <Text style={styles.priceUnit}>/ month</Text>
            <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>SAVE 55%</Text></View>
          </View>
          <Text style={styles.planSub}>Billed annually at $79.99 after 7-day trial. Cancel anytime.</Text>
        </PressableScale>

        <PressableScale
          onPress={() => setSelectedPlan('monthly')}
          style={[styles.planCard, !isYearly && styles.planCardSelected]}>
          <View style={styles.planRow}>
            <View style={[styles.radio, !isYearly && styles.radioSelected]}>
              {!isYearly && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.planLabel, !isYearly && styles.planLabelSelected]}>MONTHLY ACCESS</Text>
            <Text style={styles.standardLabel}>STANDARD</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceAmount, !isYearly && styles.priceAmountSelected]}>$14.99</Text>
            <Text style={styles.priceUnit}>/ month</Text>
            <Text style={styles.flexibleLabel}>Flexible commitment</Text>
          </View>
          <Text style={styles.planSub}>Billed monthly. Auto-renews unless cancelled.</Text>
        </PressableScale>
      </>
    );
  };

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-300, 300],
  });

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Top bar ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigate?.('home')}>
          <Icon name="close" size={20} color={ATHLEO_COLORS.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRestore} disabled={isPurchasing}>
          <Text style={styles.restoreTopText}>RESTORE PURCHASES</Text>
        </TouchableOpacity>
      </View>

      {/* ── Visual Hero Banner ─── */}
      <View style={styles.heroBannerWrap}>
        <Image
          source={require('../assets/images/workout_hero_banner.jpg')}
          style={styles.heroBannerImg}
          resizeMode="cover"
        />
        <View style={styles.heroBannerOverlay} />
        <View style={styles.heroBadgeRow}>
          <Icon name="flash" size={14} color={ATHLEO_COLORS.accent} />
          <Text style={styles.heroBadgeText}>PRO BIOMETRICS SUITE</Text>
        </View>
      </View>

      {/* ── Title with chevrons ─── */}
      <View style={styles.titleRow}>
        <Icon name="chevron-forward-outline" size={22} color={ATHLEO_COLORS.accent} />
        <Text style={styles.heroTitle}>ATHLEO ELITE v2.4</Text>
        <Icon name="chevron-back-outline" size={22} color={ATHLEO_COLORS.accent} />
      </View>
      <Text style={styles.heroSub}>Real-time biomechanics · Sub-second precision tracking</Text>

      {/* ── Main headline ─── */}
      <View style={styles.headlineBlock}>
        <Text style={styles.headline}>
          {'UNLEASH YOUR '}<Text style={styles.headlineAccent}>PEAK</Text>{' ATHLETIC POTENTIAL'}
        </Text>
        <Text style={styles.headlineSub}>
          Tuned for elite conditioning, real-time metabolic cues, and physiological mastery.
        </Text>
      </View>

      {/* ── Features checklist ─── */}
      <View style={styles.featureCard}>
        {FEATURES.map((f, i) => (
          <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}>
            <View style={styles.checkBox}>
              <MaterialIcon name="check" size={15} color="#0B0B0D" />
            </View>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Plan cards ─── */}
      {isFetching ? (
        <View style={styles.loaderArea}><ActivityIndicator color={ATHLEO_COLORS.accent} size="large" /></View>
      ) : (
        <View style={styles.planSection}>{renderPlanCards()}</View>
      )}

      {/* ── Trust line ─── */}
      <View style={styles.trustRow}>
        <MaterialIcon name="verified-user" size={16} color={ATHLEO_COLORS.accentSoft} />
        <Text style={styles.trustText}>No payment due today · Easy 1-tap cancellation in settings</Text>
      </View>

      {/* ── Shimmer CTA button ─── */}
      <PressableScale onPress={handleCTAPress} style={styles.ctaButton} disabled={isPurchasing}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.shimmer, {transform: [{translateX: shimmerTranslate}]}]} />
        </View>
        {isPurchasing ? (
          <ActivityIndicator color="#0B0B0D" size="small" />
        ) : (
          <View style={styles.ctaInner}>
            <Text style={styles.ctaText}>START 7-DAY FREE TRIAL</Text>
            <Icon name="arrow-forward" size={18} color="#0B0B0D" />
          </View>
        )}
      </PressableScale>

      {/* ── Bottom links ─── */}
      <Text style={styles.bottomNote}>STILL IN DOUBT? EXPLORE SPECIAL ATHLETIC GRANT</Text>
      <View style={styles.bottomLinks}>
        <TouchableOpacity><Text style={styles.bottomLink}>Terms of Service</Text></TouchableOpacity>
        <Text style={styles.bottomDot}>·</Text>
        <TouchableOpacity><Text style={styles.bottomLink}>Privacy Policy</Text></TouchableOpacity>
        <Text style={styles.bottomDot}>·</Text>
        <TouchableOpacity onPress={handleRestore}><Text style={styles.bottomLink}>Restore</Text></TouchableOpacity>
      </View>

    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {paddingHorizontal: ATHLEO_SPACING.lg, paddingBottom: 140, paddingTop: 12},

  // Top bar
  topBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20},
  closeBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184,255,77,0.35)'},
  restoreTopText: {color: '#E2FCE8', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase'},

  // Hero Banner
  heroBannerWrap: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.35)',
  },
  heroBannerImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 26, 14, 0.72)',
  },

  // Hero
  heroBadgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(184,255,77,0.18)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(184,255,77,0.35)'},
  heroBadgeText: {color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase'},
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6},
  heroTitle: {color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5},
  heroSub: {color: '#E2FCE8', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20, fontWeight: '700'},

  // Headline
  headlineBlock: {alignItems: 'center', marginBottom: 24},
  headline: {color: '#FFFFFF', fontSize: 30, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', letterSpacing: -0.5, lineHeight: 38},
  headlineAccent: {color: ATHLEO_COLORS.accent},
  headlineSub: {color: '#E2FCE8', fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22, fontWeight: '700'},

  // Features
  featureCard: {backgroundColor: '#0D331D', borderRadius: 20, padding: 6, marginBottom: 20, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  featureRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 14},
  featureRowBorder: {borderBottomWidth: 1, borderBottomColor: 'rgba(184, 255, 77, 0.2)'},
  checkBox: {width: 26, height: 26, borderRadius: 8, backgroundColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1},
  featureTexts: {flex: 1},
  featureTitle: {color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 3},
  featureDesc: {color: '#E2FCE8', fontSize: 13, lineHeight: 18, fontWeight: '700'},

  // Plan cards
  planSection: {gap: 12, marginBottom: 16},
  planCard: {borderRadius: 20, padding: 16, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  planCardSelected: {borderColor: ATHLEO_COLORS.accent, backgroundColor: '#143D24', borderWidth: 2},
  planRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap'},
  radio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(184, 255, 77, 0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0},
  radioSelected: {borderColor: ATHLEO_COLORS.accent, backgroundColor: ATHLEO_COLORS.accent},
  radioDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#071F12'},
  planLabel: {color: '#E2FCE8', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', flex: 1},
  planLabelSelected: {color: '#FFFFFF', fontWeight: '900'},
  standardLabel: {color: '#E2FCE8', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase'},
  flexibleLabel: {color: '#E2FCE8', fontSize: 13, fontWeight: '700'},
  bestBadge: {backgroundColor: ATHLEO_COLORS.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  bestBadgeText: {color: '#071F12', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase'},
  saveBadge: {backgroundColor: 'rgba(184,255,77,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 'auto' as const, borderWidth: 1, borderColor: 'rgba(184,255,77,0.4)'},
  saveBadgeText: {color: ATHLEO_COLORS.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5},
  priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 6},
  priceAmount: {color: '#D4FFB2', fontSize: 34, fontWeight: '900', letterSpacing: -1},
  priceAmountSelected: {color: '#FFFFFF', fontWeight: '900'},
  priceUnit: {color: '#E2FCE8', fontSize: 14, fontWeight: '700'},
  planSub: {color: '#E2FCE8', fontSize: 13, lineHeight: 18, fontWeight: '700'},
  loaderArea: {paddingVertical: 40, alignItems: 'center'},

  // Trust
  trustRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, paddingVertical: 4},
  trustText: {color: '#E2FCE8', fontSize: 13, textAlign: 'center', flex: 1, fontWeight: '700'},

  // CTA
  ctaButton: {width: '100%', height: 56, borderRadius: 18, backgroundColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 20},
  ctaInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  ctaText: {color: '#071F12', fontSize: 16, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase'},
  shimmer: {position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: 'rgba(255,255,255,0.28)', transform: [{skewX: '-20deg'}]},

  // Bottom
  bottomNote: {color: '#E2FCE8', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12},
  bottomLinks: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  bottomLink: {color: ATHLEO_COLORS.accent, fontSize: 13, textDecorationLine: 'underline', fontWeight: '800'},
  bottomDot: {color: '#E2FCE8', fontSize: 13},
});
