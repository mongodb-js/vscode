import * as React from 'react';
import { createRoot } from 'react-dom/client';

import PreviewApp from './preview-app';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<PreviewApp />);

