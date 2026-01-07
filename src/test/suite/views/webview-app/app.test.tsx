import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect } from 'chai';

import App from '../../../../views/webview-app/app';

describe('App Component Test Suite', function () {
  it('it renders the overview page', function () {
    render(<App />);
    expect(screen.getByTestId('overview-page')).to.exist;
  });
});
