module.exports = {
  roots: ['<rootDir>/src/test/suite/views/webview-app'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '.+\\.(less)$': 'jest-transform-stub'
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputName: 'test-webview-results.xml'
    }]
  ],
  // '(/test/suite/views/webview-app/.*|(\\.|/)(test|spec))\\.tsx?$',
  testRegex: '(/test/suite/views/webview-app/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: ['<rootDir>/src/test/suite/views/webview-app/jest-setup.js']
};
