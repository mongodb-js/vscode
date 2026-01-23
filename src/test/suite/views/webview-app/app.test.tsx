import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect } from 'chai';

import App from '../../../../views/app';

describe('App Component Test Suite', function () {
  it('it renders the overview page', async function () {
    render(<App />);
    // Use findByTestId to wait for lazy-loaded component to render
    expect(await screen.findByTestId('overview-page')).to.exist;
  });
});
