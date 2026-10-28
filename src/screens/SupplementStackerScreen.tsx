import React from 'react';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function SupplementStackerScreen() {
  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Supplement Stack</Text>
        <TouchableOpacity style={styles.iconButton}><Text style={styles.iconText}>🔔</Text></TouchableOpacity>
      </View>

      <AppCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.livePill}>Protocol Active</Text>
          <Text style={styles.phaseLabel}>Hypertrophy Peak</Text>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.ringWrap}>
            <View style={styles.ringOuter}><View style={styles.ringInner}><Text style={styles.ringValue}>75%</Text><Text style={styles.ringMini}>6 of 8</Text></View></View>
          </View>
          <View style={styles.hydroPanel}>
            <View style={styles.inlineRow}><Text style={styles.inlineLabel}>Hydration</Text><Text style={styles.inlineValue}>82%</Text></View>
            <Text style={styles.hydroValue}>3.10<Text style={styles.hydroUnit}>/ 3.80L</Text></Text>
            <View style={styles.track}><View style={[styles.fill, styles.w81]} /></View>
            <TouchableOpacity style={styles.waterButton}><Text style={styles.waterButtonText}>+250ml Hydro</Text></TouchableOpacity>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.aiCard}>
        <View style={styles.aiRow}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>AI</Text></View>
          <View style={styles.aiTextWrap}>
            <Text style={styles.aiLabel}>Athena AI • Synergy Dispatch</Text>
            <Text style={styles.aiText}>High sodium balance logged today. Ensure +500ml water during your pre-lift window.</Text>
          </View>
        </View>
      </AppCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Time-Phased Protocols</Text>
        <Text style={styles.sectionMeta}>EDT</Text>
      </View>

      <AppCard style={styles.windowCard}>
        <View style={styles.windowTop}><Text style={styles.windowLabel}>Window 1: Fasted Dawn Stack</Text><Text style={styles.windowStatus}>2/2 consumed</Text></View>
        <Text style={styles.windowSub}>8:00 AM • Completed</Text>
        <View style={styles.listRow}>
          <View style={styles.itemLeft}>
            <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
            <Text style={styles.listItem}>Omega-3 Triple EPA/DHA</Text>
          </View>
          <Text style={styles.listQty}>2 caps</Text>
        </View>
        <View style={styles.listRow}>
          <View style={styles.itemLeft}>
            <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
            <Text style={styles.listItem}>Vitamin D3 + K2</Text>
          </View>
          <Text style={styles.listQty}>1 drop</Text>
        </View>
      </AppCard>

      <AppCard style={styles.windowCardActive}>
        <View style={styles.windowTop}><Text style={styles.windowLabel}>Pre-Workout Protocol</Text><Text style={styles.countdown}>21:48</Text></View>
        <Text style={styles.windowSubAccent}>Scheduled 4:00 PM • 30m prior to lift</Text>
        <View style={styles.stackList}>
          <View style={styles.stackRow}>
            <View style={styles.itemLeft}>
              <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
              <Text style={styles.stackName}>L-Citrulline Malate 2:1</Text>
            </View>
            <Text style={styles.stackQty}>8,000mg</Text>
          </View>
          <View style={styles.stackRow}>
            <View style={styles.itemLeft}>
              <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
              <Text style={styles.stackName}>Caffeine Anhydrous</Text>
            </View>
            <Text style={styles.stackQty}>200mg</Text>
          </View>
          <View style={styles.stackRow}>
            <View style={styles.itemLeft}>
              <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
              <Text style={styles.stackName}>Beta-Alanine</Text>
            </View>
            <Text style={styles.stackQty}>3.2g</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.primaryButton}><Text style={styles.primaryText}>Mark window as consumed</Text></TouchableOpacity>
      </AppCard>

      <AppCard style={styles.windowCard}>
        <View style={styles.windowTop}><Text style={styles.windowLabel}>Window 3: Intra & Post</Text><Text style={styles.windowStatusMuted}>Queued</Text></View>
        <Text style={styles.windowSub}>5:45 PM • Post lifting block</Text>
        <View style={styles.listRow}>
          <View style={styles.itemLeft}>
            <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
            <Text style={styles.listItem}>Electrolyte Complex</Text>
          </View>
          <Text style={styles.listQty}>1 scoop</Text>
        </View>
        <View style={styles.listRow}>
          <View style={styles.itemLeft}>
            <Image source={require('../assets/images/pills.png')} style={styles.pillIcon} resizeMode="contain" />
            <Text style={styles.listItem}>Creatine Monohydrate</Text>
          </View>
          <Text style={styles.listQty}>5g</Text>
        </View>
      </AppCard>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {color: ATHLEO_COLORS.text, fontSize: 28, fontWeight: '800'},
  iconButton: {width: 38, height: 38, borderRadius: 12, backgroundColor: '#0F3820', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  iconText: {fontSize: 16},
  heroCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  heroTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  livePill: {color: ATHLEO_COLORS.accent, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},
  phaseLabel: {color: '#FFFFFF', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  heroBody: {flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16},
  ringWrap: {width: 120, alignItems: 'center'},
  ringOuter: {width: 88, height: 88, borderRadius: 44, borderWidth: 8, borderColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center'},
  ringInner: {alignItems: 'center'},
  ringValue: {color: '#FFFFFF', fontSize: 26, fontWeight: '900'},
  ringMini: {color: '#E2FCE8', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  hydroPanel: {flex: 1},
  inlineRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  inlineLabel: {color: '#FFFFFF', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  inlineValue: {color: ATHLEO_COLORS.accent, fontSize: 14, fontWeight: '900'},
  hydroValue: {color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 8},
  hydroUnit: {fontSize: 14, color: '#E2FCE8', marginLeft: 4, fontWeight: '800'},
  track: {height: 8, backgroundColor: '#071F12', borderRadius: 999, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: 'rgba(184, 255, 77, 0.25)'},
  fill: {height: '100%', backgroundColor: ATHLEO_COLORS.accent, borderRadius: 999},
  waterButton: {marginTop: 12, backgroundColor: '#0F3820', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.40)'},
  waterButtonText: {color: '#FFFFFF', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  aiCard: {padding: 14, borderRadius: 16, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  aiRow: {flexDirection: 'row', alignItems: 'center'},
  aiIcon: {width: 36, height: 36, borderRadius: 10, backgroundColor: ATHLEO_COLORS.accent, alignItems: 'center', justifyContent: 'center', marginRight: 10},
  aiIconText: {color: '#071F12', fontWeight: '900'},
  aiTextWrap: {flex: 1},
  aiLabel: {color: ATHLEO_COLORS.accent, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},
  aiText: {color: '#FFFFFF', fontSize: 14, marginTop: 4, fontWeight: '700'},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  sectionTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
  sectionMeta: {color: '#E2FCE8', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  windowCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  windowCardActive: {padding: 16, borderRadius: 18, borderWidth: 2, borderColor: ATHLEO_COLORS.accent, backgroundColor: '#143D24'},
  windowTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  windowLabel: {color: '#FFFFFF', fontSize: 17, fontWeight: '900'},
  windowStatus: {color: ATHLEO_COLORS.accent, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},
  windowStatusMuted: {color: '#E2FCE8', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  windowSub: {color: '#E2FCE8', fontSize: 13, marginTop: 6, fontWeight: '700'},
  windowSubAccent: {color: ATHLEO_COLORS.accent, fontSize: 13, marginTop: 6, fontWeight: '900'},
  listRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F3820', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  itemLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  pillIcon: {width: 20, height: 20, tintColor: ATHLEO_COLORS.accent},
  listItem: {color: '#FFFFFF', fontSize: 14, fontWeight: '800'},
  listQty: {color: '#D4FFB2', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800'},
  countdown: {color: ATHLEO_COLORS.accent, fontSize: 20, fontWeight: '900'},
  stackList: {marginTop: 12, gap: 8},
  stackRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F3820', borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  stackName: {color: '#FFFFFF', fontSize: 14, fontWeight: '800', flex: 1},
  stackQty: {color: ATHLEO_COLORS.accent, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},
  primaryButton: {marginTop: 16, backgroundColor: ATHLEO_COLORS.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center'},
  primaryText: {color: '#071F12', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '900'},
  w81: {width: '81%'},
});
