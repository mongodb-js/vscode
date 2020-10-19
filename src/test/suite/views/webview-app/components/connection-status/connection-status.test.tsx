import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';
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
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.text().includes('Connected to:'));
      assert(wrapper.text().includes('Active connection name'));
    });

    test('it shows a create playground button', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName="Active connection name"
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.find('button').exists());
    });
  });

  describe('disconnected', () => {
    test('it shows a disconnect message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.text().includes('Not connected'));
    });

    test('it does not show a create playground button', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.find('button').exists() === false);
    });
  });

  describe('connecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.CONNECTING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.text().includes('Connecting...'));
    });
  });

  describe('disconnecting', () => {
    test('it shows a connecting message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.DISCONNECTING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.text().includes('Disconnecting...'));
    });
  });

  describe('loading', () => {
    test('it shows a loading message', () => {
      const wrapper = shallow(<ConnectionStatus
        activeConnectionName=""
        connectionStatus={CONNECTION_STATUS.LOADING}
        onClickCreatePlayground={(): void => {}}
        requestConnectionStatus={(): void => {}}
      />);
      assert(wrapper.text().includes('Loading...'));
    });
  });
});
