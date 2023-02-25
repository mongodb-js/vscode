import type { OutputItem, RendererContext } from 'vscode-notebook-renderer';
import { OutputLoader } from './outputLoader';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Grid } from '@githubocto/flat-ui';
import { Global, css } from '@emotion/react';

/**
 * Notebook cell output render info.
 */
interface IRenderInfo {
  container: HTMLElement;
  mimeType: string;
  value: OutputItem;
  context: RendererContext<unknown>;
}

const GridWithStyles = (props: any) => {
  return (
    <div>
      <Global
        styles={css`
          .github-octo-flat-ui {
            height: 560px !important;
            color: black !important;
          }
        `}
      />
      <Grid {...props} />
    </div>
  );
};

/**
 * Renders notebook cell output.
 * @param output Notebook cell output info to render.
 */
export function render(output: IRenderInfo) {
  // Load and parse output data.
  const outputLoader: OutputLoader = new OutputLoader(
    output.value,
    output.mimeType
  );
  const data = outputLoader.getData();

  if (Array.isArray(data)) {
    // Render flat data grid.
    ReactDOM.render(
      React.createElement(GridWithStyles, { data }, null),
      output.container
    );
  } else {
    // Create text output display nodes.
    const pre = document.createElement('pre');
    pre.className = 'text-output';
    const code = document.createElement('code');
    if (typeof data !== 'string') {
      code.textContent = JSON.stringify(data, null, 2);
    } else {
      code.textContent = output.value.text();
    }
    pre.appendChild(code);
    output.container.appendChild(pre);
  }
}
