import React, { useState } from 'react';
import {
  css,
  cx,
  spacing,
  fontFamilies,
  KeylineCard,
  Icon,
  palette,
  codePalette,
  useDarkMode,
} from '@mongodb-js/compass-components';

const documentTreeViewContainerStyles = css({
  marginBottom: spacing[200],
});

const documentContentStyles = css({
  padding: `${spacing[300]}px ${spacing[400]}px`,
  fontFamily: fontFamilies.code,
  fontSize: 12,
  lineHeight: '16px',
});

const parentNodeStyles = css({
  display: 'flex',
  flexDirection: 'column',
});

const nodeRowStyles = css({
  display: 'flex',
  gap: spacing[100],
  minHeight: 16,
  paddingLeft: spacing[400],
});

const caretStyles = css({
  width: spacing[400],
  height: 16,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: -spacing[400],
});

const expandButtonStyles = css({
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  display: 'flex',
  cursor: 'pointer',
});

const clickableRowStyle = css({
  cursor: 'pointer',
});

const childrenContainerStyles = css({
  paddingLeft: spacing[400],
});

const keyValueContainerStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
});

const keyStylesBase = css({
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
});

const keyStylesLight = css({
  color: palette.gray.dark3,
});

const keyStylesDark = css({
  color: palette.gray.light2,
});

const dividerStylesBase = css({
  userSelect: 'none',
});

const dividerStylesLight = css({
  color: palette.gray.dark1,
});

const dividerStylesDark = css({
  color: palette.gray.light1,
});

interface DocumentTreeViewProps {
  document: Record<string, unknown>;
}

interface TreeNode {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  itemCount?: number;
}

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({ document }) => {
  const darkMode = useDarkMode();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Get theme-aware color for value types using codePalette
  const getValueColor = (type: TreeNode['type']): string => {
    const themeColors = darkMode ? codePalette.dark : codePalette.light;
    switch (type) {
      case 'number':
        return themeColors[9]; // Number color
      case 'boolean':
      case 'null':
        return themeColors[10]; // Boolean/null color
      case 'string':
        return themeColors[7]; // String color
      case 'object':
      case 'array':
        return themeColors[5]; // Object/array color
      default:
        return themeColors[7];
    }
  };

  // Get dynamic styles based on dark mode
  const keyStyles = cx(
    keyStylesBase,
    darkMode ? keyStylesDark : keyStylesLight,
  );
  const dividerStyles = cx(
    dividerStylesBase,
    darkMode ? dividerStylesDark : dividerStylesLight,
  );

  const toggleExpanded = (key: string): void => {
    setExpandedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Check if value is an ObjectId (EJSON format with $oid)
  const isObjectId = (value: unknown): boolean => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return '$oid' in obj && typeof obj.$oid === 'string';
    }
    return false;
  };

  // Format ObjectId for inline display
  const formatObjectId = (value: unknown): string => {
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if ('$oid' in obj && typeof obj.$oid === 'string') {
        return `ObjectId('${obj.$oid}')`;
      }
    }
    return String(value);
  };

  const getNodeType = (value: unknown): TreeNode['type'] => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    // Treat ObjectId as a string (inline display) rather than expandable object
    if (isObjectId(value)) return 'string';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  };

  const formatValue = (
    value: unknown,
    type: TreeNode['type'],
    isExpanded = true,
  ): string => {
    if (type === 'null') return 'null';
    if (type === 'boolean') return String(value);
    if (type === 'number') return String(value);
    if (type === 'array') {
      const count = (value as unknown[]).length;
      return isExpanded ? '[' : `Array [${count}]`;
    }
    if (type === 'object') {
      const count = Object.keys(value as Record<string, unknown>).length;
      return isExpanded ? '{' : `Object (${count})`;
    }
    // String type - check if it's an ObjectId first
    if (isObjectId(value)) {
      return formatObjectId(value);
    }
    const strValue = String(value);
    // If it's already quoted or looks like a special type (ObjectId, etc.), return as-is
    if (strValue.startsWith('"') || strValue.match(/^[A-Z][a-z]+\(/)) {
      return strValue;
    }
    return `"${strValue}"`;
  };

  const parseDocument = (doc: Record<string, unknown>): TreeNode[] => {
    return Object.entries(doc).map(([key, value]) => {
      const type = getNodeType(value);
      let itemCount: number | undefined;

      if (type === 'array') {
        itemCount = (value as unknown[]).length;
      } else if (type === 'object') {
        itemCount = Object.keys(value as Record<string, unknown>).length;
      }

      return {
        key,
        value,
        type,
        itemCount,
      };
    });
  };

  const renderExpandButton = (
    isExpanded: boolean,
    itemKey: string,
  ): JSX.Element => (
    <button
      type="button"
      className={expandButtonStyles}
      aria-pressed={isExpanded}
      aria-label={isExpanded ? 'Collapse field items' : 'Expand field items'}
      onClick={(evt): void => {
        evt.stopPropagation();
        toggleExpanded(itemKey);
      }}
    >
      <Icon size="xsmall" glyph={isExpanded ? 'CaretDown' : 'CaretRight'} />
    </button>
  );

  const renderChildren = (value: unknown, parentKey: string): JSX.Element[] => {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const type = getNodeType(item);
        const isLast = index === value.length - 1;
        const itemKey = `${parentKey}.${index}`;
        const hasExpandableContent = type === 'object' || type === 'array';
        const isExpanded = expandedKeys.has(itemKey);

        return (
          <div key={index}>
            <div className={nodeRowStyles}>
              <div className={caretStyles}>
                {hasExpandableContent &&
                  renderExpandButton(isExpanded, itemKey)}
              </div>
              <div className={keyValueContainerStyles}>
                <span style={{ color: getValueColor(type) }}>
                  {formatValue(item, type)}
                </span>
                {!isLast && <span className={dividerStyles}>,</span>}
              </div>
            </div>
            {hasExpandableContent && isExpanded && (
              <div className={childrenContainerStyles}>
                {renderChildren(item, itemKey)}
              </div>
            )}
          </div>
        );
      });
    } else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>);
      return entries.map(([key, val], index) => {
        const type = getNodeType(val);
        const isLast = index === entries.length - 1;
        const itemKey = `${parentKey}.${key}`;
        const hasExpandableContent = type === 'object' || type === 'array';
        const isExpanded = expandedKeys.has(itemKey);

        return (
          <div key={key}>
            <div className={nodeRowStyles}>
              <div className={caretStyles}>
                {hasExpandableContent &&
                  renderExpandButton(isExpanded, itemKey)}
              </div>
              <div className={keyValueContainerStyles}>
                <span className={keyStyles}>{key}</span>
                <span className={dividerStyles}>:&nbsp;</span>
                <span style={{ color: getValueColor(type) }}>
                  {formatValue(val, type)}
                </span>
                {!isLast && <span className={dividerStyles}>,</span>}
              </div>
            </div>
            {hasExpandableContent && isExpanded && (
              <div className={childrenContainerStyles}>
                {renderChildren(val, itemKey)}
              </div>
            )}
          </div>
        );
      });
    }
    return [];
  };

  const renderClosingBracket = (
    nodeType: TreeNode['type'],
    isLast: boolean,
  ): JSX.Element => (
    <div className={nodeRowStyles}>
      <div className={caretStyles} />
      <div className={keyValueContainerStyles}>
        <span style={{ color: getValueColor(nodeType) }}>
          {nodeType === 'array' ? ']' : '}'}
        </span>
        {!isLast && <span className={dividerStyles}>,</span>}
      </div>
    </div>
  );

  const formatIdValue = (value: unknown): string => {
    // Handle _id which is typically an ObjectId or string
    if (typeof value === 'string') {
      if (value.match(/^[A-Z][a-z]+\(/)) {
        return value;
      }
      return `"${value}"`;
    }
    // Handle ObjectId-like objects with $oid property
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if ('$oid' in obj && typeof obj.$oid === 'string') {
        return `ObjectId('${obj.$oid}')`;
      }
      // Fallback: serialize as JSON
      return JSON.stringify(value);
    }
    return `"${String(value)}"`;
  };

  const getNodeDisplayValue = (
    node: TreeNode,
    isIdField: boolean,
    isExpanded: boolean,
  ): string => {
    if (isIdField) {
      return formatIdValue(node.value);
    }
    return formatValue(node.value, node.type, isExpanded);
  };

  const getRowClassName = (hasExpandableContent: boolean): string =>
    cx(nodeRowStyles, hasExpandableContent && clickableRowStyle);

  const createRowClickHandler = (
    hasExpandableContent: boolean,
    nodeKey: string,
  ): (() => void) | undefined =>
    hasExpandableContent ? (): void => toggleExpanded(nodeKey) : undefined;

  const renderNode = (node: TreeNode, isLast = false): JSX.Element => {
    const isIdField = node.key === '_id';
    const hasExpandableContent =
      !isIdField && (node.type === 'object' || node.type === 'array');
    const isExpanded = expandedKeys.has(node.key);
    // For _id field, use string color; otherwise use type-based color
    const valueColor = getValueColor(isIdField ? 'string' : node.type);

    const handleKeyDown = hasExpandableContent
      ? (e: React.KeyboardEvent): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded(node.key);
          }
        }
      : undefined;

    return (
      <div className={parentNodeStyles} key={node.key}>
        <div
          className={getRowClassName(hasExpandableContent)}
          onClick={createRowClickHandler(hasExpandableContent, node.key)}
          onKeyDown={handleKeyDown}
          role={hasExpandableContent ? 'button' : undefined}
          tabIndex={hasExpandableContent ? 0 : undefined}
          aria-expanded={hasExpandableContent ? isExpanded : undefined}
        >
          <div className={caretStyles}>
            {hasExpandableContent && renderExpandButton(isExpanded, node.key)}
          </div>
          <div className={keyValueContainerStyles}>
            <span className={keyStyles}>&quot;{node.key}&quot;</span>
            <span className={dividerStyles}>:&nbsp;</span>
            <span style={{ color: valueColor }}>
              {getNodeDisplayValue(node, isIdField, isExpanded)}
            </span>
            {!isExpanded && !isLast && <span className={dividerStyles}>,</span>}
          </div>
        </div>
        {hasExpandableContent && isExpanded && (
          <div className={childrenContainerStyles}>
            {renderChildren(node.value, node.key)}
          </div>
        )}
        {hasExpandableContent &&
          isExpanded &&
          renderClosingBracket(node.type, isLast)}
      </div>
    );
  };

  const nodes = parseDocument(document);

  return (
    <div className={documentTreeViewContainerStyles}>
      <KeylineCard className={documentContentStyles}>
        {nodes.map((node, index) =>
          renderNode(node, index === nodes.length - 1),
        )}
      </KeylineCard>
    </div>
  );
};

export default DocumentTreeView;
