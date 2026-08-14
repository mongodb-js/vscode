import React from 'react';
import { createRoot } from 'react-dom/client';
import { resetGlobalCSS } from '@mongodb-js/compass-components';

import App from '../app';

resetGlobalCSS();

const container = document.getElementById('root');
const root = createRoot(container as HTMLElement);
root.render(<App />);
