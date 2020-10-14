import assert from 'assert';
import * as React from 'react';
import { mount, shallow } from 'enzyme';
import * as sinon from 'sinon';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import {
  rootReducer
} from '../../../../../../views/webview-app/store/store';
import {
  ConnectionStatus
} from '../../../../../../views/webview-app/components/connection-status/connection-status';
import { CONNECTION_STATUS } from '../../../../../../views/webview-app/extension-app-message-constants';

describe('Connection Status Component Test Suite', () => {
  describe('connected connection status', () => {
    test('it shows that it is connected to the connection name', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.text().includes('Connected to:'));
      assert(wrapper.text().includes('Active connection name'));
    });

    test('it shows a create playground button', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.find('button').exists());
    });
  });

  describe('disconnected', () => {
    test('it shows a disconnect message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.text().includes('Not connected'));
    });

    test('it does not show a create playground button', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.find('button').exists() === false);
    });
  });

  describe('connecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.CONNECTING}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.text().includes('Connecting...'));
    });
  });

  describe('disconnecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTING}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.text().includes('Disconnecting...'));
    });
  });

  describe('loading', () => {
    test('it shows a loading message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.LOADING}
        onClickCreatePlayground={() => {}}
        requestConnectionStatus={() => {}}
      />);
      assert(wrapper.text().includes('Loading...'));
    });
  });
});
