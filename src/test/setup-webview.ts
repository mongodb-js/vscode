// Setup sinon-chai
import chai from 'chai';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

// JSDom
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * NB: focus-trap and tabbable require special overrides to work in jsdom environments as per
 * documentation
 *
 * @see {@link https://github.com/focus-trap/tabbable?tab=readme-ov-file#testing-in-jsdom}
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tabbable = require('tabbable');

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const focusTrap = require('focus-trap');

Object.assign(focusTrap, {
  ...focusTrap,
  createFocusTrap: () => {
    const trap = {
      activate: (): unknown => trap,
      deactivate: (): unknown => trap,
      pause: (): void => {
        /* no-op */
      },
      unpause: (): void => {
        /* no-op */
      },
    };
    return trap;
  },
});

const virtualConsole = new VirtualConsole();
virtualConsole.sendTo(console, { omitJSDOMErrors: true });
virtualConsole.on('jsdomError', (err) => {
  // Ignore navigation not implemented errors
  if (err.message === 'Not implemented: navigation (except hash changes)') {
    return;
  }

  // Ignore @vscode-elements/elements slot handling errors in JSDOM
  // These occur because JSDOM's shadow DOM implementation doesn't fully match browser behavior
  if (
    err.detail?.message?.includes("reading 'trim'") &&
    err.detail?.stack?.includes('vscode-select-base')
  ) {
    return;
  }

  console.error(err);
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

// Polyfill for Constructable Stylesheets (required by @vscode-elements/elements)
if (
  typeof CSSStyleSheet !== 'undefined' &&
  !CSSStyleSheet.prototype.replaceSync
) {
  CSSStyleSheet.prototype.replaceSync = function (): void {
    // no-op: styles are not applied in test environment
  };

  CSSStyleSheet.prototype.replace = function (): Promise<CSSStyleSheet> {
    return Promise.resolve(this);
  };
}

// Polyfill for ResizeObserver (required by @vscode-elements/elements)
// JSDOM does not support ResizeObserver, so we provide a no-op implementation
class ResizeObserverPolyfill {
  observe(): void {
    // no-op
  }
  unobserve(): void {
    // no-op
  }
  disconnect(): void {
    // no-op
  }
}

global.ResizeObserver = ResizeObserverPolyfill as any;
global.window.ResizeObserver = ResizeObserverPolyfill as any;

// Overwrites the node.js version which is incompatible with jsdom.
global.MessageEvent = global.window.MessageEvent;

// TextDecoder, TextEncoder: required by
// node_modules/mongodb-connection-string-url/node_modules/whatwg-url/lib/encoding.js
// and not available in JSDOM, we patch it with the node.js implementations.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });

(global as any).vscodeFake = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage: (message: unknown): void => {
    /* no-op */
  },
};

(global as any).acquireVsCodeApi = (): any => {
  return (global as any).vscodeFake;
};
