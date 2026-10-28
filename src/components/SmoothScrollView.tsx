import React, {forwardRef} from 'react';
import {
  Animated,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface SmoothScrollViewProps extends ScrollViewProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * SmoothScrollView — Performance-optimised scroll container
 *
 * P1 Fix: removeClippedSubviews is enabled on Android only.
 * On Android it offloads off-screen nodes from the render tree significantly
 * reducing GPU overdraw on long lists (WorkoutScreen, NutritionScreen).
 * On iOS it is kept false to avoid the rare "blank row" artifact that
 * can occur when clipping interacts with momentum scrolling.
 */
export const SmoothScrollView = forwardRef<ScrollView, SmoothScrollViewProps>(
  (props, ref) => {
    const {style, contentContainerStyle, scrollEventThrottle = 16, ...rest} = props;

    return (
      <Animated.ScrollView
        ref={ref}
        {...rest}
        style={style}
        contentContainerStyle={[
          styles.defaultContentContainer,
          contentContainerStyle,
        ]}
        // Default 16 (~60Hz). Screens that drive native-driver animations from
        // scroll can pass 1 to refresh the value every display frame (120Hz).
        scrollEventThrottle={scrollEventThrottle}
        decelerationRate="normal"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={false}
        removeClippedSubviews={false}
      />
    );
  },
);

SmoothScrollView.displayName = 'SmoothScrollView';

const styles = StyleSheet.create({
  defaultContentContainer: {
    paddingBottom: 32,
  },
});
