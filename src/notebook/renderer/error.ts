import type { ActivationFunction } from 'vscode-notebook-renderer';
import { render } from './errorRenderer';

import { outputItem } from './outputItem';

export const activate: ActivationFunction = (context) => {
  if (context.postMessage) {
    context.postMessage({ request: 'errorRendererLaded' });
  }

  return outputItem(context, render);
};
