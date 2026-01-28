import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { CSSProperties } from 'react';

interface SyntaxHighlighterViewerProps {
  document: Record<string, unknown>;
}

/**
 * Custom theme that uses VS Code CSS variables for colors.
 * This ensures the syntax highlighting matches the current VS Code theme.
 */
const vscodeTheme: { [key: string]: CSSProperties } = {
  'code[class*="language-"]': {
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
    background: 'transparent',
    fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
    fontSize: '13px',
    lineHeight: '19px',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
    background: 'transparent',
    fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
    fontSize: '13px',
    lineHeight: '19px',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    tabSize: 2,
    padding: '12px',
    margin: 0,
    overflow: 'auto',
  },
  // JSON property keys
  property: {
    color: 'var(--vscode-symbolIcon-propertyForeground, #9cdcfe)',
  },
  // String values
  string: {
    color: 'var(--vscode-debugTokenExpression-string, #ce9178)',
  },
  // Numbers
  number: {
    color: 'var(--vscode-debugTokenExpression-number, #b5cea8)',
  },
  // Booleans and null
  boolean: {
    color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
  },
  'keyword': {
    color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
  },
  // null specifically
  'null': {
    color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
  },
  // Punctuation (brackets, colons, commas)
  punctuation: {
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
  },
  operator: {
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
  },
};

const SyntaxHighlighterViewer: React.FC<SyntaxHighlighterViewerProps> = ({ document }) => {
  const jsonValue = useMemo(() => {
    return JSON.stringify(document, null, 2);
  }, [document]);

  return (
    <SyntaxHighlighter
      language="json"
      style={vscodeTheme}
      customStyle={{
        margin: 0,
        padding: '12px',
        background: 'transparent',
      }}
    >
      {jsonValue}
    </SyntaxHighlighter>
  );
};

export default SyntaxHighlighterViewer;

