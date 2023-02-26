import type { OutputItem, RendererContext } from 'vscode-notebook-renderer';
import errorOverlay from 'vscode-notebook-error-overlay';

export interface RenderInfo {
  container: HTMLElement;
  mimeType: string;
  value: OutputItem;
  context: RendererContext<unknown>;
}

export const outputItem = (
  context: RendererContext<any>,
  render: (infro: RenderInfo) => void
) => {
  return {
    renderOutputItem(outputItem: OutputItem, element: HTMLElement) {
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
    disposeOutputItem(id?: string) {
      // Do any teardown here. outputId is the cell output being deleted, or
      // undefined if we're clearing all outputs.
    },
  };
};
