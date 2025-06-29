/**
 * @returns {Promise<import('jest').Config>}
 */
const path = require('path');

module.exports = {
  collectCoverageFrom: [
    '**/src/**/*.component.tsx',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/src/**/*.test.*',
    '!**/src/declarations.d.ts',
    '!**/e2e/**',
  ],
  transform: {
    '^.+\\.m?[jt]sx?$': ['@swc/jest'],
  },
  transformIgnorePatterns: ['/node_modules/(?!@openmrs|.+\\.pnp\\.[^\\/]+$)'],
  moduleNameMapper: {
    '@openmrs/esm-framework': '@openmrs/esm-framework/mock',
    '\\.(s?css)$': 'identity-obj-proxy',
    '^lodash-es/(.*)$': 'lodash/$1',
    'lodash-es': 'lodash',
    '^dexie$': require.resolve('dexie'),
    '\\.(svg)$': '<rootDir>/jest-svg-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setup-tests.ts'],
  testPathIgnorePatterns: [path.resolve(__dirname, 'e2e')],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
};
