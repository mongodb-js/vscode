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
 * After toJSString formatting, append … to lines whose values were truncated.
 * We detect truncated strings by looking for values ending with `..."` or `...'`
 * that correspond to paths in the truncation map.
 */
function addExpandIndicators(
  formattedText: string,
  truncationMap: Map<string, string>
): string {
  if (truncationMap.size === 0) return formattedText;

  const lines = formattedText.split('\n');
  const result = lines.map((line, index) => {
    // Check if this line contains a truncated string (ends with ...")
    if (line.match(/\.\.\.("|')(\s*,?\s*)$/)) {
      const path = findPathAtPosition(formattedText, index + 1);
      if (path && truncationMap.has(path)) {
        // Insert … before the trailing comma (if any)
        return line.replace(/(\.\.\.("|'))(\s*,?\s*)$/, '$1 …$3');
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

  // Style for expand indicators (… glyph)
  '& .monaco-editor .expand-indicator': {
    cursor: 'pointer !important',
    opacity: '0.7 !important',
    transition: 'opacity 0.2s ease !important',
  },

  '& .monaco-editor .expand-indicator:hover': {
    opacity: '1 !important',
    transform: 'scale(1.2) !important',
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

  // Add decorations to make … indicators clickable
  const addExpandIndicatorDecorations = useCallback(() => {
    if (!editorRef.current || !monaco) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const decorations: editor.IModelDeltaDecoration[] = [];
    const text = model.getValue();
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      // Look for the … glyph after a closing quote
      const match = line.match(/" …/);
      if (match && match.index !== undefined) {
        const lineNumber = index + 1;
        const startColumn = match.index + 3; // Position after quote and space
        const endColumn = startColumn + 2; // Length of emoji (counts as 2 in Monaco)

        decorations.push({
          range: {
            startLineNumber: lineNumber,
            startColumn: startColumn,
            endLineNumber: lineNumber,
            endColumn: endColumn,
          },
          options: {
            inlineClassName: 'expand-indicator',
            hoverMessage: { value: 'Click to expand full value' },
          },
        });
      }
    });

    editorRef.current.createDecorationsCollection(decorations);
  }, [monaco]);

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
        addExpandIndicatorDecorations();
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
        const contentHeight = editorInstance.getContentHeight();
        setEditorHeight(contentHeight);
      });

      // Update decorations when content changes
      const d2 = editorInstance.onDidChangeModelContent(() => {
        setTimeout(() => addExpandIndicatorDecorations(), 0);
      });

      // Handle clicks on truncated strings to expand them
      const d3 = editorInstance.onMouseDown((e) => {
        const model = editorInstance.getModel();
        if (!model || !e.target.position) return;

        const position = e.target.position;
        const lineContent = model.getLineContent(position.lineNumber);

        // Check if the click is on or near the … glyph
        const clickColumn = position.column;
        const beforeClick = lineContent.substring(0, clickColumn + 2);
        const afterClick = lineContent.substring(clickColumn - 3);

        // Check if we clicked on the glyph (it appears after " )
        if (beforeClick.includes('" …') || afterClick.startsWith('…')) {
          // Find the path for this truncated value
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

            // Use toJSString to format both values — it handles quoting and
            // escaping consistently with how the original text was produced.
            const formattedFull = toJSString(fullValue) ?? '';
            const formattedTruncated = toJSString(truncatedValue) ?? '';

            // Edit just this one line in the model instead of replacing
            // the entire editor value (which would destroy fold state).
            const newLine = lineContent.replace(
              `${formattedTruncated} …`,
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
            addExpandIndicatorDecorations();
          }
        }
      });

      (editorInstance as any).__foldDisposables = [d1, d2, d3, copyKeybinding];
    },
    [calculateHeight, addExpandIndicatorDecorations],
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
