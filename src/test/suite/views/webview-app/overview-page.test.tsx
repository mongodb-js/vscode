import React from 'react';
import { expect } from 'chai';
import { cleanup, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import OverviewPage from '../../../../views/webview-app/overview-page';
import * as featureFlags from '../../../../featureFlags';

describe('OverviewPage test suite', function () {
  afterEach(cleanup);
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

  describe('with the new connection form feature flag useNewConnectionForm enabled', function () {
    beforeEach(function () {
      sinon.stub(featureFlags, 'getFeatureFlag').returns(true);

      render(<OverviewPage />);
    });

    test('it renders the new connection form when opened', function () {
      const connectionFormTestId = 'connection-form-modal';
      expect(screen.queryByTestId(connectionFormTestId)).to.not.exist;

      screen.getByText('Open form').click();
      expect(screen.getByTestId(connectionFormTestId)).to.exist;
    });
  });
});
