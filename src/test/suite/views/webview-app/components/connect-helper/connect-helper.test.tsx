import assert from 'assert';
import * as React from 'react';
import * as sinon from 'sinon';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import ConnectHelper from '../../../../../../views/webview-app/components/connect-helper/connect-helper';
import {
  AppState,
  initialState,
  rootReducer,
} from '../../../../../../views/webview-app/store/store';

describe('Connect Helper Component Test Suite', () => {
  describe('when rendered', () => {
    let fakeVscodeWindowPostMessage;
    let wrapper;
    let store;

    beforeEach(() => {
      fakeVscodeWindowPostMessage = sinon.fake.returns(null);

      sinon.replace(
        (global as any).vscodeFake,
        'postMessage',
        fakeVscodeWindowPostMessage
      );

      store = createStore(rootReducer, {
        ...initialState,
      } as AppState);

      wrapper = mount(
        <Provider store={store}>
          <ConnectHelper />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('when onOpenConnectionStringInput is clicked it posts a message to vscode to open the input', () => {
      wrapper.find('button').at(0).simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert(
        fakeVscodeWindowPostMessage.firstCall.args[0].command ===
          'OPEN_CONNECTION_STRING_INPUT'
      );
    });

    test('when onOpenConnectionFrom is clicked it shows the connect form modal', () => {
      assert(store.getState().showConnectForm === false);
      wrapper.find('button').at(1).simulate('click');
      assert(store.getState().showConnectForm);
    });
  });
});
