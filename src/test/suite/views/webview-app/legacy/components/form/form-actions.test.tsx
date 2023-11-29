import assert from 'assert';
import * as React from 'react';
import sinon from 'sinon';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import FormActions from '../../../../../../../views/webview-app/legacy/components/form/form-actions';
import type { AppState } from '../../../../../../../views/webview-app/legacy/store/store';
import {
  initialState,
  rootReducer,
} from '../../../../../../../views/webview-app/legacy/store/store';

describe('Connect Form Actions Component Test Suite', () => {
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
        showConnectForm: true,
      } as AppState);

      wrapper = mount(
        <Provider store={store}>
          <FormActions />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('when connect is clicked it posts a message to vscode to connect', () => {
      assert(!fakeVscodeWindowPostMessage.called);
      wrapper.find('#connectButton').simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert(
        fakeVscodeWindowPostMessage.firstCall.args[0].command === 'CONNECT'
      );
      assert.deepStrictEqual(
        fakeVscodeWindowPostMessage.firstCall.args[0].connectionModel,
        store.getState().currentConnection
      );
    });

    test('when the cancel button is clicked it hides the connect form modal', () => {
      assert(store.getState().showConnectForm === true);
      wrapper.find('#cancelButton').simulate('click');
      assert(store.getState().showConnectForm === false);
    });
  });
});
