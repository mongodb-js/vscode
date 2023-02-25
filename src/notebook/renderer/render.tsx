import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { css } from '@emotion/css';

import type { RendererContext, OutputItem } from 'vscode-notebook-renderer';

/**
 * Notebook cell output render info.
 */
interface IRenderInfo {
  container: HTMLElement;
  mimeType: string;
  value: OutputItem;
  context: RendererContext<unknown>;
}

interface NotebookOutputErrorProps {
  error: Error | { message: string };
}

const NotebookOutputError = ({ error }: NotebookOutputErrorProps) => {
  const [errorClosed, setErrorClosed] = useState(false);

  const onCloseError = () => {
    setErrorClosed(true);
  };

  const rootStyles = css({
    fontSize: '13px',
    background: 'rgb(90, 29, 29)',
    border: '1px solid rgb(190, 17, 0)',
    padding: '5px',
    margin: '-6px',
  });

  const titleStyles = css({
    fontSize: '1.5em',
    margin: '0px 0px 0.25em',
    fontWeight: 'normal',
  });

  const textStyles = css({
    fontFamily: 'Menlo, Monaco, &quot;Courier New&quot;, monospace',
    fontSize: '12px',
    fontWeight: 'normal',
    width: '100%',
    overflowX: 'auto',
    lineHeight: '1.5em',
    background: 'rgba(0, 0, 0, 0.2)',
  });

  const errorMessageStyles = css({
    padding: '0.1em 0.3em',
    display: 'table-row',
  });

  const closeErrorButtonStyles = css({
    position: 'absolute',
    top: '3px',
    right: '8px',
    border: '0px',
    background: 'none',
    padding: '0px',
    margin: '0px',
    outline: '0px',
    cursor: 'pointer',
  });

  if (errorClosed) {
    return null;
  }

  return (
    <div className={rootStyles}>
      <h1 className={titleStyles}>Failed with error:</h1>
      <pre className={textStyles}>
        <code
          className={errorMessageStyles}
        >{`${error.name}: ${error.message}`}</code>
        <button
          onClick={onCloseError}
          title="Close"
          className={closeErrorButtonStyles}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="16" y1="16" x2="0" y2="1" stroke="white" />
            <line x1="16" y1="1" x2="1" y2="16" stroke="white" />
          </svg>
        </button>
      </pre>
    </div>
  );
};

export const render = (output: IRenderInfo) => {
  const error = output.value.json();

  ReactDOM.render(<NotebookOutputError error={error} />, output.container);
};
