import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Editor, { useMonaco, loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import { css, spacing } from '@mongodb-js/compass-components';
import type { JsonTokenColors } from './extension-app-message-constants';

// Configure Monaco Editor loader to use local files instead of CDN
declare global {
  interface Window {
    MONACO_EDITOR_BASE_URI?: string;
  }
}

if (typeof window !== 'undefined' && window.MONACO_EDITOR_BASE_URI) {
  loader.config({
    paths: {
      vs: `${window.MONACO_EDITOR_BASE_URI}/vs`,
    },
  });
}

interface MonacoViewerProps {
  document: Record<string, unknown>;
  themeColors?: JsonTokenColors;
}

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

const LINE_HEIGHT = 19;
const EDITOR_PADDING = 0;

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

const cardStyles = css({
  backgroundColor:
    'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border:
    '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
  marginBottom: spacing[200],
  padding: spacing[300],
});

// Monaco editor options
const viewerOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  domReadOnly: false,
  contextmenu: false,
  minimap: { enabled: false },
  glyphMargin: false,
  folding: true,
  foldingStrategy: 'auto',
  showFoldingControls: 'always',
  lineDecorationsWidth: 4,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'auto',
    horizontal: 'hidden',
    alwaysConsumeMouseWheel: false,
    handleMouseWheel: true,
  },
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  lineNumbers: 'off',
  cursorStyle: 'line',
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  renderValidationDecorations: 'off',
  lineHeight: LINE_HEIGHT,
  fontFamily:
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: 13,
  renderLineHighlightOnlyWhenFocus: false,
  renderWhitespace: 'none',
  guides: {
    indentation: false,
    highlightActiveIndentation: false,
  },
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'never',
  },
};

/**
 * Format JSON with unquoted keys (similar to JavaScript object notation)
 * @param obj - The object to format
 * @param indent - Current indentation level
 */
function formatJsonWithUnquotedKeys(obj: any, indent = 0): string {
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
    const items = keys.map((key) => {
      const value = formatJsonWithUnquotedKeys(obj[key], indent + 1);
      return `${nextIndentStr}${key}: ${value}`;
    });

    return `{\n${items.join(',\n')}\n${indentStr}}`;
  }

  return String(obj);
}

const MonacoViewer: React.FC<MonacoViewerProps> = ({
  document,
  themeColors,
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);

  // Monaco expects colors without the # prefix, so strip it here once
  const colors = useMemo(
    () => ({
      key: (themeColors?.key ?? DEFAULT_COLORS.key).replace('#', ''),
      string: (themeColors?.string ?? DEFAULT_COLORS.string).replace('#', ''),
      number: (themeColors?.number ?? DEFAULT_COLORS.number).replace('#', ''),
      boolean: (themeColors?.boolean ?? DEFAULT_COLORS.boolean).replace(
        '#',
        '',
      ),
      null: (themeColors?.null ?? DEFAULT_COLORS.null).replace('#', ''),
      type: (themeColors?.type ?? DEFAULT_COLORS.type).replace('#', ''),
      comment: (themeColors?.comment ?? DEFAULT_COLORS.comment).replace(
        '#',
        '',
      ),
      punctuation: (
        themeColors?.punctuation ?? DEFAULT_COLORS.punctuation
      ).replace('#', ''),
    }),
    [themeColors],
  );

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('currentVSCodeTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'identifier', foreground: colors.key },
          { token: 'variable', foreground: colors.key },
          { token: 'variable.name', foreground: colors.key },
          { token: 'string', foreground: colors.string },
          { token: 'string.quote', foreground: colors.string },
          { token: 'string.escape', foreground: colors.string },
          { token: 'number', foreground: colors.number },
          { token: 'keyword', foreground: colors.boolean },
          { token: 'type', foreground: colors.type },
          { token: 'comment', foreground: colors.comment },
          { token: 'delimiter', foreground: colors.punctuation },
        ],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
        },
      });
    }
  }, [monaco, colors]);

  const jsonValue = useMemo(() => {
    return formatJsonWithUnquotedKeys(document, 0);
  }, [document]);

  const calculateHeight = useCallback(() => {
    if (!editorRef.current) {
      const lineCount = jsonValue.split('\n').length;
      const contentHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING * 2;
      return contentHeight;
    }

    const contentHeight = editorRef.current.getContentHeight();
    return contentHeight;
  }, [jsonValue]);

  useEffect(() => {
    setEditorHeight(calculateHeight());
  }, [jsonValue, calculateHeight]);

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      setEditorHeight(calculateHeight());

       // Fold all levels except the outermost object
      const runFold = () => {
        editorInstance.getAction('editor.foldLevel2')?.run();
      };

      // Run fold multiple times to ensure it works after Monaco computes folding ranges
      runFold();
      requestAnimationFrame(runFold);
      setTimeout(runFold, 0);
      setTimeout(runFold, 100);

      // Listen for layout changes (including folding/unfolding) to update height
      const disposable = editorInstance.onDidContentSizeChange(() => {
        const contentHeight = editorInstance.getContentHeight();
        setEditorHeight(contentHeight);
      });

      // Store disposables for cleanup
      (editorInstance as any).__foldDisposables = [disposable];
    },
    [monaco, calculateHeight],
  );

  // Cleanup effect to dispose event listeners when component unmounts
  useEffect(() => {
    return () => {
      const disposables = (editorRef.current as any)?.__foldDisposables;
      if (disposables) {
        disposables.forEach((d: any) => d.dispose());
      }
    };
  }, []);

  return (
    <div className={cardStyles}>
      <div className={monacoWrapperStyles}>
        <Editor
          height={editorHeight}
          defaultLanguage="typescript"
          value={jsonValue}
          theme="currentVSCodeTheme"
          options={viewerOptions}
          loading={null}
          onMount={handleEditorMount}
        />
      </div>
    </div>
  );
};

export default MonacoViewer;
