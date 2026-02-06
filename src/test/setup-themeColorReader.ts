/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/explicit-function-return-type */
/**
 * Minimal mock of the `vscode` module so that themeColorReader.ts and logging.ts
 * can be loaded outside the VS Code extension host (e.g. with mocha + ts-node).
 */
import Module from 'module';

const noopChannel = {
  trace: () => {
    /* no-op */
  },
  debug: () => {
    /* no-op */
  },
  info: () => {
    /* no-op */
  },
  warn: () => {
    /* no-op */
  },
  error: () => {
    /* no-op */
  },
  appendLine: () => {
    /* no-op */
  },
  dispose: () => {
    /* no-op */
  },
};

const vscodeMock = {
  window: {
    activeColorTheme: { kind: 2 /* Dark */ },
    createOutputChannel: () => noopChannel,
  },
  workspace: {
    getConfiguration: () => ({
      get: () => undefined,
    }),
  },
  extensions: {
    all: [],
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4,
  },
};

// Intercept `require('vscode')` calls
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  if (request === 'vscode') {
    return 'vscode'; // Return as-is; we'll intercept in _cache
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Place the mock into the require cache
const fakeModule = new Module('vscode');
fakeModule.exports = vscodeMock;
(fakeModule as any).loaded = true;
require.cache['vscode'] = fakeModule;
