const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');

// Overrides do not work with extends.
const ruleOverridesForJs = Object.keys(
  typescriptEslintEslintPlugin.rules,
).reduce(
  (overrides, rule) => ({ ...overrides, [`@typescript-eslint/${rule}`]: 0 }),
  {},
);

const sharedRules = {
  // TODO(VSCODE-724): Update our file naming and enable this rule.
  // We have a lot of files that do not match the filename rules.
  'filename-rules/match': 0,
  'mocha/no-exclusive-tests': 2,
  'no-console': [1, { allow: ['warn', 'error', 'info'] }],
};

module.exports = {
  plugins: ['mocha', '@typescript-eslint'],
  extends: ['@mongodb-js/eslint-config-devtools'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        ...sharedRules,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-floating-promises': 2,
        // VV These rules we'd like to turn off one day so they error.
        '@typescript-eslint/no-unsafe-assignment': 0,
        '@typescript-eslint/no-unsafe-member-access': 0,
        '@typescript-eslint/no-unsafe-call': 0,
        '@typescript-eslint/no-unsafe-return': 0,
        '@typescript-eslint/no-unsafe-argument': 0,
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports' },
        ],
        '@typescript-eslint/explicit-function-return-type': [
          'warn',
          {
            allowHigherOrderFunctions: true,
          },
        ],
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-ignore': 'allow-with-description',
          },
        ],
      },
      parserOptions: {
        project: ['./tsconfig.json'], // Specify it only for TypeScript files.
      },
    },
    {
      files: ['**/*.js'],
      rules: {
        ...ruleOverridesForJs,
        ...sharedRules,
      },
    },
  ],
};
