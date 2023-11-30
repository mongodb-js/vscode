import Sinon from 'sinon';
import { expect } from 'chai';
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import ResourcesPanel, {
  TELEMETRY_SCREEN_ID,
} from '../../../../views/webview-app/resources-panel/panel';
import { MESSAGE_TYPES } from '../../../../views/webview-app/extension-app-message-constants';
import vscode from '../../../../views/webview-app/vscode-api';

describe('Resources panel test suite', function () {
  afterEach(function () {
    cleanup();
  });

  test('it should render resources panel', function () {
    render(<ResourcesPanel onClose={() => {}} />);
    expect(() => screen.getByLabelText('Close')).to.not.throw;
    expect(screen.getAllByTestId(/link-\w+/)).to.have.length.greaterThan(0);
    expect(
      screen.getAllByTestId(/footer-feature-\w+/)
    ).to.have.length.greaterThan(0);
    expect(screen.getAllByTestId(/footer-link-\w+/)).to.have.length.greaterThan(
      0
    );
  });

  test('it should call onClose on close btn click', function () {
    const onCloseFake = Sinon.fake();
    render(<ResourcesPanel onClose={onCloseFake} />);
    screen.getByLabelText('Close').click();
    expect(onCloseFake).to.have.been.calledOnce;
  });

  test('it should track link clicked event on click of any link', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<ResourcesPanel onClose={() => {}} />);
    screen.getAllByTestId(/^link-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link.getAttribute('data-testid')?.replace('link-', ''),
      });
    });

    screen.getAllByTestId(/^footer-feature-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link
          .getAttribute('data-testid')
          ?.replace('footer-feature-', ''),
      });
    });

    screen.getAllByTestId(/^footer-link-\w+/).forEach((link) => {
      link.click();
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
        screen: TELEMETRY_SCREEN_ID,
        linkId: link.getAttribute('data-testid')?.replace('footer-link-', ''),
      });
    });
  });
});
