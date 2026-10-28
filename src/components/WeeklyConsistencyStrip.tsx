import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {AnimatedText as Text} from './AnimatedText';
import {ATHLEO_COLORS} from '../theme/theme';
import {triggerHaptic} from '../services/haptics';

interface WeeklyConsistencyStripProps {
  currentStreak: number;
  onPressDay?: (dayIndex: number) => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeeklyConsistencyStrip({currentStreak, onPressDay}: WeeklyConsistencyStripProps) {
  // Monday = 0, ..., Sunday = 6
  const jsDay = new Date().getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Icon name="calendar-outline" size={14} color={ATHLEO_COLORS.accent} />
          <Text style={styles.titleText}>Weekly Consistency</Text>
        </View>
        <Text style={styles.streakSubText}>
          {currentStreak > 0 ? `🔥 ${currentStreak}-Day Streak Active` : '⚡ Start your streak today'}
        </Text>
      </View>

      <View style={styles.daysRow}>
        {DAYS.map((letter, idx) => {
          const isToday = idx === todayIdx;
          const isPast = idx < todayIdx;
          // Calculate if this day in the current week was completed based on streak
          const daysAgo = todayIdx - idx;
          const isCompleted = isPast && daysAgo <= currentStreak;

          return (
            <TouchableOpacity
              key={`${letter}-${idx}`}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('selection');
                onPressDay?.(idx);
              }}
              style={styles.dayCol}>
              <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>{letter}</Text>

              <View
                style={[
                  styles.dayDot,
                  isToday && styles.dayDotToday,
                  isCompleted && styles.dayDotCompleted,
                ]}>
                {isCompleted ? (
                  <Icon name="checkmark" size={11} color="#08140B" />
                ) : isToday ? (
                  <View style={styles.pulseInnerDot} />
                ) : (
                  <View style={styles.inactiveInnerDot} />
                )}
              </View>

              {isToday && <View style={styles.todayBeacon} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 56, 32, 0.45)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    color: '#E2FCE8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  streakSubText: {
    color: ATHLEO_COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    paddingVertical: 2,
  },
  dayLetter: {
    color: '#8E9E90',
    fontSize: 11,
    fontWeight: '800',
  },
  dayLetterToday: {
    color: ATHLEO_COLORS.accent,
    fontWeight: '900',
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayDotToday: {
    backgroundColor: 'rgba(184, 255, 77, 0.2)',
    borderColor: ATHLEO_COLORS.accent,
    borderWidth: 1.5,
  },
  dayDotCompleted: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderColor: ATHLEO_COLORS.accent,
  },
  pulseInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ATHLEO_COLORS.accent,
  },
  inactiveInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayBeacon: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ATHLEO_COLORS.accent,
  },
});
