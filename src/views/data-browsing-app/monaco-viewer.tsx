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

const actionButtonStyles = css({
  position: 'relative',
  background: 'var(--vscode-button-secondaryBackground)',
  border: '1px solid var(--vscode-button-border, transparent)',
  color: 'var(--vscode-button-secondaryForeground)',
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
    background: 'var(--vscode-button-secondaryHoverBackground)',
  },

  '&:active': {
    background: 'var(--vscode-button-secondaryBackground)',
  },

  '&::after': {
    content: 'attr(data-tooltip)',
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background:
      'var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background))',
    color:
      'var(--vscode-editorHoverWidget-foreground, var(--vscode-editor-foreground))',
    border:
      '1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorWidget-border))',
    borderRadius: '4px',
    padding: `${spacing[100]}px ${spacing[200]}px`,
    fontSize: '12px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: 0,
    transition: 'opacity 0.15s',
  },

  '&:hover::after': {
    opacity: 1,
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

      const disposable = editorInstance.onDidContentSizeChange(() => {
        const contentHeight = editorInstance.getContentHeight();
        setEditorHeight(contentHeight);
      });

      (editorInstance as any).__foldDisposables = [disposable, copyKeybinding];
    },
    [calculateHeight],
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
            data-tooltip="Edit Document"
            aria-label="Edit Document"
          >
            <i className="codicon codicon-edit" />
          </button>
        )}
        <button
          className={actionButtonStyles}
          onClick={handleCopy}
          data-tooltip="Copy Document"
          aria-label="Copy Document"
        >
          <i className="codicon codicon-copy" />
        </button>
        {document._id && (
          <button
            className={actionButtonStyles}
            onClick={handleClone}
            data-tooltip="Clone Document"
            aria-label="Clone Document"
          >
            <i className="codicon codicon-files" />
          </button>
        )}
        {document._id && (
          <button
            className={actionButtonStyles}
            onClick={handleDelete}
            data-tooltip="Delete Document"
            aria-label="Delete Document"
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
