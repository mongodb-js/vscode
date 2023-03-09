import React from 'react';
import ReactDOM from 'react-dom';
import { Vega, VisualizationSpec } from 'react-vega';

import { OutputParser } from './outputParser';
import type { RenderInfo } from './outputItem';
import type { RendererContext } from 'vscode-notebook-renderer';

interface IChart {
  context: RendererContext<any>;
  data: any;
  darkMode: boolean;
  options: any;
}

function renderChart({
  context,
  container,
  data,
  darkMode,
  options
}: IChart & { container: HTMLElement }) {
  const barData = { table: data };


  const spec : VisualizationSpec = {
    width: 400,
    height: 200,
    mark: options?.type || 'bar',
    encoding: {
      x: { field: options?.x, type: 'ordinal' },
      y: { field: options?.y, type: 'quantitative' },
    },
    data: { name: 'table' }
  };

  ReactDOM.render(
    <Vega spec={spec} data={barData} actions={{ source: false, compiled: false, editor: false }} />,
    container
  );
}


/**
 * Renders notebook cell output.
 * @param output Notebook cell output info to render.
 */
export function render(output: RenderInfo) {
  const outputParser = new OutputParser(output.value, output.mimeType);
  const data = outputParser.getData();

  renderChart({ context: output.context, container: output.container, data, darkMode: false, options: outputParser.getMetadata()?.options });
}
