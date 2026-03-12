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
    gap: 0,
    zIndex: 1000,
    backgroundColor:
      'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
    border:
      '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
    borderRadius: '6px',
    padding: `${spacing[100]}px`,

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
  '&:hover span': {
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
  position: 'relative',
  background: 'transparent',
  border: 'none',
  color: 'var(--vscode-foreground)',
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
    background:
      'var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1))',
  },

  '&:active': {
    background:
      'var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.07))',
  },

  '&::after': {
    content: 'attr(data-tooltip)',
    position: 'absolute',
    top: 'calc(100% + 12px)',
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

const MAX_INITIAL_FIELDS_SHOWING = 15;

/**
 * Scan the serialized document string to find the model line number where the
 * (maxFields+1)th top-level field starts. We track brace/bracket depth so that
 * nested objects and arrays (which span many model lines) are skipped correctly.
 * Returns null if the document has fewer than maxFields+1 top-level fields.
 */
function findCollapseLineNumber(
  serialized: string,
  maxFields: number,
): number | null {
  const lines = serialized.split('\n');
  let depth = 0;
  let topLevelFields = 0;

  for (let i = 0; i < lines.length; i++) {
    const depthBefore = depth;
    const trimmed = lines[i].trim();

    for (const ch of trimmed) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
    }

    // A new top-level field starts on a line where depth was 1 before the line
    // (inside the root object) and the line looks like a key (contains a colon).
    if (depthBefore === 1 && trimmed.includes(':')) {
      topLevelFields++;
      if (topLevelFields > maxFields) {
        return i + 1; // 1-based line number
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
  const lineHeightRef = useRef<number>(19);
  // Tracks the last known Monaco content height so we can compute deltas.
  const prevContentHeightRef = useRef<number>(0);
  // True once the initial foldLevel2 + updateCollapsedHeight pass is done.
  const collapsedHeightInitializedRef = useRef<boolean>(false);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const [showAllFields, setShowAllFields] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const buttonWrapperRef = useRef<HTMLDivElement | null>(null);
  // Stores the button's viewport Y before collapsing so we can scroll to restore it.
  const collapseScrollTargetRef = useRef<number | null>(null);

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
        'editor.foldBackground': '#00000000',
        'editor.lineHighlightBorder': '#00000000',
      },
    });
    monaco.editor.setTheme('currentVSCodeTheme');

    // Configure TypeScript to disable semantic diagnostics
    // This prevents it from treating object keys as DOM/TypeScript identifiers
    monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
    });
    monaco.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      noLib: true,
    });
  }, [monaco, colors, themeKind]);

  const deserialized = useMemo(
    () =>
      EJSON.deserialize(document, { relaxed: false }) as Record<
        string,
        unknown
      >,
    [document],
  );

  const documentString = useMemo(
    () => toJSString(deserialized) ?? '',
    [deserialized],
  );

  const collapseAtLine = useMemo(
    () => findCollapseLineNumber(documentString, MAX_INITIAL_FIELDS_SHOWING),
    [documentString],
  );
  const hasMoreFields = collapseAtLine !== null;
  const hiddenFieldCount =
    Object.keys(document).length - MAX_INITIAL_FIELDS_SHOWING;

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

  const updateCollapsedHeight = useCallback(() => {
    if (collapseAtLine === null) return;
    if (editorRef.current) {
      // Use Monaco's API to get the actual pixel offset for the collapse line.
      // collapseAtLine is the correct model line number (computed by scanning
      // the serialized string with depth tracking), and after foldLevel2 the
      // editor knows the real visual position accounting for folded regions.
      const top = editorRef.current.getTopForLineNumber(collapseAtLine);
      setCollapsedHeight(top);
    } else {
      setCollapsedHeight((collapseAtLine - 1) * lineHeightRef.current);
    }
  }, [collapseAtLine]);

  const handleEditorMount = useCallback(
    (
      editorInstance: editor.IStandaloneCodeEditor,
      monacoInstance: Parameters<
        NonNullable<React.ComponentProps<typeof Editor>['onMount']>
      >[1],
    ) => {
      editorRef.current = editorInstance;

      // Capture the real line height now that the editor and monaco are ready.
      const lh = editorInstance.getOption(
        monacoInstance.editor.EditorOption.lineHeight,
      );
      lineHeightRef.current = lh > 0 ? lh : 19;

      // Fold all levels except the outermost object, then — and only then —
      // apply the collapsed height so we never clip before folding has run.
      // After that, record the baseline content height and mark initialization
      // complete so subsequent fold-toggle deltas are tracked correctly.
      requestAnimationFrame(() => {
        void editorInstance
          .getAction('editor.foldLevel2')
          ?.run()
          .then(() => {
            updateCollapsedHeight();
            prevContentHeightRef.current = editorInstance.getContentHeight();
            collapsedHeightInitializedRef.current = true;
          });
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
        const delta = contentHeight - prevContentHeightRef.current;
        prevContentHeightRef.current = contentHeight;
        setEditorHeight(contentHeight);

        // After the initial fold pass, keep the collapsed-height cap in sync
        // with Monaco's fold state: when the user expands or collapses a
        // section inside the visible area the card grows or shrinks by the
        // same number of pixels, so newly revealed lines are always visible.
        if (collapsedHeightInitializedRef.current && delta !== 0) {
          setCollapsedHeight((prev) =>
            prev !== null ? Math.max(0, prev + delta) : prev,
          );
        }
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

  const handleCollapse = useCallback(() => {
    // Capture the button wrapper's viewport Y before the DOM collapses.
    collapseScrollTargetRef.current =
      buttonWrapperRef.current?.getBoundingClientRect().top ?? null;
    setShowAllFields(false);
  }, []);

  // After collapsing, scroll so the button stays at the same viewport position.
  useEffect(() => {
    if (showAllFields || collapseScrollTargetRef.current === null) return;
    const targetTop = collapseScrollTargetRef.current;
    collapseScrollTargetRef.current = null;

    requestAnimationFrame(() => {
      if (!buttonWrapperRef.current) return;
      const newTop = buttonWrapperRef.current.getBoundingClientRect().top;
      window.scrollBy(0, newTop - targetTop);
    });
  }, [showAllFields]);

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
      <div
        style={{
          maxHeight:
            hasMoreFields && !showAllFields && collapsedHeight !== null
              ? collapsedHeight
              : undefined,
          overflow: hasMoreFields && !showAllFields ? 'hidden' : undefined,
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

      <div ref={buttonWrapperRef}>
        {hasMoreFields && !showAllFields && (
          <button
            className={showMoreButtonStyles}
            onClick={() => setShowAllFields(true)}
            data-expanded="false"
          >
            <span>
              Show {hiddenFieldCount} more field
              {hiddenFieldCount !== 1 ? 's' : ''}
            </span>
          </button>
        )}

        {hasMoreFields && showAllFields && (
          <button
            className={showMoreButtonStyles}
            onClick={handleCollapse}
            data-expanded="true"
          >
            <span>Show less</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MonacoViewer;
