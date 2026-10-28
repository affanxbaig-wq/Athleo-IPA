/**
 * SkeletonCard.tsx
 * Reusable shimmer skeleton placeholder with smooth pulsing animation.
 */

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, type ViewStyle} from 'react-native';

interface SkeletonCardProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function SkeletonCard({
  width = '100%',
  height = 80,
  borderRadius = 16,
  style,
}: SkeletonCardProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 0.75, duration: 750, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0.35, duration: 750, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {width: width as any, height, borderRadius, opacity: pulse},
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#252528',
  },
});
