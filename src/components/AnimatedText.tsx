/**
 * AnimatedText.tsx
 * iOS-style text entrance — fades in while sliding up with a soft spring.
 * Drop-in replacement for <Text> that keeps the native driver enabled
 * (opacity + transform only), so it never floods the JS bridge.
 *
 * PERF FIX: Animation only fires once on mount. Subsequent re-renders with
 * new children / style are instant — no re-animation that would lag every
 * step-counter update hitting the screen.
 */

import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

export interface AnimatedTextProps extends TextProps {
  children?: React.ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Duration of the fade (the slide uses a spring). */
  duration?: number;
  /** Vertical offset the text travels from. */
  fromY?: number;
  style?: StyleProp<TextStyle>;
  /** If false (default false), skip the entrance and render instantly. */
  animate?: boolean;
}

export function AnimatedText({
  children,
  delay = 0,
  duration = 300,
  fromY = 8,
  animate = false,
  style,
  ...rest
}: AnimatedTextProps) {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? fromY : 0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animate || hasAnimated.current) { return; }
    hasAnimated.current = true;

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 14,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!animate) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <Animated.Text
      style={[{opacity, transform: [{translateY}]}, style]}
      {...rest}>
      {children}
    </Animated.Text>
  );
}
