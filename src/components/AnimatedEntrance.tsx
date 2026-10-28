/**
 * AnimatedEntrance.tsx
 * Reusable entrance animation wrapper — fades in children with a vertical slide.
 * Eliminates repeated animation boilerplate across screens.
 */

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, type ViewStyle} from 'react-native';

interface AnimatedEntranceProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  fromY?: number;
  style?: ViewStyle | ViewStyle[];
}

export function AnimatedEntrance({
  children,
  delay = 0,
  duration = 420,
  fromY = 20,
  style,
}: AnimatedEntranceProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: duration + 40,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fadeAnim, slideAnim, delay, duration]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
});
