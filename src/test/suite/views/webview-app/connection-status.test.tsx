import Sinon from 'sinon';
import { expect } from 'chai';
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import ConnectionStatus from '../../../../views/webview-app/connection-status';
import {
  CONNECTION_STATUS,
  MessageType,
} from '../../../../views/webview-app/extension-app-message-constants';
import getVSCodeApi from '../../../../views/webview-app/vscode-api';

describe('ConnectionStatus test suite', function () {
  afterEach(function () {
    cleanup();
    Sinon.restore();
  });

  it('should show a loading status by default', function () {
    render(<ConnectionStatus />);
    expect(screen.getByText('Loading...')).to.not.be.null;
  });

  it('should periodically request connection status', function () {
    const postMessageStub = Sinon.stub(getVSCodeApi(), 'postMessage');
    render(<ConnectionStatus />);
    expect(postMessageStub).to.have.been.calledWithExactly({
      command: MessageType.getConnectionStatus,
    });
  });

  describe('when GET_CONNECTION_STATUS gets responded with a disconnecting state', function () {
    it('should show a disconnecting status', function () {
      render(<ConnectionStatus />);
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.connectionStatusMessage,
              connectionStatus: CONNECTION_STATUS.disconnecting,
              activeConnectionName: '',
            },
          }),
        );
      });
      expect(screen.getByText('Disconnecting...')).to.not.be.null;
    });
  });

  describe('when GET_CONNECTION_STATUS gets responded with a disconnected state', function () {
    it('should show a disconnected status', function () {
      render(<ConnectionStatus />);
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.connectionStatusMessage,
              connectionStatus: CONNECTION_STATUS.disconnected,
              activeConnectionName: '',
            },
          }),
        );
      });
      expect(screen.getByText('Not connected.')).to.not.be.null;
    });
  });

  describe('when GET_CONNECTION_STATUS gets responded with a connecting state', function () {
    it('should show a connecting status', function () {
      render(<ConnectionStatus />);
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.connectionStatusMessage,
              connectionStatus: CONNECTION_STATUS.connecting,
              activeConnectionName: '',
            },
          }),
        );
      });
      expect(screen.getByText('Connecting...')).to.not.be.null;
    });
  });

  describe('when GET_CONNECTION_STATUS gets responded with a connected state', function () {
    beforeEach(function () {
      render(<ConnectionStatus />);
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.connectionStatusMessage,
              connectionStatus: CONNECTION_STATUS.connected,
              activeConnectionName: 'vscode-connection',
            },
          }),
        );
      });
    });

    it('should show a connected status', function () {
      expect(screen.getByText('Connected to:')).to.not.be.null;
      expect(screen.getByText('vscode-connection')).to.not.be.null;
    });

    it('should allow editing the name of the connection', function () {
      const postMessageStub = Sinon.stub(getVSCodeApi(), 'postMessage');
      screen.getByLabelText('Rename connection').click();

      expect(postMessageStub).to.be.calledWithExactly({
        command: MessageType.renameActiveConnection,
      });
    });

    it('should allow creating new playground', function () {
      const postMessageStub = Sinon.stub(getVSCodeApi(), 'postMessage');
      screen.getByLabelText('Create playground').click();

      expect(postMessageStub).to.be.calledWithExactly({
        command: MessageType.createNewPlayground,
      });
    });
  });
});
