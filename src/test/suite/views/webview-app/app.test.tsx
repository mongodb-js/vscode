import * as React from 'react';

import { render, screen } from '@testing-library/react';
import App from '../../../../views/webview-app/app';

describe('App Component Test Suite', () => {
  it('it renders the overview page', () => {
    render(<App />);
    screen.getByTestId('overview-page');
  });
});
