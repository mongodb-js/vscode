import React from 'react';
import { expect } from 'chai';
import { cleanup, render, screen } from '@testing-library/react';
import OverviewPage from '../../../../views/webview-app/overview-page';

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
});
