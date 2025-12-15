import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import AtlasCta from '../../../../views/webview-app/atlas-cta';
import { expect } from 'chai';
import Sinon from 'sinon';
import vscode from '../../../../views/webview-app/vscode-api';
import { MessageType } from '../../../../views/webview-app/extension-app-message-constants';

describe('AtlasCta test suite', function () {
  afterEach(function () {
    cleanup();
    Sinon.restore();
  });

  it('should render Atlas CTA', function () {
    render(<AtlasCta />);
    expect(screen.getByText('Create free cluster')).to.not.be.null;
    expect(screen.getByTestId('link-atlas')).to.not.be.null;
  });

  it('should track clicks on MongoDB Atlas link', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<AtlasCta />);
    screen.getByTestId('link-atlas').click();
    expect(postMessageStub).to.be.calledWithExactly({
      command: MessageType.extensionLinkClicked,
      screen: 'overviewPage',
      linkId: 'atlasLanding',
    });
  });

  it('when clicked on "Create free cluster" button, it should open create account page on atlas and also track the link', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<AtlasCta />);
    screen.getByText('Create free cluster').click();
    expect(postMessageStub).calledTwice;
    expect(postMessageStub.firstCall.args[0].command).to.equal(
      MessageType.openTrustedLink,
    );
    expect(postMessageStub.secondCall.args[0].command).to.equal(
      MessageType.extensionLinkClicked,
    );
  });
});
