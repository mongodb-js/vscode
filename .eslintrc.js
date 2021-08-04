const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');

// Overrides do not work with extends.
const ruleOverridesForJs = Object.keys(typescriptEslintEslintPlugin.rules).reduce(
  (overrides, rule) => ({ ...overrides, [`@typescript-eslint/${rule}`]: 0 }), {}
);

module.exports = {
  plugins: ['mocha', '@typescript-eslint'],
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser.
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: [
      './tsconfig.json'
    ]
  },
  extends: [
    'eslint-config-mongodb-js/react',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  rules: {
    'chai-friendly/no-unused-expressions': 0,
    'object-curly-spacing': [2, 'always'],
    'no-empty-function': 0,
    'valid-jsdoc': 0,
    'react/sort-comp': 0, // Does not seem work as expected with typescript.
    '@typescript-eslint/no-empty-function': 0,
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-unused-vars': 2,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/ban-types': 0,
    'mocha/no-skipped-tests': 1,
    'mocha/no-exclusive-tests': 2,
    'semi': 0,
    '@typescript-eslint/semi': [2, 'always'],
    'no-console': [1, { allow: ['warn', 'error', 'info'] }],
    'no-shadow': 0,
    'no-use-before-define': 0,
    'no-cond-assign': [2, 'except-parens'],
    'space-before-function-paren': 0,
    '@typescript-eslint/no-floating-promises': 0,

    'restrict-template-expressions': 0,
    '@typescript-eslint/restrict-template-expressions': 0,

    // VV These rules we'd like to turn off one day so they error.
    '@typescript-eslint/no-unsafe-assignment': 0,
    '@typescript-eslint/no-unsafe-member-access': 0,
    '@typescript-eslint/no-unsafe-call': 0,
    '@typescript-eslint/no-unsafe-return': 'warn'
  },
  overrides: [{
    files: ['**/*.js'],
    rules: {
      ...ruleOverridesForJs,
      semi: [2, 'always']
    }
  }]
};
