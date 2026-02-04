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

  // Style for expand indicators (🔍 emoji)
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
  foldingStrategy: 'auto',
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
function findPathAtPosition(text: string, lineNumber: number, column: number): string | null {
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
 * Format JSON with unquoted keys (similar to JavaScript object notation)
 * @param obj - The object to format
 * @param indent - Current indentation level
 * @param truncationMap - Map of truncated values
 * @param currentPath - Current path in the object tree
 */
function formatJsonWithUnquotedKeys(
  obj: any,
  indent = 0,
  truncationMap?: Map<string, string>,
  currentPath: string = ''
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

    const formattedString = `"${obj}"`;
    // Add expand icon if this string is truncated
    if (truncationMap && currentPath && truncationMap.has(currentPath)) {
      return `${formattedString} 🔍`;
    }
    return formattedString;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    const items = obj.map((item, index) => {
      const itemPath = `${currentPath}[${index}]`;
      return `${nextIndentStr}${formatJsonWithUnquotedKeys(item, indent + 1, truncationMap, itemPath)}`;
    });
    return `[\n${items.join(',\n')}\n${indentStr}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }
    const items = keys.map(key => {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const value = formatJsonWithUnquotedKeys(obj[key], indent + 1, truncationMap, newPath);
      return `${nextIndentStr}${key}: ${value}`;
    });

    return `{\n${items.join(',\n')}\n${indentStr}}`;
  }

  return String(obj);
}

const MonacoViewer: React.FC<MonacoViewerProps> = ({ document, themeColors }) => {
  const monaco = useMonaco();
  const [showAllFields, setShowAllFields] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const truncationMapRef = useRef<Map<string, string>>(new Map());

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

      // Register custom folding range provider to exclude root object
      const disposable = monaco.languages.registerFoldingRangeProvider('typescript', {
        provideFoldingRanges: (model) => {
          const ranges: Monaco.languages.FoldingRange[] = [];
          const lines = model.getLinesContent();

          // Stack to track opening braces/brackets and their line numbers
          const stack: { char: string; line: number }[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            for (let j = 0; j < line.length; j++) {
              const char = line[j];

              if (char === '{' || char === '[') {
                stack.push({ char, line: i + 1 }); // Monaco uses 1-based line numbers
              } else if (char === '}' || char === ']') {
                if (stack.length > 0) {
                  const opening = stack.pop()!;
                  // Only add folding range if it's not the root object (line 1)
                  if (opening.line !== 1) {
                    ranges.push({
                      start: opening.line,
                      end: i + 1,
                      kind: monaco.languages.FoldingRangeKind.Region,
                    });
                  }
                }
              }
            }
          }

          return ranges;
        },
      });

      return () => {
        disposable.dispose();
      };
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
    // Clear and rebuild truncation map
    truncationMapRef.current.clear();
    const truncatedDocument = truncateLongValues(
      displayDocument,
      truncationMapRef.current,
      expandedPaths
    );
    return formatJsonWithUnquotedKeys(truncatedDocument, 0, truncationMapRef.current);
  }, [displayDocument, expandedPaths]);

  // Calculate initial editor height based on content
  const calculateHeight = useCallback(() => {
    if (!editorRef.current) {
      // Initial height calculation before editor is mounted
      const lineCount = jsonValue.split('\n').length;
      const contentHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING * 2;
      return Math.min(contentHeight, MAX_EDITOR_HEIGHT);
    }

    // Calculate height based on actual content height from Monaco's layout
    const contentHeight = editorRef.current.getContentHeight();
    return Math.min(contentHeight, MAX_EDITOR_HEIGHT);
  }, [jsonValue]);

  // Update height when jsonValue changes
  useEffect(() => {
    setEditorHeight(calculateHeight());
  }, [jsonValue, calculateHeight]);

  // Add decorations to make 🔍 indicators clickable
  const addExpandIndicatorDecorations = useCallback(() => {
    if (!editorRef.current || !monaco) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const decorations: editor.IModelDeltaDecoration[] = [];
    const text = model.getValue();
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      // Look for the 🔍 emoji after a closing quote
      const match = line.match(/" 🔍/);
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

  // Disable find widget when editor mounts
  const handleEditorMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    // Store editor instance for cleanup
    editorRef.current = editorInstance;

    // Set initial height after editor is mounted
    setTimeout(() => {
      setEditorHeight(calculateHeight());
      addExpandIndicatorDecorations();
    }, 0);

    // Disable the find widget command
    editorInstance.addCommand(
      monaco?.KeyMod.CtrlCmd! | monaco?.KeyCode.KeyF!,
      () => {
        // Do nothing - prevents find widget from opening
      }
    );
    editorInstance.getAction('editor.foldLevel2')?.run();

    // Disable folding for line 1 by hiding the folding widget
    const hideLine1FoldingWidget = () => {
      const editorDom = editorInstance.getDomNode();
      if (editorDom) {
        // Find all folding widgets
        const foldingWidgets = editorDom.querySelectorAll('.cldr');
        // Hide the first one (line 1)
        if (foldingWidgets.length > 0) {
          (foldingWidgets[0] as HTMLElement).style.display = 'none';
        }
      }
    };

    // Initial hide
    hideLine1FoldingWidget();

    // Re-hide on content changes (in case editor re-renders)
    const disposable = editorInstance.onDidChangeModelContent(() => {
      hideLine1FoldingWidget();
      // Update decorations when content changes
      setTimeout(() => addExpandIndicatorDecorations(), 0);
    });

    editorInstance.getAction("editor.foldLevel1")?.run();
    const runFold = () => {
      editorInstance.getAction("editor.foldLevel1")?.run();
    };

    // 1) Next frame (lets layout happen)
    requestAnimationFrame(runFold);

    // 2) After Monaco computes folding ranges (often needs another tick)
    setTimeout(runFold, 0);

    // 3) If the model changes (common with @monaco-editor/react), fold again
    const d1 = editorInstance.onDidChangeModel(() => {
      requestAnimationFrame(runFold);
      setTimeout(runFold, 0);
    });

    // If you're updating `value`, folding ranges can change after content update
    const d2 = editorInstance.onDidChangeModelContent(() => {
      // light debounce: fold after updates settle
      setTimeout(runFold, 0);
    });

    // Listen for layout changes (including folding/unfolding) to update height
    const d3 = editorInstance.onDidContentSizeChange(() => {
      // Recalculate height when content size changes (e.g., folding/unfolding)
      setEditorHeight(calculateHeight());
    });

    // Handle clicks on truncated strings to expand them
    const d4 = editorInstance.onMouseDown((e) => {
      const model = editorInstance.getModel();
      if (!model || !e.target.position) return;

      const position = e.target.position;
      const lineContent = model.getLineContent(position.lineNumber);

      // Check if the click is on or near the 🔍 emoji
      const clickColumn = position.column;
      const beforeClick = lineContent.substring(0, clickColumn + 2);
      const afterClick = lineContent.substring(clickColumn - 3);

      // Check if we clicked on the emoji (it appears after " )
      if (beforeClick.includes('" 🔍') || afterClick.startsWith('🔍')) {
        // Find the path for this truncated value
        const fullText = model.getValue();
        const pathAtPosition = findPathAtPosition(fullText, position.lineNumber, position.column);

        if (pathAtPosition && truncationMapRef.current.has(pathAtPosition)) {
          // Toggle expansion
          setExpandedPaths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pathAtPosition)) {
              newSet.delete(pathAtPosition);
            } else {
              newSet.add(pathAtPosition);
            }
            return newSet;
          });
        }
      }
    });

    // Store disposables for cleanup
    (editorInstance as any).__foldDisposables = [d1, d2, disposable, d3, d4];
  }, [monaco, calculateHeight, addExpandIndicatorDecorations]);

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
    </div>
  );
};

export default MonacoViewer;

