import type { ActivationFunction } from 'vscode-notebook-renderer';
import { render } from './chartRenderer';

import { outputItem } from './outputItem';

export const activate: ActivationFunction = (context) => {
  if (context.postMessage) {
    context.postMessage({ request: 'barChartRendererLoaded' });
  }

  return outputItem(context, render);
};
