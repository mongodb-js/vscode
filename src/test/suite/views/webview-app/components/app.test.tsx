// @ts-nocheck

import assert from 'assert';
import * as React from 'react';
import { mount, shallow } from 'enzyme';
import sinon from 'sinon';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import {
  initialState,
  rootReducer,
} from '../../../../../views/webview-app/store/store';
import App, {
  App as NotConnectedApp,
} from '../../../../../views/webview-app/components/app';
import OverviewPage from '../../../../../views/webview-app/components/overview-page/overview-page';
import {
  CONNECTION_STATUS,
  MESSAGE_TYPES,
} from '../../../../../views/webview-app/extension-app-message-constants';

describe('App Component Test Suite', () => {
  describe('when rendered', () => {
    test('it shows the overview page', () => {
      const wrapper = shallow(
        <NotConnectedApp
          onConnectedEvent={(): void => {}}
          onFilePickerEvent={(): void => {}}
          setConnectionStatus={(): void => {}}
        />
      );
      assert(wrapper.find(OverviewPage).exists());
    });
  });

  describe('when the extension sends a connection status message', () => {
    let fakeVscodeWindowPostMessage;
    let store;
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

      store = createStore(rootReducer, initialState);

      mount(
        <Provider store={store}>
          <App />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('it updates the connectionStatus in the store', () => {
      assert(store.getState().connectionStatus === CONNECTION_STATUS.LOADING);
      assert(store.getState().activeConnectionName === '');
      fakeOnEventFunction({
        data: {
          command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE,
          connectionStatus: CONNECTION_STATUS.CONNECTED,
          activeConnectionName: 'Nice connection',
        },
      });
      assert(store.getState().connectionStatus === CONNECTION_STATUS.CONNECTED);
      assert(store.getState().activeConnectionName === 'Nice connection');
    });
  });
});
