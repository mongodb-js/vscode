import React, { useMemo } from 'react';
import * as ReactDOM from 'react-dom';
import * as util from 'util';
import { css } from '@emotion/css';
import { Table, Cell, Row, TableHeader } from '@leafygreen-ui/table';
import { Link, Description } from '@leafygreen-ui/typography';

import { OutputParser } from './outputParser';
import type { RenderInfo } from './outputItem';

import type { RendererContext } from 'vscode-notebook-renderer';

interface ILeafyGreenTable {
  context: RendererContext<any>;
  data: any;
  darkMode: boolean;
}

const moreResultsStyles = css({
  padding: '10px 5px 40px 5px',
});

const moreResultsContentStyles = css({
  float: 'right',
});

const moreResultsLinkStyles = css({
  backgroundColor: 'transparent',
  border: 'none',
  display: 'inline',
});

const tableHeaderStyles = css({
  borderBottom: '3px solid rgb(232, 237, 235) !important',
  position: 'sticky',
  top: 0,
  backgroundColor: 'transparent !important',
  zIndex: 5,
});

const tableRowStyles = css({
  background: 'transparent !important',
});

const LeafyGreenTable = ({ context, data, darkMode }: ILeafyGreenTable) => {
  const shortList = data.slice(0, 10);
  const sortColumns = Object.keys(shortList[0]);
  const columns = useMemo(() => {
    const _columns = sortColumns.map((name: string) => {
      return (
        <TableHeader
          className={tableHeaderStyles}
          label={name}
          key={name}
          handleSort={() => {}}
        />
      );
    });
    return _columns;
  }, []);

  const openNotebookAsPlaygroundResult = () => {
    if (context.postMessage) {
      context.postMessage({
        request: 'openNotebookAsPlaygroundResult',
        data,
      });
    }
  };

  return (
    <div>
      <div className={moreResultsStyles}>
        <div className={moreResultsContentStyles}>
          <Description>
            This table view shows up to 10 documents. Switch to JSON view or
            <Link
              as="button"
              className={moreResultsLinkStyles}
              onClick={() => openNotebookAsPlaygroundResult()}
            >
              open more results in a MongoDB Playground
            </Link>
          </Description>
        </div>
      </div>
      <Table columns={columns} data={shortList} darkMode={darkMode}>
        {({ datum: item, index }: any) => (
          <Row key={`row-${index}`} className={tableRowStyles}>
            {Object.keys(item)
              .filter((key: string) => sortColumns.includes(key))
              .map((key: string) => (
                <Cell key={`cell-${index}`}>
                  {typeof item[key] !== 'object'
                    ? item[key]
                    : `${util.inspect(item[key])}`}
                </Cell>
              ))}
          </Row>
        )}
      </Table>
    </div>
  );
};

const renderLeafyGreenTable = ({
  context,
  container,
  data,
  darkMode,
}: ILeafyGreenTable & { container: HTMLElement }) => {
  ReactDOM.render(
    React.createElement(LeafyGreenTable, { context, data, darkMode }, null),
    container
  );
};

/**
 * Renders notebook cell output.
 * @param output Notebook cell output info to render.
 */
export function render(output: RenderInfo) {
  const outputParser = new OutputParser(output.value, output.mimeType);
  const data = outputParser.getData();

  if (Array.isArray(data)) {
    if (output.context.postMessage && output.context.onDidReceiveMessage) {
      output.context.postMessage({
        request: 'getWindowSettings',
      });
      output.context.onDidReceiveMessage((message) => {
        if (message.request === 'setWindowSettings') {
          renderLeafyGreenTable({
            context: output.context,
            container: output.container,
            data,
            darkMode: message.data.darkMode,
          });
        }
        if (message.request === 'activeColorThemeChanged') {
          renderLeafyGreenTable({
            context: output.context,
            container: output.container,
            data,
            darkMode: message.data.darkMode,
          });
        }
      });
      return;
    }

    renderLeafyGreenTable({
      context: output.context,
      container: output.container,
      data,
      darkMode: false,
    });
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
