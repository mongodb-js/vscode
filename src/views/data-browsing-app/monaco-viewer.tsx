import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
// Maximum height for the editor (prevents huge documents from taking over)
const MAX_EDITOR_HEIGHT = Infinity;

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

const showMoreButtonStyles = css({
  color: 'var(--vscode-textLink-foreground, #3794ff)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
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

const contextMenuStyles = css({
  position: 'fixed',
  backgroundColor: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--vscode-menu-border, #454545)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  borderRadius: '4px',
  padding: '4px 0',
  minWidth: '150px',
  zIndex: 10000,
});

const contextMenuItemStyles = css({
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--vscode-menu-foreground, #cccccc)',
  backgroundColor: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  display: 'block',
  '&:hover': {
    backgroundColor: 'var(--vscode-menu-selectionBackground, #094771)',
    color: 'var(--vscode-menu-selectionForeground, #ffffff)',
  },
});

const cardStyles = css({
  backgroundColor: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border: '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
  marginBottom: spacing[200],
});

const viewerOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  domReadOnly: false, // Allow DOM interactions like copy
  contextmenu: false,
  minimap: { enabled: false },
  glyphMargin: false,
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'always',
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'hidden',
    horizontal: 'hidden',
    alwaysConsumeMouseWheel: false,
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
  // Completely disable all decorations and margins
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

};

// Maximum length for string values before truncation
const MAX_VALUE_LENGTH = 70;
// Maximum number of top-level fields to show initially
const MAX_INITIAL_FIELDS = 25;

/**
 * Slice document to only include the first N top-level fields
 */
function sliceDocumentFields(obj: Record<string, unknown>, maxFields: number): Record<string, unknown> {
  const entries = Object.entries(obj);
  if (entries.length <= maxFields) {
    return obj;
  }

  const slicedEntries = entries.slice(0, maxFields);
  return Object.fromEntries(slicedEntries);
}

/**
 * Recursively truncate long string values in an object
 */
function truncateLongValues(obj: any): any {
  if (typeof obj === 'string') {
    if (obj.length > MAX_VALUE_LENGTH) {
      return obj.substring(0, MAX_VALUE_LENGTH) + '...';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => truncateLongValues(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateLongValues(value);
    }
    return result;
  }

  return obj;
}

/**
 * Format JSON with unquoted keys (similar to JavaScript object notation)
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
    const items = obj.map(item => `${nextIndentStr}${formatJsonWithUnquotedKeys(item, indent + 1)}`);
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
  const [showAllFields, setShowAllFields] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  // Define custom theme and folding provider when Monaco is ready
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

  // Count top-level fields
  const totalFieldCount = useMemo(() => Object.keys(document).length, [document]);
  const hasMoreFields = totalFieldCount > MAX_INITIAL_FIELDS;
  const hiddenFieldCount = totalFieldCount - MAX_INITIAL_FIELDS;

  // Determine which document to display (sliced or full)
  const displayDocument = useMemo(() => {
    if (!hasMoreFields || showAllFields) {
      return document;
    }
    return sliceDocumentFields(document, MAX_INITIAL_FIELDS);
  }, [document, hasMoreFields, showAllFields]);

  const jsonValue = useMemo(() => {
    const truncatedDocument = truncateLongValues(displayDocument);
    return formatJsonWithUnquotedKeys(truncatedDocument, 0);
  }, [displayDocument]);

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
    editorInstance.getAction('editor.foldLevel2')?.run();
    // Listen for context menu events (right-click)
    editorInstance.onContextMenu((e) => {
      e.event.preventDefault();
      e.event.stopPropagation();

      // Get the mouse position relative to the viewport
      const x = e.event.posx;
      const y = e.event.posy;

      setContextMenu({ x, y });
    });
  }, [monaco]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      window.document.addEventListener('click', handleClickOutside);
      return () => {
        window.document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  return (
    <div className={cardStyles}>
      <div className={monacoWrapperStyles}>
        {
          <Editor
            height={editorHeight}
            defaultLanguage="typescript"
            value={jsonValue}
            theme="noGutterTheme"
            options={viewerOptions}
            loading={null}
            onMount={handleEditorMount}
          />
        }
      </div>

      {hasMoreFields && !showAllFields && (
        <button
          className={showMoreButtonStyles}
          onClick={() => setShowAllFields(true)}
          data-expanded="false"
        >
          Show {hiddenFieldCount} more field{hiddenFieldCount !== 1 ? 's' : ''}
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

      {/* Custom context menu */}
      {contextMenu && (
        <div
          className={contextMenuStyles}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Copy action');
              setContextMenu(null);
            }}
          >
            Copy
          </button>
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Select All action');
              setContextMenu(null);
            }}
          >
            Select All
          </button>
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Custom Action');
              setContextMenu(null);
            }}
          >
            Custom Action
          </button>
        </div>
      )}
    </div>
  );
};

export default MonacoViewer;

