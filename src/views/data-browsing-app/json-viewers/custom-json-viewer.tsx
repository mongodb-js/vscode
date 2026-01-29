import React, { useState, useMemo, useCallback } from 'react';
import { VscodeIcon } from '@vscode-elements/react-elements';
import { css, cx, spacing } from '@mongodb-js/compass-components';
import { JsonTokenColors } from '../../../utils/themeColorReader';

export type TreeNodeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array';

export interface TreeNode {
  key: string;
  value: unknown;
  type: TreeNodeType;
  itemCount?: number;
}

export interface DocumentTreeViewProps {
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

function isObjectId(value: unknown): boolean {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return '$oid' in obj && typeof obj.$oid === 'string';
  }
  return false;
}

function formatObjectId(value: unknown): string {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('$oid' in obj && typeof obj.$oid === 'string') {
      return `ObjectId('${obj.$oid}')`;
    }
  }
  return String(value);
}

function getNodeType(value: unknown): TreeNodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isObjectId(value)) return 'string';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function formatValue(
  value: unknown,
  type: TreeNodeType,
  isExpanded = true,
): string {
  switch (type) {
    case 'null':
      return 'null';
    case 'boolean':
    case 'number':
      return String(value);
    case 'array': {
      const count = (value as unknown[]).length;
      return isExpanded ? '[' : `Array [${count}]`;
    }
    case 'object': {
      const count = Object.keys(value as Record<string, unknown>).length;
      return isExpanded ? '{' : `Object (${count})`;
    }
    case 'string':
    default: {
      if (isObjectId(value)) return formatObjectId(value);
      const strValue = String(value);
      if (strValue.startsWith('"') || strValue.match(/^[A-Z][a-z]+\(/)) {
        return strValue;
      }
      return `"${strValue}"`;
    }
  }
}

function formatIdValue(value: unknown): string {
  if (typeof value === 'string') {
    if (value.match(/^[A-Z][a-z]+\(/)) return value;
    return `"${value}"`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('$oid' in obj && typeof obj.$oid === 'string') {
      return `ObjectId('${obj.$oid}')`;
    }
    return JSON.stringify(value);
  }
  return `"${String(value)}"`;
}

function getValueKind(value: unknown): 'array' | 'object' | 'primitive' {
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'primitive';
}

function parseDocument(doc: Record<string, unknown>): TreeNode[] {
  return Object.entries(doc).map(([key, value]) => {
    const type = getNodeType(value);
    let itemCount: number | undefined;
    if (type === 'array') {
      itemCount = (value as unknown[]).length;
    } else if (type === 'object') {
      itemCount = Object.keys(value as Record<string, unknown>).length;
    }
    return { key, value, type, itemCount };
  });
}

const containerStyles = css({
  marginBottom: spacing[200],
});

const cardStyles = css({
  backgroundColor: 'var(--vscode-editor-background)',
  border: '1px solid var(--vscode-panel-border, #3C3C3C)',
  borderRadius: spacing[100],
  padding: `${spacing[300]}px ${spacing[400]}px`,
  fontFamily:
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: '12px',
  lineHeight: '18px',
});

const nodeRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
  minHeight: spacing[400],
});

const caretStyles = css({
  width: spacing[300],
  height: spacing[300],
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const expandButtonStyles = css({
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--vscode-foreground, #CCCCCC)',
});

const childrenContainerStyles = css({
  paddingLeft: spacing[400],
});

const keyValueContainerStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
});

const valueStyles = css({
  maxWidth: '70ch',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const clickableRowStyles = css({
  cursor: 'pointer',
});

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({
  document,
  themeColors,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const nodes = useMemo(() => parseDocument(document), [document]);

  const colors = useMemo(
    () => ({
      key: themeColors?.key ?? DEFAULT_COLORS.key,
      string: themeColors?.string ?? DEFAULT_COLORS.string,
      number: themeColors?.number ?? DEFAULT_COLORS.number,
      boolean: themeColors?.boolean ?? DEFAULT_COLORS.boolean,
      null: themeColors?.null ?? DEFAULT_COLORS.null,
      object: themeColors?.boolean ?? DEFAULT_COLORS.boolean,
      array: themeColors?.boolean ?? DEFAULT_COLORS.boolean,
      divider: themeColors?.punctuation ?? DEFAULT_COLORS.punctuation,
    }),
    [themeColors],
  );

  const getValueColor = useCallback(
    (type: TreeNodeType): string => {
      switch (type) {
        case 'number':
          return colors.number;
        case 'boolean':
        case 'null':
          return colors.boolean;
        case 'string':
          return colors.string;
        case 'object':
        case 'array':
          return colors.object;
        default:
          return colors.string;
      }
    },
    [colors],
  );

  const toggleExpanded = useCallback((key: string): void => {
    setExpandedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const getInteractiveRowProps = (
    hasExpandable: boolean,
    itemKey: string,
  ): {
    className: string;
    props: Record<string, unknown>;
  } => {
    if (!hasExpandable) {
      return { className: nodeRowStyles, props: {} };
    }
    const handleClick = (): void => toggleExpanded(itemKey);
    return {
      className: cx(nodeRowStyles, clickableRowStyles),
      props: {
        onClick: handleClick,
        onKeyDown: (e: React.KeyboardEvent): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        },
        role: 'button',
        tabIndex: 0,
      },
    };
  };

  const renderExpandButton = (isExpanded: boolean): JSX.Element => (
    <div className={expandButtonStyles} aria-hidden="true">
      <VscodeIcon
        name={isExpanded ? 'chevron-down' : 'chevron-right'}
        size={12}
      />
    </div>
  );

  const renderArrayChildren = (
    arr: unknown[],
    parentKey: string,
  ): JSX.Element[] => {
    return arr.map((item, index) => {
      const type = getNodeType(item);
      const isLast = index === arr.length - 1;
      const itemKey = `${parentKey}.${index}`;
      const hasExpandable = type === 'object' || type === 'array';
      const isExp = expandedKeys.has(itemKey);
      const { className, props } = getInteractiveRowProps(
        hasExpandable,
        itemKey,
      );

      return (
        <div key={index}>
          <div className={className} {...props}>
            <div className={caretStyles}>
              {hasExpandable && renderExpandButton(isExp)}
            </div>
            <div className={keyValueContainerStyles}>
              <span style={{ color: getValueColor(type) }}>
                {formatValue(item, type, isExp)}
              </span>
              {!isLast && <span style={{ color: colors.divider }}>,</span>}
            </div>
          </div>
          {hasExpandable && isExp && (
            <div className={childrenContainerStyles}>
              {renderChildren(item, itemKey)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderObjectChildren = (
    obj: Record<string, unknown>,
    parentKey: string,
  ): JSX.Element[] => {
    const entries = Object.entries(obj);
    return entries.map(([key, val], index) => {
      const type = getNodeType(val);
      const isLast = index === entries.length - 1;
      const itemKey = `${parentKey}.${key}`;
      const hasExpandable = type === 'object' || type === 'array';
      const isExp = expandedKeys.has(itemKey);
      const { className, props } = getInteractiveRowProps(
        hasExpandable,
        itemKey,
      );

      return (
        <div key={key}>
          <div className={className} {...props}>
            <div className={caretStyles}>
              {hasExpandable && renderExpandButton(isExp)}
            </div>
            <div className={keyValueContainerStyles}>
              <span style={{ color: colors.key, fontWeight: 'bold' }}>
                &quot;{key}&quot;
              </span>
              <span style={{ color: colors.divider }}>:&nbsp;</span>
              <span style={{ color: getValueColor(type) }}>
                {formatValue(val, type, isExp)}
              </span>
              {!isLast && <span style={{ color: colors.divider }}>,</span>}
            </div>
          </div>
          {hasExpandable && isExp && (
            <div className={childrenContainerStyles}>
              {renderChildren(val, itemKey)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderChildren = (value: unknown, parentKey: string): JSX.Element[] => {
    switch (getValueKind(value)) {
      case 'array':
        return renderArrayChildren(value as unknown[], parentKey);
      case 'object':
        return renderObjectChildren(
          value as Record<string, unknown>,
          parentKey,
        );
      default:
        return [];
    }
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
        {!isLast && <span style={{ color: colors.divider }}>,</span>}
      </div>
    </div>
  );

  const renderNode = (node: TreeNode, isLast = false): JSX.Element => {
    const isIdField = node.key === '_id';
    const hasExpandable =
      !isIdField && (node.type === 'object' || node.type === 'array');
    const isExp = expandedKeys.has(node.key);
    const valueColor = getValueColor(isIdField ? 'string' : node.type);
    const { className, props } = getInteractiveRowProps(
      hasExpandable,
      node.key,
    );

    return (
      <div key={node.key}>
        <div className={className} {...props}>
          <div className={caretStyles}>
            {hasExpandable && renderExpandButton(isExp)}
          </div>
          <div className={keyValueContainerStyles}>
            <span style={{ color: colors.key, fontWeight: 'bold' }}>
              &quot;{node.key}&quot;
            </span>
            <span style={{ color: colors.divider }}>:</span>
            <span className={valueStyles} style={{ color: valueColor }}>
              {isIdField
                ? formatIdValue(node.value)
                : formatValue(node.value, node.type, isExp)}
            </span>
            {!isExp && !isLast && (
              <span style={{ color: colors.divider }}>,</span>
            )}
          </div>
        </div>
        {hasExpandable && isExp && (
          <div className={childrenContainerStyles}>
            {renderChildren(node.value, node.key)}
          </div>
        )}
        {hasExpandable && isExp && renderClosingBracket(node.type, isLast)}
      </div>
    );
  };

  return (
    <div className={containerStyles}>
      <div className={cardStyles}>
        {nodes.map((node, index) =>
          renderNode(node, index === nodes.length - 1),
        )}
      </div>
    </div>
  );
};

export default DocumentTreeView;
