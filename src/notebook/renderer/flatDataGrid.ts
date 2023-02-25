import type { ActivationFunction, OutputItem } from 'vscode-notebook-renderer';
import errorOverlay from 'vscode-notebook-error-overlay';
import { render } from './flatDataGridRenderer';

export const activate: ActivationFunction = (context) => {
  return {
    renderOutputItem(outputItem: OutputItem, element: HTMLElement) {
      errorOverlay.wrap(element, () => {
        const cellOutputContainer: HTMLDivElement =
          document.createElement('div');
        cellOutputContainer.className = 'flat-data-grid';
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
