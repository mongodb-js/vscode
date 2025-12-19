import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect } from 'chai';

import App from '../../../../views/data-browsing-app/app';

describe('Data Browsing App Component Test Suite', function () {
  it('it renders the preview page', function () {
    render(<App />);
    expect(screen.getByLabelText('Insert Document')).to.exist;
  });
});
