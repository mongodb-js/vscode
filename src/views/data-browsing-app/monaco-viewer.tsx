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
import type {
  TokenColors,
  MonacoBaseTheme,
} from './extension-app-message-constants';
import { toJSString } from 'mongodb-query-parser';
import { EJSON } from 'bson';
import {
  sendEditDocument,
  sendCloneDocument,
  sendDeleteDocument,
} from './vscode-api';

// Configure Monaco Editor loader to use local files instead of CDN
if (
  typeof window !== 'undefined' &&
  window.MDB_DATA_BROWSING_OPTIONS?.monacoEditorBaseUri
) {
  loader.config({
    paths: {
      vs: `${window.MDB_DATA_BROWSING_OPTIONS.monacoEditorBaseUri}/vs`,
    },
  });
}

interface MonacoViewerProps {
  document: Record<string, unknown>;
  themeColors?: TokenColors;
  themeKind: MonacoBaseTheme;
}
// Maximum length for string values before truncation
const MAX_VALUE_LENGTH = 70;

/**
 * Recursively truncate long string values in an object
 * Returns both the truncated object and metadata about truncations
 */
function truncateLongValues(
  obj: any,
  truncationMap: Map<string, string>,
  expandedPaths: Set<string>,
  currentPath: string = ''
): any {
  if (typeof obj === 'string') {
    if (obj.length > MAX_VALUE_LENGTH && !expandedPaths.has(currentPath)) {
      truncationMap.set(currentPath, obj);
      return obj.substring(0, MAX_VALUE_LENGTH) + '...';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      truncateLongValues(item, truncationMap, expandedPaths, `${currentPath}[${index}]`)
    );
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      result[key] = truncateLongValues(value, truncationMap, expandedPaths, newPath);
    }
    return result;
  }

  return obj;
}

/**
 * Find the JSON path at a specific position in the formatted text
 * This is a simplified implementation that looks for the key on the current line
 */
function findPathAtPosition(text: string, lineNumber: number): string | null {
  const lines = text.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) return null;

  const currentLine = lines[lineNumber - 1];

  // Try to extract the key from the current line (format: "key: value")
  const keyMatch = currentLine.match(/^\s*(\w+):/);
  if (!keyMatch) return null;

  const key = keyMatch[1];

  // Build the path by looking at parent objects
  const path: string[] = [];
  let currentIndent = currentLine.search(/\S/);

  // Look backwards to find parent keys
  for (let i = lineNumber - 2; i >= 0; i--) {
    const line = lines[i];
    const lineIndent = line.search(/\S/);

    if (lineIndent < currentIndent) {
      const parentKeyMatch = line.match(/^\s*(\w+):/);
      if (parentKeyMatch) {
        path.unshift(parentKeyMatch[1]);
        currentIndent = lineIndent;
      }
    }
  }

  path.push(key);
  return path.join('.');
}

/**
 * Append ⋯ to truncated string lines in the formatted text.
 */
function addExpandIndicators(
  formattedText: string,
  truncationMap: Map<string, string>
): string {
  if (truncationMap.size === 0) return formattedText;

  const lines = formattedText.split('\n');
  const result = lines.map((line, index) => {
    if (line.match(/\.\.\.("|')(\s*,?\s*)$/)) {
      const path = findPathAtPosition(formattedText, index + 1);
      if (path && truncationMap.has(path)) {
        return line.replace(/(\.\.\.("|'))(\s*,?\s*)$/, '$1 ⋯$3');
      }
    }
    return line;
  });
  return result.join('\n');
}

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

  // Move find widget left to prevent tooltip cutoff at the right edge
  '& .monaco-editor .find-widget': {
    right: '50px !important',
  },

});

const cardStyles = css({
  position: 'relative',
  backgroundColor:
    'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border:
    '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  marginBottom: spacing[200],
  padding: spacing[300],

  '.action-bar': {
    position: 'absolute',
    top: spacing[200],
    right: spacing[200],
    display: 'flex',
    gap: spacing[100],
    zIndex: 1000,

    opacity: 0,
    transition: 'opacity 0.2s',
  },

  '&:hover .action-bar': {
    opacity: 1,
  },

  '&:focus-within .action-bar': {
    opacity: 1,
  },
});

const actionButtonStyles = css({
  background: 'var(--vscode-button-background)',
  border: '1px solid var(--vscode-button-border, transparent)',
  color: 'var(--vscode-button-foreground)',
  borderRadius: '4px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '24px',
  minHeight: '24px',

  '&:hover': {
    background: 'var(--vscode-button-hoverBackground)',
  },

  '&:active': {
    background: 'var(--vscode-button-background)',
  },
});

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
  roundedSelection: false,
  selectionHighlight: false,
  renderValidationDecorations: 'off',
  fontFamily:
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: 12,
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
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  hover: { enabled: false },
};

const MonacoViewer: React.FC<MonacoViewerProps> = ({
  document,
  themeColors,
  themeKind,
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const expandedPathsRef = useRef<Set<string>>(new Set());
  const truncationMapRef = useRef<Map<string, string>>(new Map());
  const observerRef = useRef<MutationObserver | null>(null);

  // Monaco expects colors without the # prefix, so strip it here once.
  // Individual color properties may be undefined when the active VS Code
  // theme does not define the corresponding token scopes.
  const colors = useMemo(() => {
    if (!themeColors) return null;
    const strip = (c: string | undefined): string | undefined =>
      c?.replace('#', '');
    return {
      key: strip(themeColors.key),
      string: strip(themeColors.string),
      number: strip(themeColors.number),
      boolean: strip(themeColors.boolean),
      null: strip(themeColors.null),
      type: strip(themeColors.type),
      comment: strip(themeColors.comment),
      punctuation: strip(themeColors.punctuation),
    };
  }, [themeColors]);

  useEffect(() => {
    if (!monaco) {
      return;
    }
    monaco.editor.defineTheme('currentVSCodeTheme', {
      base: themeKind,
      inherit: true,
      rules: colors
        ? ([
            { token: 'identifier', foreground: colors.key },
            { token: 'variable', foreground: colors.key },
            { token: 'variable.name', foreground: colors.key },
            { token: 'string', foreground: colors.string },
            { token: 'string.quote', foreground: colors.string },
            { token: 'string.escape', foreground: colors.string },
            { token: 'number', foreground: colors.number },
            { token: 'keyword', foreground: colors.punctuation },
            { token: 'type', foreground: colors.type },
            { token: 'comment', foreground: colors.comment },
            { token: 'delimiter', foreground: colors.punctuation },
          ].filter((r) => r.foreground !== null) as editor.ITokenThemeRule[])
        : [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
      },
    });
    monaco.editor.setTheme('currentVSCodeTheme');

    // Configure TypeScript to disable semantic diagnostics
    // This prevents it from treating object keys as DOM/TypeScript identifiers
    monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monaco.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      noLib: true,
    });
  }, [monaco, colors, themeKind]);

  const documentString = useMemo(() => {
    // Clear and rebuild truncation map
    truncationMapRef.current.clear();
    const deserialized = EJSON.deserialize(document, { relaxed: false });
    const truncated = truncateLongValues(
      deserialized,
      truncationMapRef.current,
      expandedPathsRef.current
    );
    const formatted = toJSString(truncated) ?? '';
    return addExpandIndicators(formatted, truncationMapRef.current);
  }, [document]);

  const calculateHeight = useCallback(() => {
    if (!editorRef.current) {
      // Estimate height before editor is mounted
      const lineCount = documentString.split('\n').length;
      const defaultLineHeight = 19;
      return lineCount * defaultLineHeight;
    }

    const contentHeight = editorRef.current.getContentHeight();
    return contentHeight;
  }, [documentString]);

  useEffect(() => {
    setEditorHeight(calculateHeight());
  }, [documentString, calculateHeight]);

  // Apply gray color and pointer cursor to ⋯ characters in the editor DOM.
  // Monaco's tokenizer assigns its own color classes to text spans, and
  // CSS class-based overrides cannot reliably beat them. Setting inline
  // styles directly on the spans is the only approach that works.
  const styleExpandIndicators = useCallback(() => {
    const dom = editorRef.current?.getDomNode();
    if (!dom) return;
    dom.querySelectorAll('.view-lines span').forEach((span) => {
      const el = span as HTMLElement;
      if (el.textContent?.includes('⋯')) {
        el.style.setProperty('color', '#888', 'important');
        el.style.setProperty('cursor', 'pointer');
      }
    });
  }, []);

  const handleEditorMount = useCallback(
    (
      editorInstance: editor.IStandaloneCodeEditor,
      monacoInstance: Parameters<
        NonNullable<React.ComponentProps<typeof Editor>['onMount']>
      >[1],
    ) => {
      editorRef.current = editorInstance;

      setTimeout(() => {
        setEditorHeight(calculateHeight());
        styleExpandIndicators();
      }, 0);

      // Fold all levels except the outermost object
      const runFold = (): void => {
        void editorInstance.getAction('editor.foldLevel2')?.run();
      };

      requestAnimationFrame(runFold);

      // VS Code webviews intercept Ctrl+C before it reaches the embedded Monaco editor,
      const copyKeybinding = editorInstance.addAction({
        id: 'custom-copy-to-clipboard',
        label: 'Copy',
        keybindings: [
          monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyC,
        ],
        run: (ed) => {
          const selection = ed.getSelection();
          if (selection && !selection.isEmpty()) {
            const selectedText =
              ed.getModel()?.getValueInRange(selection) ?? '';
            void navigator.clipboard.writeText(selectedText);
          }
        },
      });

      const d1 = editorInstance.onDidContentSizeChange(() => {
        setEditorHeight(editorInstance.getContentHeight());
      });

      // Use a MutationObserver on .view-lines to re-style ⋯ spans whenever
      // Monaco re-renders them (content edits, fold/unfold, re-tokenization).
      // This is more reliable than timing-based approaches because Monaco's
      // async tokenizer can re-create spans across multiple frames.
      const viewLines = editorInstance.getDomNode()?.querySelector('.view-lines');
      if (viewLines) {
        let styleTimeout: ReturnType<typeof setTimeout> | undefined;
        observerRef.current = new MutationObserver(() => {
          clearTimeout(styleTimeout);
          styleTimeout = setTimeout(styleExpandIndicators, 0);
        });
        observerRef.current.observe(viewLines, {
          childList: true,
          subtree: true,
        });
      }

      // Handle clicks on ⋯ to expand truncated values
      const d3 = editorInstance.onMouseDown((e) => {
        const model = editorInstance.getModel();
        if (!model || !e.target.position) return;

        const position = e.target.position;
        const lineContent = model.getLineContent(position.lineNumber);
        const ellipsisIndex = lineContent.indexOf('⋯');
        const clickedOnEllipsis =
          ellipsisIndex !== -1 &&
          Math.abs(position.column - (ellipsisIndex + 1)) <= 3;

        if (clickedOnEllipsis) {
          const fullText = model.getValue();
          const pathAtPosition = findPathAtPosition(
            fullText,
            position.lineNumber,
          );

          if (
            pathAtPosition &&
            truncationMapRef.current.has(pathAtPosition)
          ) {
            const fullValue =
              truncationMapRef.current.get(pathAtPosition)!;
            const truncatedValue =
              fullValue.substring(0, MAX_VALUE_LENGTH) + '...';

            const formattedFull = toJSString(fullValue) ?? '';
            const formattedTruncated = toJSString(truncatedValue) ?? '';

            const lineContent = model.getLineContent(position.lineNumber);
            const newLine = lineContent.replace(
              `${formattedTruncated} ⋯`,
              formattedFull
            );

            const lineLength = model.getLineLength(position.lineNumber);
            model.applyEdits([
              {
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: 1,
                  endLineNumber: position.lineNumber,
                  endColumn: lineLength + 1,
                },
                text: newLine,
              },
            ]);

            expandedPathsRef.current.add(pathAtPosition);
            truncationMapRef.current.delete(pathAtPosition);
          }
        }
      });

      (editorInstance as any).__foldDisposables = [d1, d3, copyKeybinding];
    },
    [calculateHeight, styleExpandIndicators],
  );

  // Cleanup effect to dispose event listeners when component unmounts
  useEffect(() => {
    return () => {
      const disposables = (editorRef.current as any)?.__foldDisposables;
      if (disposables) {
        disposables.forEach((d: any) => d.dispose());
      }
      observerRef.current?.disconnect();
    };
  }, []);

  const handleEdit = useCallback(() => {
    if (document._id) {
      sendEditDocument(document._id);
    }
  }, [document]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(documentString);
  }, [documentString]);

  const handleClone = useCallback(() => {
    sendCloneDocument(document);
  }, [document]);

  const handleDelete = useCallback(() => {
    if (document._id) {
      sendDeleteDocument(document._id);
    }
  }, [document]);

  return (
    <div className={cardStyles} data-testid="monaco-viewer-container">
      <div className="action-bar">
        {document._id && (
          <button
            className={actionButtonStyles}
            onClick={handleEdit}
            title="Edit"
            aria-label="Edit"
          >
            <i className="codicon codicon-edit" />
          </button>
        )}
        <button
          className={actionButtonStyles}
          onClick={handleCopy}
          title="Copy"
          aria-label="Copy"
        >
          <i className="codicon codicon-copy" />
        </button>
        {document._id && (
          <button
            className={actionButtonStyles}
            onClick={handleClone}
            title="Clone"
            aria-label="Clone"
          >
            <i className="codicon codicon-files" />
          </button>
        )}
        {document._id && (
          <button
            className={actionButtonStyles}
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete"
          >
            <i className="codicon codicon-trash" />
          </button>
        )}
      </div>
      <div className={monacoWrapperStyles}>
        <Editor
          height={editorHeight}
          defaultLanguage="typescript"
          value={documentString}
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
