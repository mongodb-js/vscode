// Setup sinon-chai
import chai from 'chai';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

// JSDom
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRequire } from 'module';

// Create a require function that works in both ESM and CommonJS contexts
const requireModule = ((): NodeJS.Require => {
  if (typeof require !== 'undefined' && typeof require.cache === 'object') {
    // We're in CommonJS context
    return require;
  }

  // We're in ESM context, create require from import.meta.url
  // @ts-ignore - import.meta is not available in CommonJS context
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    // @ts-ignore - import.meta is not available in CommonJS context
    return createRequire(import.meta.url);
  }

  // Fallback: try to create require from current file location
  if (typeof __filename !== 'undefined') {
    return createRequire(__filename);
  }

  throw new Error(
    'Unable to create require function - neither ESM nor CommonJS context detected',
  );
})();

/**
 * NB: focus-trap and tabbable require special overrides to work in jsdom environments as per
 * documentation
 *
 * @see {@link https://github.com/focus-trap/tabbable?tab=readme-ov-file#testing-in-jsdom}
 */
const tabbable = requireModule('tabbable');

const origTabbable = { ...tabbable };

Object.assign(tabbable, {
  tabbable: (node, options) =>
    origTabbable.tabbable(node, { ...options, displayCheck: 'none' }),
  focusable: (node, options) =>
    origTabbable.focusable(node, { ...options, displayCheck: 'none' }),
  isFocusable: (node, options) =>
    origTabbable.isFocusable(node, { ...options, displayCheck: 'none' }),
  isTabbable: (node, options) =>
    origTabbable.isTabbable(node, { ...options, displayCheck: 'none' }),
});

const focusTrap = requireModule('focus-trap');

Object.assign(focusTrap, {
  ...focusTrap,
  createFocusTrap: () => {
    const trap = {
      activate: (): unknown => trap,
      deactivate: (): unknown => trap,
      pause: (): void => {},
      unpause: (): void => {},
    };
    return trap;
  },
});

const virtualConsole = new VirtualConsole();
virtualConsole.sendTo(console, { omitJSDOMErrors: true });
virtualConsole.on('jsdomError', (err) => {
  if (err.message !== 'Not implemented: navigation (except hash changes)') {
    console.error(err);
  }
});

global.window = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  virtualConsole,
}).window as any;

Object.getOwnPropertyNames(global.window).forEach((property) => {
  if (typeof global[property] !== 'undefined') {
    return;
  }

  if (property === 'undefined' || property.startsWith('_')) {
    return;
  }

  global[property] = global.window[property];
});

// Overwrites the node.js version which is incompatible with jsdom.
global.MessageEvent = global.window.MessageEvent;

// TextDecoder, TextEncoder: required by
// node_modules/mongodb-connection-string-url/node_modules/whatwg-url/lib/encoding.js
// and not available in JSDOM, we patch it with the node.js implementations.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });

(global as any).vscodeFake = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage: (message: unknown): void => {},
};

(global as any).acquireVsCodeApi = (): any => {
  return (global as any).vscodeFake;
};
