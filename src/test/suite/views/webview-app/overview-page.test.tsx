import React from 'react';
import { expect } from 'chai';
import Sinon from 'sinon';
import { cleanup, render, screen, act } from '@testing-library/react';

import OverviewPage from '../../../../views/webview-app/overview-page';
import vscode from '../../../../views/webview-app/vscode-api';
import { MESSAGE_TYPES } from '../../../../views/webview-app/extension-app-message-constants';

const connectionFormTestId = 'connection-form-modal';

describe('OverviewPage test suite', function () {
  afterEach(() => {
    cleanup();
    Sinon.restore();
  });
  test('it should render OverviewPage', function () {
    render(<OverviewPage />);
    expect(
      screen.getByText(
        'Navigate your databases and collections, use playgrounds for exploring and transforming your data'
      )
    ).to.exist;
  });

  test('on click of resources, it should open resources panel', function () {
    render(<OverviewPage />);
    screen.getByText('Resources').click();
    expect(screen.getByText('Product overview')).to.exist;
  });

  test('on click of close button on resources panel, it should close resources panel', function () {
    render(<OverviewPage />);
    screen.getByText('Resources').click();
    screen.getByLabelText('Close').click();
    expect(screen.queryByText('Product overview')).to.be.null;
  });

  describe('Connection Form', function () {
    test('it is able to open and close the new connection form', function () {
      render(<OverviewPage />);

      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
      const postMessageSpy = Sinon.spy(vscode, 'postMessage');
      expect(postMessageSpy).to.not.be.called;

      screen.getByText('Open form').click();
      expect(screen.getByTestId(connectionFormTestId)).to.exist;
      const message = postMessageSpy.firstCall.args[0];
      expect(message).to.deep.equal({
        command: MESSAGE_TYPES.CONNECTION_FORM_OPENED,
      });

      screen.getByLabelText('Close modal').click();
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
    });

    it('should send connect request to webview controller when clicked on Connect button', function () {
      const postMessageSpy = Sinon.spy(vscode, 'postMessage');

      render(<OverviewPage />);
      screen.getByText('Open form').click();

      expect(screen.getByDisplayValue('mongodb://localhost:27017/')).to.not.be
        .null;
      screen.getByTestId('connect-button').click();
      const argsWithoutConnectId = postMessageSpy.lastCall.args[0] as any;
      expect(argsWithoutConnectId.command).to.equal(MESSAGE_TYPES.CONNECT);
      expect(
        argsWithoutConnectId.connectionInfo.connectionOptions.connectionString
      ).to.equal('mongodb://localhost:27017');
    });

    it('should display error message returned from connection attempt', function () {
      render(<OverviewPage />);
      const postMessageSpy = Sinon.spy(vscode, 'postMessage');
      screen.getByText('Open form').click();
      screen.getByTestId('connect-button').click();
      const connectionAttemptId = (postMessageSpy.lastCall.args[0] as any)
        .connectionAttemptId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MESSAGE_TYPES.CONNECT_RESULT,
              connectionAttemptId,
              connectionSuccess: false,
              connectionMessage: 'server not found',
            },
          })
        );
      });
      expect(screen.queryByTestId('connection-error-summary')).to.not.be.null;
    });

    it('should close the connection modal when connected successfully', function () {
      render(<OverviewPage />);
      const postMessageSpy = Sinon.spy(vscode, 'postMessage');
      screen.getByText('Open form').click();
      screen.getByTestId('connect-button').click();
      const connectionAttemptId = (postMessageSpy.lastCall.args[0] as any)
        .connectionAttemptId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MESSAGE_TYPES.CONNECT_RESULT,
              connectionAttemptId,
              connectionSuccess: true,
              connectionMessage: '',
            },
          })
        );
      });
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
    });

    it('should show the connection form and the connection name when an editing request happens', function () {
      render(<OverviewPage />);

      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;
      expect(screen.queryByText('pineapple')).to.not.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MESSAGE_TYPES.OPEN_EDIT_CONNECTION,
              connection: {
                id: 'test',
                name: 'pineapple',
                connectionOptions: {
                  connectionString: 'mongodb://localhost:27017',
                },
              },
            },
          })
        );
      });
      expect(screen.getByTestId(connectionFormTestId)).to.exist;
      expect(screen.getByText('pineapple')).to.exist;
    });

    it('should not display results from other connection attempts', function () {
      render(<OverviewPage />);
      screen.getByText('Open form').click();
      screen.getByTestId('connect-button').click();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MESSAGE_TYPES.CONNECT_RESULT,
              connectionAttemptId: 1, // different from the attempt id generated by our click
              connectionSuccess: true,
              connectionMessage: '',
            },
          })
        );
      });
      // won't be closed because the connect result message is ignored
      expect(screen.queryByTestId(connectionFormTestId)).to.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: MESSAGE_TYPES.CONNECT_RESULT,
              connectionAttemptId: 2, // different from the attempt id generated by our click
              connectionSuccess: false,
              connectionMessage: 'something bad happened',
            },
          })
        );
      });
      expect(screen.queryByTestId(connectionFormTestId)).to.exist;
      // won't show an error message because the connect result is ignored.
      expect(screen.queryByTestId('connection-error-summary')).to.not.be
        .undefined;
    });
  });
});
