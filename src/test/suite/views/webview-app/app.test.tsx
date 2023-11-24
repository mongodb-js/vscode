import assert from 'assert';
import * as React from 'react';
import sinon from 'sinon';
import * as featureFlags from '../../../../featureFlags';
import { render, screen } from '@testing-library/react';
import App from '../../../../views/webview-app/app';

describe('App Component Test Suite', () => {
  afterEach(() => sinon.restore());
  test('it renders the old overview page when useNewConnectionForm is falsy', () => {
    sinon.stub(featureFlags, 'getFeatureFlag').returns(false);
    render(<App />);
    assert.doesNotThrow(() => screen.getAllByTestId('legacy-app'));
  });

  test('it renders the new overview page when useNewConnectionForm is truthy', () => {
    sinon.stub(featureFlags, 'getFeatureFlag').returns(true);
    render(<App />);
    assert.throws(() => screen.getAllByTestId('legacy-app'));
  });
});
