/**
 * useResponsive.ts
 * Custom hook that provides live responsive layout helpers.
 * Listens to Dimensions change events so components auto-reflow on
 * orientation change or fold/unfold on foldable devices.
 */

import {useEffect, useState} from 'react';
import {Dimensions} from 'react-native';
import {scaleFont, scalePx} from '../theme/theme';

type ResponsiveState = {
  width: number;
  height: number;
  isLandscape: boolean;
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
  isTablet: boolean;
  scaleFont: (base: number) => number;
  scalePx: (base: number) => number;
};

function getState(): ResponsiveState {
  const {width, height} = Dimensions.get('window');
  return {
    width,
    height,
    isLandscape: width > height,
    isSmall: width < 375,
    isMedium: width >= 375 && width <= 414,
    isLarge: width > 414,
    isTablet: width >= 600,
    scaleFont,
    scalePx,
  };
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(getState);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setState(getState());
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return state;
}
