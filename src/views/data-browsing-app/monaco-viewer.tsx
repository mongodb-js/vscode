import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import { css, spacing } from '@mongodb-js/compass-components';
import type { JsonTokenColors } from './extension-app-message-constants';

interface MonacoViewerProps {
  document: Record<string, unknown>;
  themeColors?: JsonTokenColors;
}

// Default color palette for syntax highlighting (VS Code Dark+ theme)
const DEFAULT_COLORS = {
  key: '#9CDCFE',
  string: '#CE9178',
  number: '#B5CEA8',
  boolean: '#569CD6',
  null: '#569CD6',
  type: '#4EC9B0',
  comment: '#6A9955',
  punctuation: '#D4D4D4',
} as const;

// Line height in pixels for Monaco editor
const LINE_HEIGHT = 19;
// Padding top and bottom for the editor
const EDITOR_PADDING = 0;

const monacoWrapperStyles = css({
  paddingLeft: "10px",

  // Hide line numbers and glyph margin, but keep folding controls visible
  '& .monaco-editor .line-numbers': {
    display: 'none !important',
  },

  '& .monaco-editor .glyph-margin': {
    display: 'none !important',
  },

  // Remove any borders on the editor
  '& .monaco-editor': {
    border: 'none !important',
  },

  '& .monaco-editor .overflow-guard': {
    border: 'none !important',
  },

  '& .monaco-editor .monaco-scrollable-element': {
    border: 'none !important',
    boxShadow: 'none !important',
  },
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

const cardStyles = css({
  backgroundColor: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border: '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
  marginBottom: spacing[200],
});

// Base viewer options - will be modified per instance for scrollbar settings
const getViewerOptions = (enableScrolling: boolean): Monaco.editor.IStandaloneEditorConstructionOptions => ({
  readOnly: true,
  domReadOnly: false, // Allow DOM interactions like copy
  contextmenu: false,
  minimap: { enabled: false },
  glyphMargin: false,
  folding: true,
  foldingStrategy: 'auto',
  showFoldingControls: 'always',
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: enableScrolling ? 'auto' : 'hidden',
    horizontal: 'hidden',
    alwaysConsumeMouseWheel: false,
    handleMouseWheel: enableScrolling,
  },
  wordWrap: 'off',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: EDITOR_PADDING, bottom: EDITOR_PADDING },
  lineNumbers: 'off',
  cursorStyle: 'line',
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  renderValidationDecorations: 'off',
  lineHeight: LINE_HEIGHT,
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: 13,
  renderLineHighlightOnlyWhenFocus: false,
  renderWhitespace: 'none',
  guides: {
    indentation: false,
    highlightActiveIndentation: false,
  },
  // Disable find widget (Ctrl+F)
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'never',
  },
});

/**
 * Format JSON with unquoted keys (similar to JavaScript object notation)
 * @param obj - The object to format
 * @param indent - Current indentation level
 */
function formatJsonWithUnquotedKeys(
  obj: any,
  indent = 0
): string {
  const indentStr = '  '.repeat(indent);
  const nextIndentStr = '  '.repeat(indent + 1);

  if (obj === null) {
    return 'null';
  }

  if (obj === undefined) {
    return 'undefined';
  }

  if (typeof obj === 'string') {
    // Use backticks for multi-line strings, quotes for single-line
    if (obj.includes('\n') || obj.includes('\r')) {
      // For multi-line strings, indent each line properly
      const lines = obj.split('\n');
      const indentedLines = lines.map((line, i) => {
        if (i === 0) return line;
        return nextIndentStr + line;
      });
      return `\`${indentedLines.join('\n')}\``;
    }

    return `"${obj}"`;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    const items = obj.map((item) => {
      return `${nextIndentStr}${formatJsonWithUnquotedKeys(item, indent + 1)}`;
    });
    return `[\n${items.join(',\n')}\n${indentStr}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }
    const items = keys.map(key => {
      const value = formatJsonWithUnquotedKeys(obj[key], indent + 1);
      return `${nextIndentStr}${key}: ${value}`;
    });

    return `{\n${items.join(',\n')}\n${indentStr}}`;
  }

  return String(obj);
}

const MonacoViewer: React.FC<MonacoViewerProps> = ({ document, themeColors }) => {
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);

  // Merge theme colors with defaults
  const colors = useMemo(
    () => ({
      key: themeColors?.key ?? DEFAULT_COLORS.key,
      string: themeColors?.string ?? DEFAULT_COLORS.string,
      number: themeColors?.number ?? DEFAULT_COLORS.number,
      boolean: themeColors?.boolean ?? DEFAULT_COLORS.boolean,
      null: themeColors?.null ?? DEFAULT_COLORS.null,
      type: themeColors?.type ?? DEFAULT_COLORS.type,
      comment: themeColors?.comment ?? DEFAULT_COLORS.comment,
      punctuation: themeColors?.punctuation ?? DEFAULT_COLORS.punctuation,
    }),
    [themeColors],
  );

  // Define custom theme when Monaco is ready
  useEffect(() => {
    if (monaco) {
      // Define custom theme based on TypeScript
      monaco.editor.defineTheme('noGutterTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          // TypeScript/JavaScript token mappings
          { token: 'identifier', foreground: colors.key.replace('#', '') },
          { token: 'variable', foreground: colors.key.replace('#', '') },
          { token: 'variable.name', foreground: colors.key.replace('#', '') },
          { token: 'string', foreground: colors.string.replace('#', '') },
          { token: 'string.quote', foreground: colors.string.replace('#', '') },
          { token: 'string.escape', foreground: colors.string.replace('#', '') },
          { token: 'number', foreground: colors.number.replace('#', '') },
          { token: 'keyword', foreground: colors.boolean.replace('#', '') },
          { token: 'type', foreground: colors.type.replace('#', '') },
          { token: 'comment', foreground: colors.comment.replace('#', '') },
          { token: 'delimiter', foreground: colors.punctuation.replace('#', '') },
        ],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
        },
      });
    }
  }, [monaco, colors]);

  // Render the full document
  const jsonValue = useMemo(() => {
    return formatJsonWithUnquotedKeys(document, 0);
  }, [document]);

  // Calculate initial editor height based on content
  const calculateHeight = useCallback(() => {
    if (!editorRef.current) {
      // Initial height calculation before editor is mounted
      const lineCount = jsonValue.split('\n').length;
      const contentHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING * 2;
      return contentHeight;
    }

    // Calculate height based on actual content height from Monaco's layout
    const contentHeight = editorRef.current.getContentHeight();
    return contentHeight;
  }, [jsonValue]);

  // Update height when jsonValue changes
  useEffect(() => {
    setEditorHeight(calculateHeight());
  }, [jsonValue, calculateHeight]);



  // Disable find widget when editor mounts
  const handleEditorMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    // Store editor instance for cleanup
    editorRef.current = editorInstance;

    // Set initial height after editor is mounted
    setTimeout(() => {
      setEditorHeight(calculateHeight());
    }, 0);

    // Disable the find widget command
    editorInstance.addCommand(
      monaco?.KeyMod.CtrlCmd! | monaco?.KeyCode.KeyF!,
      () => {
        // Do nothing - prevents find widget from opening
      }
    );
    editorInstance.getAction('editor.foldLevel2')?.run();

    editorInstance.getAction("editor.foldLevel1")?.run();
    const runFold = () => {
      editorInstance.getAction("editor.foldLevel1")?.run();
    };

    // 1) Next frame (lets layout happen)
    requestAnimationFrame(runFold);

    // 2) After Monaco computes folding ranges (often needs another tick)
    setTimeout(runFold, 0);

    // Listen for layout changes (including folding/unfolding) to update height
    const disposable = editorInstance.onDidContentSizeChange(() => {
      const contentHeight = editorInstance.getContentHeight();
      setEditorHeight(contentHeight);
    });

    // Store disposables for cleanup
    (editorInstance as any).__foldDisposables = [disposable];
  }, [monaco, calculateHeight]);



  // Cleanup effect to dispose event listeners when component unmounts
  useEffect(() => {
    return () => {
      const disposables = (editorRef.current as any)?.__foldDisposables;
      if (disposables) {
        disposables.forEach((d: any) => d.dispose());
      }
    };
  }, []);

  // Calculate viewer options - always enable scrolling
  const viewerOptions = useMemo(() => getViewerOptions(true), []);

  return (
    <div className={cardStyles}>
      <div className={monacoWrapperStyles}>
          <Editor
            height={editorHeight}
            defaultLanguage="typescript"
            value={jsonValue}
            theme="noGutterTheme"
            options={viewerOptions}
            loading={null}
            onMount={handleEditorMount}
          />
      </div>
    </div>
  );
};

export default MonacoViewer;

