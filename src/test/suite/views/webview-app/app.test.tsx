import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect } from 'chai';

import App from '../../../../views/webview-app/app';

describe('App Component Test Suite', () => {
  it('it renders the overview page', () => {
    expect.fail('this is meant to fail');
    render(<App />);
    expect(screen.getByTestId('overview-page')).to.exist;
  });
});
