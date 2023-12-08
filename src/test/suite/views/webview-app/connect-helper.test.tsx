import React from 'react';
import { expect } from 'chai';
import { render, screen } from '@testing-library/react';
import ConnectHelper from '../../../../views/webview-app/connect-helper';
import Sinon from 'sinon';
import vscode from '../../../../views/webview-app/vscode-api';
import { MESSAGE_TYPES } from '../../../../views/webview-app/extension-app-message-constants';

describe('ConnectHelper test suite', function () {
  test('when rendered it should show both connection options', function () {
    render(
      <ConnectHelper
        onClickOpenConnectionForm={() => {
          /* noop */
        }}
      />
    );
    expect(screen.getByLabelText('Connect with connection string')).to.not.be
      .null;
    expect(screen.getByLabelText('Open connection form')).to.not.be.null;
  });

  test('when connecting with string, it should call vscode to open connection string input', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(
      <ConnectHelper
        onClickOpenConnectionForm={() => {
          /* noop */
        }}
      />
    );
    screen.getByLabelText('Connect with connection string').click();
    expect(postMessageStub).to.have.been.calledWithExactly({
      command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT,
    });
  });

  test.skip('when clicked on open connection form, it should open connection form', function () {
    // TODO(VSCODE-488)
  });
});
