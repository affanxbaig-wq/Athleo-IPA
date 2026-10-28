import {Animated, Easing} from 'react-native';

export const springConfig = {
  stiffness: 85,
  damping: 26,
  mass: 1.3,
};

export const defaultAnimationEasing = Easing.bezier(0.16, 1, 0.3, 1);

export const animateValue = (
  animated: Animated.Value,
  toValue: number,
  duration = 2400,
  easing = defaultAnimationEasing,
) => {
  Animated.timing(animated, {
    toValue,
    duration,
    easing,
    useNativeDriver: false,
  }).start();
};
