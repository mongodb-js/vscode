import Sinon from 'sinon';
import { expect } from 'chai';
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import ResourcesPanel, {
  TELEMETRY_SCREEN_ID,
} from '../../../../views/webview-app/resources-panel/panel';
import { MessageType } from '../../../../views/webview-app/extension-app-message-constants';
import { getVSCodeApi } from '../../../../views/webview-app/vscode-api';

describe('Resources panel test suite', function () {
  afterEach(function () {
    cleanup();
  });

  it('should render resources panel', function () {
    render(<ResourcesPanel onClose={(): void => {}} />);
    expect(screen.getByLabelText('Close')).to.exist;
    expect(screen.getAllByTestId(/link-\w+/)).to.have.length.greaterThan(0);
    expect(
      screen.getAllByTestId(/footer-feature-\w+/),
    ).to.have.length.greaterThan(0);
    expect(screen.getAllByTestId(/footer-link-\w+/)).to.have.length.greaterThan(
      0,
    );
  });

  it('should call onClose on close btn click', function () {
    const onCloseFake = Sinon.fake();
    render(<ResourcesPanel onClose={onCloseFake} />);
    screen.getByLabelText('Close').click();
    expect(onCloseFake).to.have.been.calledOnce;
  });

  it('should track link clicked event on click of any link', function () {
    const postMessageStub = Sinon.stub(getVSCodeApi(), 'postMessage');
    render(<ResourcesPanel onClose={(): void => {}} />);
    screen.getAllByTestId(/^link-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MessageType.extensionLinkClicked,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link.getAttribute('data-testid')?.replace('link-', ''),
      });
    });

    screen.getAllByTestId(/^footer-feature-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MessageType.extensionLinkClicked,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link
          .getAttribute('data-testid')
          ?.replace('footer-feature-', ''),
      });
    });

    screen.getAllByTestId(/^footer-link-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MessageType.extensionLinkClicked,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link.getAttribute('data-testid')?.replace('footer-link-', ''),
      });
    });
  });
});
