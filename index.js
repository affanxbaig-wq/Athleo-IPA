/**
 * @format
 */

// ── URL Polyfill (MUST be first) ─────────────────────────────────────────────
// Hermes JS engine on Android does not implement URL.protocol and related
// URL API properties. This polyfill patches them globally before any other
// module runs, preventing the "URL.protocol is not implemented" crash.
import 'react-native-url-polyfill/auto';

// ── Early Global Error Interception (Zero Crash Shield) ──────────────────────
if (typeof global !== 'undefined') {
  if (global.ErrorUtils) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      // Log for diagnostics without terminating the app process
      console.warn('[ZeroCrash] Caught global error:', error && error.message ? error.message : error, 'isFatal:', isFatal);
    });
  }

  // Handle unhandled promise rejections
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    if (tracking && typeof tracking.enable === 'function') {
      tracking.enable({
        allRejections: true,
        onUnhandled: (id, rejection) => {
          console.warn('[ZeroCrash] Suppressed unhandled promise rejection:', id, rejection && rejection.message ? rejection.message : rejection);
        },
        onHandled: () => {},
      });
    }
  } catch (_e) {
    // Ignore if module not found
  }
}

// ── App-wide typography (Montserrat + Space Grotesk) ─────────────────────────
// Must run before App is evaluated so the very first frame is already styled
// with the bundled humanist typefaces instead of Android's default Roboto.
import './src/theme/typography';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
