import React, {useRef} from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

import {ATHLEO_COLORS, ATHLEO_MOTION} from '../theme/theme';

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The scale is animated on the Pressable itself.
 *
 * It used to wrap the children in an inner `Animated.View`, which became the
 * real flex child of the button: every button's `flexDirection: 'row'`, `gap`
 * and `alignItems` were then applied to a wrapper holding a single child, so
 * multi-part labels (icon + text) stacked vertically and single labels were
 * stretched left-aligned instead of centred.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({children, style, onPressIn, onPressOut, ...props}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    Animated.spring(scale, {
      toValue: ATHLEO_MOTION.pressScale,
      speed: 25,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 25,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, {transform: [{scale}]}]}
      android_ripple={{color: ATHLEO_COLORS.accent}}>
      {children}
    </AnimatedPressable>
  );
}
