/** Unit tests (jest-expo preset). Playwright visual checks live in e2e/ and are not run by Jest. */
module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 / Worklets ship a resolver that picks their JS (non-native) implementations under Jest
  resolver: 'react-native-reanimated/jest/resolver.js',
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/dist/', '/dist-web/', '/android/', '/ios/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
