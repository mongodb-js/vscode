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

const showMoreButtonStyles = css({
  color: 'var(--vscode-textLink-foreground, #3794ff)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily:
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
  '&:hover': {
    textDecoration: 'underline',
  },
  '&::before': {
    content: '"▸"',
    display: 'inline-block',
    transition: 'transform 0.2s',
  },
  '&[data-expanded="false"]::before': {
    transform: 'rotate(90deg)',
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

// Maximum number of top-level fields to show initially
const MAX_INITIAL_FIELDS = 25;

/**
 * Find the 1-based line number in a formatted JS string where the
 * (maxFields + 1)-th top-level field begins.  Returns `null` when
 * all fields fit within the limit.
 */
function findCollapseLineNumber(
  text: string,
  maxFields: number,
): number | null {
  const lines = text.split('\n');
  let depth = 0;
  let fieldCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const prevDepth = depth;

    for (const char of lines[i]) {
      if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') depth--;
    }

    const trimmed = lines[i].trim();
    // A line at depth 1 that isn't a closing brace/bracket starts a top-level field
    if (
      prevDepth === 1 &&
      trimmed &&
      !trimmed.startsWith('}') &&
      !trimmed.startsWith(']')
    ) {
      fieldCount++;
      if (fieldCount > maxFields) {
        return i + 1; // 1-based
      }
    }
  }

  return null;
}

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
  const [showAllFields, setShowAllFields] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);

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
    const deserialized = EJSON.deserialize(document, { relaxed: false });
    return toJSString(deserialized) ?? '';
  }, [document]);

  // Find the line where field MAX_INITIAL_FIELDS+1 starts
  const collapseAtLine = useMemo(
    () => findCollapseLineNumber(documentString, MAX_INITIAL_FIELDS),
    [documentString],
  );
  const hasMoreFields = collapseAtLine !== null;
  const hiddenFieldCount =
    Object.keys(document).length - MAX_INITIAL_FIELDS;

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

  // Recompute the pixel height at which we clip when collapsed.
  const updateCollapsedHeight = useCallback(() => {
    if (!editorRef.current || collapseAtLine === null) return;
    const top = editorRef.current.getTopForLineNumber(collapseAtLine);
    setCollapsedHeight(top);
  }, [collapseAtLine]);

  const handleEditorMount = useCallback(
    (
      editorInstance: editor.IStandaloneCodeEditor,
      monacoInstance: Parameters<
        NonNullable<React.ComponentProps<typeof Editor>['onMount']>
      >[1],
    ) => {
      editorRef.current = editorInstance;
      setEditorHeight(calculateHeight());

      // Fold all levels except the outermost object
      const runFold = (): void => {
        void editorInstance.getAction('editor.foldLevel2')?.run();
      };

      requestAnimationFrame(() => {
        runFold();
        updateCollapsedHeight();
      });

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

      const disposable = editorInstance.onDidContentSizeChange(() => {
        const contentHeight = editorInstance.getContentHeight();
        setEditorHeight(contentHeight);
        updateCollapsedHeight();
      });

      (editorInstance as any).__foldDisposables = [disposable, copyKeybinding];
    },
    [calculateHeight, updateCollapsedHeight],
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
      <div
        style={{
          maxHeight:
            hasMoreFields && !showAllFields && collapsedHeight != null
              ? collapsedHeight
              : undefined,
          overflow:
            hasMoreFields && !showAllFields ? 'hidden' : undefined,
        }}
      >
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

      {hasMoreFields && !showAllFields && (
        <button
          className={showMoreButtonStyles}
          onClick={() => setShowAllFields(true)}
          data-expanded="false"
        >
          Show {hiddenFieldCount} more field
          {hiddenFieldCount !== 1 ? 's' : ''}
        </button>
      )}

      {hasMoreFields && showAllFields && (
        <button
          className={showMoreButtonStyles}
          onClick={() => setShowAllFields(false)}
          data-expanded="true"
        >
          Show less
        </button>
      )}
    </div>
  );
};

export default MonacoViewer;
