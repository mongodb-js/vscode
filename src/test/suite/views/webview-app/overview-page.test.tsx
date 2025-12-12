import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OverviewPage from '../../../../views/webview-app/overview-page';
import vscode from '../../../../views/webview-app/vscode-api';
import type { MessageFromWebviewToExtension } from '../../../../views/webview-app/extension-app-message-constants';
import { MessageType } from '../../../../views/webview-app/extension-app-message-constants';

const connectionFormTestId = 'connection-form-modal';

describe('OverviewPage test suite', function () {
  afterEach(() => {
    cleanup();
    sinon.restore();
  });

  it('should render the OverviewPage', function () {
    render(<OverviewPage />);
    expect(
      screen.getByText(
        'Navigate your databases and collections, use playgrounds for exploring and transforming your data',
      ),
    ).to.exist;
  });

  it('should open and close the resources panel', async function () {
    render(<OverviewPage />);

    expect(screen.queryByText('Product overview')).to.not.exist;
    await userEvent.click(screen.getByText('Resources'));
    expect(screen.getByText('Product overview')).to.exist;

    await userEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Product overview')).to.be.null;
  });

  describe('Connection Form', function () {
    // Rendering the connection form takes ~4 seconds, so we need to increase the timeout.
    // Not sure on the cause of this slowdown, it could be animation based.
    // Without this it's flaky on mac CI.
    // TODO(COMPASS-7762): Once we update the connection form this may be able to go away.
    this.timeout(25000);
    it('is able to open and close the new connection form', async function () {
      render(<OverviewPage />);

      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
      const postMessageSpy = sinon.spy(vscode, 'postMessage');
      expect(postMessageSpy).to.not.be.called;

      await userEvent.click(screen.getByTestId('open-connection-form-button'));

      expect(screen.getByTestId(connectionFormTestId)).to.exist;
      const message = postMessageSpy.firstCall.args[0];
      expect(message).to.deep.equal({
        command: MessageType.CONNECTION_FORM_OPENED,
      });

      await userEvent.click(screen.getByLabelText('Close modal'));
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
    });

    it('should send connect request to webview controller when clicked on Connect button', async function () {
      const postMessageSpy = sinon.spy(vscode, 'postMessage');

      render(<OverviewPage />);
      await userEvent.click(screen.getByTestId('open-connection-form-button'));

      expect(screen.getByDisplayValue('mongodb://localhost:27017/')).to.not.be
        .null;
      await userEvent.click(screen.getByTestId('connect-button'));
      const argsWithoutConnectId = postMessageSpy.lastCall.args[0] as any;
      expect(argsWithoutConnectId.command).to.equal(MessageType.CONNECT);
      expect(
        argsWithoutConnectId.connectionInfo.connectionOptions.connectionString,
      ).to.equal('mongodb://localhost:27017');
    });

    it('should display error message returned from connection attempt', async function () {
      render(<OverviewPage />);
      const postMessageSpy = sinon.spy(vscode, 'postMessage');
      await userEvent.click(screen.getByTestId('open-connection-form-button'));
      await userEvent.click(screen.getByTestId('connect-button'));
      const connectionId = (postMessageSpy.lastCall.args[0] as any)
        .connectionInfo.id;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.CONNECT_RESULT,
              connectionId,
              connectionSuccess: false,
              connectionMessage: 'server not found',
            },
          }),
        );
      });
      expect(screen.queryByTestId('connection-error-summary')).to.not.be.null;
    });

    it('should close the connection modal when connected successfully', async function () {
      render(<OverviewPage />);
      const postMessageSpy = sinon.spy(vscode, 'postMessage');
      await userEvent.click(screen.getByTestId('open-connection-form-button'));
      await userEvent.click(screen.getByTestId('connect-button'));
      const connectionId = (postMessageSpy.lastCall.args[0] as any)
        .connectionInfo.id;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.CONNECT_RESULT,
              connectionId,
              connectionSuccess: true,
              connectionMessage: '',
            },
          }),
        );
      });
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
    });

    it('should handle editing a connection', async function () {
      render(<OverviewPage />);

      const postMessageSpy = sinon.spy(vscode, 'postMessage');
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
      expect(screen.queryByText('pineapple')).to.not.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.OPEN_EDIT_CONNECTION,
              connection: {
                id: 'pear',
                name: 'pineapple',
                connectionOptions: {
                  connectionString: 'mongodb://localhost:27099',
                },
              },
            },
          }),
        );
      });

      // Shows the connection name that's being edited..
      expect(screen.getByTestId(connectionFormTestId)).to.exist;
      expect(screen.getByText('pineapple')).to.exist;

      const getConnectMessages = (): sinon.SinonSpyCall<
        [message: MessageFromWebviewToExtension],
        void
      >[] => {
        return postMessageSpy
          .getCalls()
          .filter(
            (call) =>
              call.args[0].command === MessageType.EDIT_CONNECTION_AND_CONNECT,
          );
      };
      expect(getConnectMessages()).to.have.length(0);
      await userEvent.click(screen.getByTestId('connect-button'));
      const connectMessages = getConnectMessages();
      expect(connectMessages).to.have.length(1);

      expect(connectMessages[0].args[0]).to.deep.equal({
        command: 'EDIT_CONNECTION_AND_CONNECT',
        connectionInfo: {
          id: 'pear',
          connectionOptions: {
            connectionString: 'mongodb://localhost:27099',
          },
        },
      });
    });

    it('should not display results from other connection attempts', async function () {
      render(<OverviewPage />);
      await userEvent.click(screen.getByTestId('open-connection-form-button'));
      await userEvent.click(screen.getByTestId('connect-button'));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.CONNECT_RESULT,
              connectionId: 1, // different from the attempt id generated by our click
              connectionSuccess: true,
              connectionMessage: '',
            },
          }),
        );
      });
      // won't be closed because the connect result message is ignored
      expect(screen.queryByTestId(connectionFormTestId)).to.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MessageType.CONNECT_RESULT,
              connectionId: 2, // different from the attempt id generated by our click
              connectionSuccess: false,
              connectionMessage: 'something bad happened',
            },
          }),
        );
      });
      expect(screen.queryByTestId(connectionFormTestId)).to.exist;
      // won't show an error message because the connect result is ignored.
      expect(screen.queryByTestId('connection-error-summary')).to.not.be
        .undefined;
    });
  });
});
