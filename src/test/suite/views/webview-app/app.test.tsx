import { expect } from 'chai';
import * as React from 'react';
import sinon from 'sinon';
import * as featureFlags from '../../../../featureFlags';
import { render, screen } from '@testing-library/react';
import App from '../../../../views/webview-app/app';

describe('App Component Test Suite', () => {
  afterEach(() => sinon.restore());
  test('it renders the old overview page when useOldConnectionForm is falsy', () => {
    sinon.stub(featureFlags, 'getFeatureFlag').returns(false);
    render(<App />);
    expect(screen.queryByTestId('legacy-app')).to.be.null;
  });

  test('it renders the new overview page when useOldConnectionForm is truthy', () => {
    sinon.stub(featureFlags, 'getFeatureFlag').returns(true);
    render(<App />);
    expect(() => screen.getAllByTestId('legacy-app')).does.not.throw;
  });
});
