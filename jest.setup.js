/* global jest */
jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clearAll: jest.fn(),
    })),
    createMMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clearAll: jest.fn(),
    })),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/geolocation', () => ({
  addListener: jest.fn(),
  getCurrentPosition: jest.fn((cb) => cb({ coords: { latitude: 0, longitude: 0, speed: 0 } })),
  removeListeners: jest.fn(),
  requestAuthorization: jest.fn(),
  setConfiguration: jest.fn(),
  startObserving: jest.fn(),
  stopObserving: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('react-native-biometrics', () => {
  return jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn().mockResolvedValue({ available: true, biometryType: 'TouchID' }),
    simplePrompt: jest.fn().mockResolvedValue({ success: true }),
  }));
});

jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn(),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-encrypted-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(),
  removeItem: jest.fn().mockResolvedValue(),
  clear: jest.fn().mockResolvedValue(),
  getAllKeys: jest.fn().mockResolvedValue([]),
}));
jest.mock('react-native-device-info', () => ({
  default: {
    getVersion: jest.fn(() => '1.0.0'),
    getBuildNumber: jest.fn(() => '1'),
    getSystemVersion: jest.fn(() => '15.0'),
    getModel: jest.fn(() => 'test-device'),
    isEmulator: jest.fn(() => true),
  },
}));
