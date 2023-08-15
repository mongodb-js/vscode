import assert from 'assert';
import * as React from 'react';
import { mount, shallow } from 'enzyme';
import sinon from 'sinon';
import { Provider } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createStore } from 'redux';

import type { AppState } from '../../../../../../views/webview-app/store/store';
import {
  initialState,
  rootReducer,
} from '../../../../../../views/webview-app/store/store';
import ConnectForm from '../../../../../../views/webview-app/components/connect-form/connection-form';
import ConnectFormModal, {
  ConnectFormModal as NoStoreConnectFormModal,
} from '../../../../../../views/webview-app/components/connect-form-modal/connect-form-modal';

describe('Connect Form Modal Component Test Suite', () => {
  describe('when rendered', () => {
    const wrapper = shallow(
      <NoStoreConnectFormModal toggleShowConnectForm={(): void => {}} />
    );

    test('it shows the connection form', () => {
      assert(wrapper.find(ConnectForm).exists());
    });

    test('it shows a close icon', () => {
      assert(wrapper.find(FontAwesomeIcon).exists());
    });
  });

  describe('store actions', () => {
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
          <ConnectFormModal />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('when the x is clicked it closes the connect form', () => {
      assert(store.getState().showConnectForm === true);
      wrapper.find('button').at(0).simulate('click');
      assert(store.getState().showConnectForm === false);
    });
  });
});
