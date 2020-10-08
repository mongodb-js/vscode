import * as assert from 'assert';
import * as React from 'react';
import * as sinon from 'sinon';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import ConnectHelper from '../../../../../../views/webview-app/components/connect-helper/connect-helper';
import {
  rootReducer
} from '../../../../../../views/webview-app/store/store';
import { WEBVIEW_VIEWS } from '../../../../../../views/webview-app/extension-app-message-constants';

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
        currentView: 'OVERVIEW'
      } as any);

      wrapper = mount(
        <Provider
          store={store}
        >
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
      assert(fakeVscodeWindowPostMessage.firstCall.args[0].command === 'OPEN_CONNECTION_STRING_INPUT');
    });

    test('when onOpenConnectionFrom is clicked it changes the webview to connect', () => {
      assert(store.getState().currentView === WEBVIEW_VIEWS.OVERVIEW);
      wrapper.find('button').at(1).simulate('click');
      assert(store.getState().currentView === WEBVIEW_VIEWS.CONNECT);
    });
  });
});
