import React, { useMemo } from 'react';
import * as ReactDOM from 'react-dom';
import * as util from 'util';
import { css } from '@emotion/css';
import { Table, Cell, Row, TableHeader } from '@leafygreen-ui/table';

import { OutputParser } from './outputParser';
import type { RenderInfo } from './outputItem';

const LeafyGreenTable = ({ data }: { data: any[] }) => {
  const tableStyles = css({
    thead: {
      position: 'sticky',
      top: 0,
      background: 'white',
      zIndex: 5,
    },
    tr: {
      background: 'white',
    },
  });

  const tableHeaderStyles = css({
    borderBottom: '3px solid rgb(232, 237, 235) !important',
  });

  const sortColumns = Object.keys(data[0]);
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

  return (
    <div>
      <Table columns={columns} data={data} className={tableStyles}>
        {({ datum: item, index }: any) => (
          <Row key={`row-${index}`}>
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

/**
 * Renders notebook cell output.
 * @param output Notebook cell output info to render.
 */
export function render(output: RenderInfo) {
  const outputParser = new OutputParser(output.value, output.mimeType);
  const data = outputParser.getData();

  if (Array.isArray(data)) {
    // Render flat data grid.
    ReactDOM.render(
      React.createElement(LeafyGreenTable, { data }, null),
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
