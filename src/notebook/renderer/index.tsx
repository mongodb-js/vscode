import { render } from './render';
import errorOverlay from 'vscode-notebook-error-overlay';
import type { ActivationFunction } from 'vscode-notebook-renderer';

export const activate: ActivationFunction = (context) => {
  return {
    renderOutputItem(outputItem, element) {
      errorOverlay.wrap(element, () => {
        const cellOutputContainer: HTMLDivElement =
          document.createElement('div');
        element.appendChild(cellOutputContainer);
        render({
          container: cellOutputContainer,
          mimeType: outputItem.mime,
          value: outputItem,
          context,
        });
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disposeOutputItem(_outputId) {
      // Do any teardown here. outputId is the cell output being deleted, or
      // undefined if we're clearing all outputs.
    },
  };
};
