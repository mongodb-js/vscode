import React, { useMemo } from 'react';
import { css } from '@mongodb-js/compass-components';

interface CustomJsonViewerProps {
  document: Record<string, unknown>;
}

const preStyles = css({
  margin: 0,
  padding: '12px',
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: '13px',
  lineHeight: '19px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: 'var(--vscode-editor-foreground, #d4d4d4)',
});

// CSS classes for different token types using VS Code CSS variables
const keyStyles = css({
  color: 'var(--vscode-symbolIcon-propertyForeground, #9cdcfe)',
});

const stringStyles = css({
  color: 'var(--vscode-debugTokenExpression-string, #ce9178)',
});

const numberStyles = css({
  color: 'var(--vscode-debugTokenExpression-number, #b5cea8)',
});

const booleanStyles = css({
  color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
});

const nullStyles = css({
  color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
});

const punctuationStyles = css({
  color: 'var(--vscode-editor-foreground, #d4d4d4)',
});

/**
 * Renders a JSON value with syntax highlighting using spans.
 */
function renderValue(value: unknown, indent: number = 0): React.ReactNode {
  const indentStr = '  '.repeat(indent);
  const nextIndentStr = '  '.repeat(indent + 1);

  if (value === null) {
    return <span className={nullStyles}>null</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={booleanStyles}>{value.toString()}</span>;
  }

  if (typeof value === 'number') {
    return <span className={numberStyles}>{value}</span>;
  }

  if (typeof value === 'string') {
    // Escape special characters and wrap in quotes
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return <span className={stringStyles}>"{escaped}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <>
          <span className={punctuationStyles}>[</span>
          <span className={punctuationStyles}>]</span>
        </>
      );
    }

    return (
      <>
        <span className={punctuationStyles}>[</span>
        {'\n'}
        {value.map((item, index) => (
          <React.Fragment key={index}>
            {nextIndentStr}
            {renderValue(item, indent + 1)}
            {index < value.length - 1 && <span className={punctuationStyles}>,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indentStr}
        <span className={punctuationStyles}>]</span>
      </>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <>
          <span className={punctuationStyles}>{'{'}</span>
          <span className={punctuationStyles}>{'}'}</span>
        </>
      );
    }

    return (
      <>
        <span className={punctuationStyles}>{'{'}</span>
        {'\n'}
        {entries.map(([key, val], index) => (
          <React.Fragment key={key}>
            {nextIndentStr}
            <span className={keyStyles}>"{key}"</span>
            <span className={punctuationStyles}>: </span>
            {renderValue(val, indent + 1)}
            {index < entries.length - 1 && <span className={punctuationStyles}>,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indentStr}
        <span className={punctuationStyles}>{'}'}</span>
      </>
    );
  }

  // Fallback for unknown types
  return <span>{String(value)}</span>;
}

const CustomJsonViewer: React.FC<CustomJsonViewerProps> = ({ document }) => {
  const rendered = useMemo(() => renderValue(document, 0), [document]);

  return <pre className={preStyles}>{rendered}</pre>;
};

export default CustomJsonViewer;

