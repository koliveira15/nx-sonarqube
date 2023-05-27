/* eslint-disable */
export default {
  displayName: 'nx-sonarqube-e2e',
  preset: '../../jest.preset.js',
  globals: {},
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  coverageDirectory: '../../coverage/e2e/nx-sonarqube-e2e',
  moduleFileExtensions: ['ts', 'js', 'html'],
};
