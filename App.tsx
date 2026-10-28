/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, UIManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Zero-Crash Guard: Intercept fatal exceptions and recover instead of freezing ──
let fatalErrorRecovery: (() => void) | null = null;
let lastFatalRecoveryTime = 0;

export function registerFatalErrorRecovery(cb: () => void) {
  fatalErrorRecovery = cb;
}

if ((global as any).ErrorUtils) {
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.warn('[ZeroCrash] Caught exception to preserve app lifecycle:', error?.message || error, 'isFatal:', isFatal);
    const now = Date.now();
    // Guard against rapid re-render cycles that cause Android to kill the process
    if (isFatal && fatalErrorRecovery && (now - lastFatalRecoveryTime > 5000)) {
      lastFatalRecoveryTime = now;
      try {
        fatalErrorRecovery();
      } catch (e) {
        console.warn('[ZeroCrash] Recovery attempt failed:', e);
      }
    }
  });
}

export default function App() {
  const [appKey, setAppKey] = React.useState(0);

  useEffect(() => {
    registerFatalErrorRecovery(() => {
      setAppKey(prev => prev + 1);
    });
  }, []);

  useEffect(() => {
    const handleRejection = (event: any) => {
      console.warn('[ZeroCrash] Unhandled Promise Rejection safely absorbed:', event?.reason || event);
    };

    if (typeof (global as any).addEventListener === 'function') {
      (global as any).addEventListener('unhandledrejection', handleRejection);
    }

    return () => {
      if (typeof (global as any).removeEventListener === 'function') {
        (global as any).removeEventListener('unhandledrejection', handleRejection);
      }
    };
  }, []);

  const handleRestart = React.useCallback(() => {
    setAppKey(prev => prev + 1);
  }, []);

  return (
    <ErrorBoundary key={appKey} onReset={handleRestart}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
