import { defineConfig } from 'eslint/config';
import { devtoolsConfig } from './eslint-devtools.js';

const extraTsRules = {
  '@typescript-eslint/no-explicit-any': 0,
  '@typescript-eslint/no-floating-promises': 2,
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
    { allowHigherOrderFunctions: true },
  ],
  '@typescript-eslint/ban-ts-comment': [
    'error',
    { 'ts-ignore': 'allow-with-description' },
  ],
};

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'scripts/**',
      'src/vscode-dts/**',
      'ext/agent-skills/**',
      'playwright-report/**',
      'test-results/**',
      '.claude/**',
      '.vscode-test/**',
    ],
  },
  // Base JS/TS config plus the devtools plugins and shared rule maps.
  ...devtoolsConfig,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    rules: {
      // TODO(VSCODE-724): Update our file naming and enable this rule.
      // We have a lot of files that do not match the filename rules.
      'filename-rules/match': 0,
      'no-console': [1, { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...extraTsRules,
    },
  },
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      // Chai assertions such as `expect(x).to.be.true` are expressions.
      '@typescript-eslint/no-unused-expressions': 0,
      'no-console': 0,
    },
  },
]);
