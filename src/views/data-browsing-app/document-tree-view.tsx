import React, { useCallback, useEffect, useMemo } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import { css, spacing } from '@mongodb-js/compass-components';
import { SyntaxHighlighterViewer, CustomJsonViewer, type ViewerType } from './json-viewers';

interface DocumentTreeViewProps {
  document: Record<string, unknown>;
  viewerType?: ViewerType;
}

// Line height in pixels for Monaco editor
const LINE_HEIGHT = 19;
// Padding top and bottom for the editor
const EDITOR_PADDING = 0;
// Maximum height for the editor (prevents huge documents from taking over)
const MAX_EDITOR_HEIGHT = 400;

const containerStyles = css({
  marginBottom: spacing[200],
});

const cardStyles = css({
  backgroundColor: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border: '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
});

const monacoWrapperStyles = css({
  // Hide Monaco's internal textarea elements that appear as white boxes
  '& .monaco-editor .native-edit-context': {
    position: 'absolute',
    top: '0 !important',
    left: '0 !important',
    width: '0 !important',
    height: '0 !important',
    overflow: 'hidden !important',
    margin: '0 !important',
    padding: '0 !important',
    border: '0 !important',
  },

  '& .monaco-editor textarea.ime-text-area': {
    position: 'absolute',
    top: '0 !important',
    left: '0 !important',
    width: '1px !important',
    height: '1px !important',
    margin: '0 !important',
    padding: '0 !important',
    border: '0 !important',
    outline: 'none !important',
    boxShadow: 'none !important',
    opacity: '0 !important',
    background: 'transparent !important',
    color: 'transparent !important',
    lineHeight: '1px !important',
    resize: 'none',
  },
});

const viewerOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  contextmenu: false,
  minimap: { enabled: false },
  lineNumbers: 'on',
  glyphMargin: false,
  folding: false,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'hidden',
    horizontal: 'hidden',
    alwaysConsumeMouseWheel: false,
  },
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: EDITOR_PADDING, bottom: EDITOR_PADDING },
  cursorStyle: 'line',
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  renderValidationDecorations: 'off',
  lineHeight: LINE_HEIGHT,
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: 13,
  // Disable find widget (Ctrl+F)
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'never',
  },
};

const MonacoViewer: React.FC<{ document: Record<string, unknown> }> = ({ document }) => {
  const monaco = useMonaco();

  const jsonValue = useMemo(() => {
    return JSON.stringify(document, null, 2);
  }, [document]);

  // Calculate editor height based on content
  const editorHeight = useMemo(() => {
    const lineCount = jsonValue.split('\n').length;
    const contentHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING * 2;
    return Math.min(contentHeight, MAX_EDITOR_HEIGHT);
  }, [jsonValue]);

  // Disable find widget when editor mounts
  const handleEditorMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    // Disable the find widget command
    editorInstance.addCommand(
      monaco?.KeyMod.CtrlCmd! | monaco?.KeyCode.KeyF!,
      () => {
        // Do nothing - prevents find widget from opening
      }
    );
  }, [monaco]);

  return (
    <div className={monacoWrapperStyles}>
      <Editor
        height={editorHeight}
        defaultLanguage="json"
        value={jsonValue}
        theme="vs-dark"
        options={viewerOptions}
        loading={null}
        onMount={handleEditorMount}
      />
    </div>
  );
};

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({
  document,
  viewerType = 'monaco'
}) => {
  const renderViewer = (): React.ReactNode => {
    switch (viewerType) {
      case 'syntax-highlighter':
        return <SyntaxHighlighterViewer document={document} />;
      case 'custom':
        return <CustomJsonViewer document={document} />;
      case 'monaco':
      default:
        return <MonacoViewer document={document} />;
    }
  };

  return (
    <div className={containerStyles}>
      <div className={cardStyles}>
        {renderViewer()}
      </div>
    </div>
  );
};

export default DocumentTreeView;
export type { ViewerType };

