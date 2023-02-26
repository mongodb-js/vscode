import type { ActivationFunction } from 'vscode-notebook-renderer';
import { render } from './leafyGreenTableRenderer';

import { outputItem } from './outputItem';

export const activate: ActivationFunction = (context) => {
  if (context.postMessage) {
    context.postMessage({ command: 'mdb-leafy-green-table-renderer-loaded' });
  }

  return outputItem(context, render);
};
