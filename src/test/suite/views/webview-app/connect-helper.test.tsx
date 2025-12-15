import React from 'react';
import { expect } from 'chai';
import { render, screen } from '@testing-library/react';
import ConnectHelper from '../../../../views/webview-app/connect-helper';
import Sinon from 'sinon';
import vscode from '../../../../views/webview-app/vscode-api';
import { MessageType } from '../../../../views/webview-app/extension-app-message-constants';

describe('ConnectHelper test suite', function () {
  it('when rendered it should show both connection options', function () {
    render(
      <ConnectHelper
        onClickOpenConnectionForm={(): void => {
          /* noop */
        }}
      />,
    );
    expect(screen.getByLabelText('Connect with connection string')).to.not.be
      .null;
    expect(screen.getByLabelText('Open connection form')).to.not.be.null;
  });

  it('when connecting with string, it should call vscode to open connection string input', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(
      <ConnectHelper
        onClickOpenConnectionForm={(): void => {
          /* noop */
        }}
      />,
    );
    screen.getByLabelText('Connect with connection string').click();
    expect(postMessageStub).to.have.been.calledWithExactly({
      command: MessageType.openConnectionStringInput,
    });
  });
});
