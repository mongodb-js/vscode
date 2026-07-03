import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import mochaPlugin from 'eslint-plugin-mocha';
import filenameRules from 'eslint-plugin-filename-rules';
import devtoolsPlugin from '@mongodb-js/eslint-plugin-devtools';
import sharedDevtools from '@mongodb-js/eslint-config-devtools';

/**
 * Flat-config adapter for the shared `@mongodb-js/eslint-config-devtools`.
 *
 * Import the single exported `devtoolsConfig` array and spread it into
 * `eslint.config.js`; it registers the devtools plugins and applies the shared
 * per-language rule maps (js / ts / test).
 *
 * Why this adapter exists:
 * - The shared devtools config is still authored in the legacy `.eslintrc`
 *   format: `plugins` is an array of strings and its per-language settings live
 *   under an `overrides` array whose entries use `env`, `parser` (as a string)
 *   and `extends: ['eslint:recommended', 'plugin:PLUGIN/recommended']`. None of
 *   that can be spread into flat config directly.
 * - The usual bridge, `FlatCompat`, does not work here either: it resolves
 *   those legacy `plugin:PLUGIN/recommended` strings, but the major-bumped
 *   plugins (eslint-plugin-mocha, typescript-eslint, ...) have dropped their
 *   legacy eslintrc configs, so the strings no longer resolve.
 *
 * So we do the two things flat config needs by hand: register the plugins the
 * rule maps reference, and reuse the shared config's rule maps. The rule maps
 * are plain objects, read off the MAIN entry's `overrides` (no subpath, so no
 * explicit `.js` extension is required under native ESM) matched by file glob.
 *
 * TODO(COMPASS-10812): once `@mongodb-js/eslint-config-devtools` ships a native flat
 * config, delete this adapter and consume that flat config directly.
 */
const devtoolsOverrides = sharedDevtools.overrides ?? [];

const devtoolsRulesFor = (glob) =>
  devtoolsOverrides.find((override) => override.files?.includes(glob))?.rules ??
  {};

export const devtoolsConfig = [
  js.configs.recommended,
  {
    name: 'devtools/plugins',
    plugins: {
      'filename-rules': filenameRules,
      '@mongodb-js/devtools': devtoolsPlugin,
    },
  },
  {
    name: 'devtools/js',
    files: ['**/*.js'],
    rules: devtoolsRulesFor('**/*.js'),
  },
  {
    name: 'devtools/ts',
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: devtoolsRulesFor('**/*.ts'),
  },
  {
    name: 'devtools/test',
    files: ['src/test/**/*.{ts,tsx}'],
    // The shared test rules turn some mocha/recommended rules back off, so they
    // must be spread after extending mocha/recommended.
    extends: [mochaPlugin.configs.recommended],
    rules: devtoolsRulesFor('**/*.test.ts'),
  },
];
