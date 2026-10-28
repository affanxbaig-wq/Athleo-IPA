module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|react-native-svg|react-native-safe-area-context|@react-native-community|react-clone-referenced-element))',
  ],
};

