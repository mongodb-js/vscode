import assert from 'assert';
import * as React from 'react';
import * as sinon from 'sinon';
import { mount, shallow } from 'enzyme';
import { createStore } from 'redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import { Provider } from 'react-redux';

import ConnectionStatus, {
  ConnectionStatus as PlainConnectionStatus
} from '../../../../../../views/webview-app/components/connection-status/connection-status';
import { CONNECTION_STATUS } from '../../../../../../views/webview-app/extension-app-message-constants';
import {
  AppState,
  initialState,
  rootReducer
} from '../../../../../../views/webview-app/store/store';

describe('Connection Status Component Test Suite', () => {
  describe('connected connection status', () => {
    test('it shows that it is connected to the connection name', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.text().includes('Connected to:'));
      assert(wrapper.text().includes('Active connection name'));
    });

    test('it shows a create playground button', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.find('button').exists());
    });

    test('it shows an edit connection name button', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.find(FontAwesomeIcon).prop('icon') === faPencilAlt);
    });

    describe('with store actions', () => {
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
          connectionStatus: CONNECTION_STATUS.CONNECTED
        } as AppState);

        wrapper = mount(
          <Provider
            store={store}
          >
            <ConnectionStatus
              requestConnectionStatus={(): void => {}}
            />
          </Provider>
        );
      });

      afterEach(() => {
        sinon.restore();
      });

      test('when the edit connection name button is clicked it posts a message to the extension to rename the connection', () => {
        wrapper.find('button').at(0).simulate('click');
        assert(fakeVscodeWindowPostMessage.called);
        assert(fakeVscodeWindowPostMessage.secondCall.args[0].command === 'RENAME_ACTIVE_CONNECTION');
      });
    });
  });

  describe('disconnected', () => {
    test('it shows a disconnect message', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.text().includes('Not connected'));
    });

    test('it does not show a create playground button', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.find('button').exists() === false);
    });
  });

  describe('connecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.CONNECTING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.text().includes('Connecting...'));
    });
  });

  describe('disconnecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.text().includes('Disconnecting...'));
    });
  });

  describe('loading', () => {
    test('it shows a loading message', () => {
      const wrapper = shallow(<PlainConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.LOADING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
        onClickRenameConnection={(): void => {}}
      />);
      assert(wrapper.text().includes('Loading...'));
    });
  });
});
