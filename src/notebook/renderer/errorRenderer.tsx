import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { css } from '@emotion/css';
import Banner from '@leafygreen-ui/banner';

import type { RenderInfo } from './outputItem';

interface NotebookOutputErrorProps {
  error: Error | { message: string; name?: string };
  darkMode: boolean;
}
const bannerStyles = css({
  flexGrow: 1,
  width: '100%',
  marginTop: '5px;',
});

const NotebookOutputError = ({ error, darkMode }: NotebookOutputErrorProps) => {
  const [errorClosed, setErrorClosed] = useState(false);

  const onCloseError = () => {
    setErrorClosed(true);
  };

  if (errorClosed) {
    return null;
  }

  return (
    <div className={bannerStyles}>
      <Banner
        variant="danger"
        dismissible
        darkMode={darkMode}
        onClose={onCloseError}
      >
        {`${error.name || 'Error'}: ${error.message}`}
      </Banner>
    </div>
  );
};

export const render = (output: RenderInfo) => {
  const error = output.value.json();

  if (output.context.postMessage && output.context.onDidReceiveMessage) {
    output.context.postMessage({ request: 'getWindowSettings' });
    output.context.onDidReceiveMessage((message) => {
      if (message.request === 'setWindowSettings') {
        ReactDOM.render(
          <NotebookOutputError
            error={error}
            darkMode={message.data.darkMode}
          />,
          output.container
        );
      }
    });
    return;
  }

  ReactDOM.render(
    <NotebookOutputError error={error} darkMode={false} />,
    output.container
  );
};
