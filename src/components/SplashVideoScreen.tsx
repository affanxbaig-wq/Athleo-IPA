/**
 * SplashVideoScreen.tsx
 *
 * 2D Animated Logo Video Splash Screen.
 * Plays the vector-line drawing animation of the Athleo logo on app launch.
 * Seamlessly transitions into the app with a smooth fade-out.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

let Video: any = null;
let ResizeMode: any = {COVER: 'cover', CONTAIN: 'contain', STRETCH: 'stretch', NONE: 'none'};
try {
  const rnv = require('react-native-video');
  Video = rnv?.default ?? rnv?.Video ?? rnv;
  ResizeMode = rnv?.ResizeMode ?? rnv?.default?.ResizeMode ?? {COVER: 'cover', CONTAIN: 'contain'};
  if (Video && typeof Video === 'object' && Video.default) {
    Video = Video.default;
  }
} catch (e) {
  Video = null;
}

export interface SplashVideoScreenProps {
  /** Fires when splash animation is complete and app should be visible */
  onFinish: () => void;
  /** Whether the app has finished hydrating auth/storage and is ready to show */
  isAppReady?: boolean;
}

export function SplashVideoScreen({
  onFinish,
  isAppReady = true,
}: SplashVideoScreenProps) {
  const [videoError, setVideoError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isFinishedRef = useRef(false);

  const finishSplash = useCallback(() => {
    if (isFinishedRef.current) { return; }
    isFinishedRef.current = true;

    // Cinematic dissolve: clean 400ms opacity fade-out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.04,
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [fadeAnim, scaleAnim, onFinish]);

  // If Video failed or module is unavailable, finish immediately
  useEffect(() => {
    if (!Video || videoError) {
      finishSplash();
    }
  }, [videoError, finishSplash]);

  // Auto-transition timer: The vector line draws the full logo and reveals it in ~3.8 seconds.
  // Once the drawing completes and the app is ready, transition smoothly.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAppReady) {
        finishSplash();
      }
    }, 3800);

    return () => clearTimeout(timer);
  }, [isAppReady, finishSplash]);

  // If video ends naturally
  const handleEnd = useCallback(() => {
    if (isAppReady) {
      finishSplash();
    }
  }, [isAppReady, finishSplash]);

  // Allow user to tap after 900ms to skip directly into the app with a smooth fade
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 900);
    return () => clearTimeout(t);
  }, []);

  const handlePress = useCallback(() => {
    if (canSkip && isAppReady) {
      finishSplash();
    }
  }, [canSkip, isAppReady, finishSplash]);

  return (
    <Animated.View
      style={[styles.container, {opacity: fadeAnim}]}
      pointerEvents={isFinishedRef.current ? 'none' : 'auto'}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={styles.touchable}>
        {Video && !videoError ? (
          <Animated.View
            style={[
              styles.videoWrapper,
              {
                transform: [{scale: scaleAnim}],
              },
            ]}>
            <Video
              source={require('../../assets/video/splash-logo.mp4')}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              muted={true}
              repeat={false}
              paused={false}
              useTextureView={Platform.OS === 'android'}
              playInBackground={false}
              playWhenInactive={false}
              ignoreSilentSwitch="obey"
              disableFocus={true}
              bufferConfig={{
                minBufferMs: 1000,
                maxBufferMs: 4000,
                bufferForPlaybackMs: 200,
                bufferForPlaybackAfterRebufferMs: 400,
              }}
              onEnd={handleEnd}
              onError={() => setVideoError(true)}
            />
          </Animated.View>
        ) : (
          <View style={styles.fallback} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});

