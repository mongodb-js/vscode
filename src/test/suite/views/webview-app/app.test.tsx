import assert from 'assert';
import * as React from 'react';
import sinon from 'sinon';
import { render, screen, act } from '@testing-library/react';
import App from '../../../../views/webview-app/app';
import { MESSAGE_TYPES } from '../../../../views/webview-app/extension-app-message-constants';

describe('App Component Test Suite', () => {
  let fakeVscodeWindowPostMessage;
  let fakeOnEventFunction;
  let fakeAddEventListener;

  beforeEach(() => {
    fakeVscodeWindowPostMessage = sinon.fake.returns(null);
    fakeAddEventListener = (eventName, eventFn): void => {
      if (eventName === 'message') {
        fakeOnEventFunction = eventFn;
      }
    };

    sinon.replace(
      (global as any).vscodeFake,
      'postMessage',
      fakeVscodeWindowPostMessage
    );

    sinon.replace(window, 'addEventListener', fakeAddEventListener);
  });

  afterEach(() => {
    sinon.restore();
  });

  test('it renders the old overview page when useNewConnectionForm is falsy', () => {
    render(<App />);
    assert.doesNotThrow(() => screen.getAllByTestId('legacy-app'));
  });

  test('it renders the new overview page when useNewConnectionForm is truthy', () => {
    render(<App />);
    act(() => {
      fakeOnEventFunction({
        data: {
          command: MESSAGE_TYPES.FEATURE_FLAGS_RESULTS,
          featureFlags: {
            useNewConnectionForm: true,
          },
        },
      });
    });
    assert.throws(() => screen.getAllByTestId('legacy-app'));
  });
});
