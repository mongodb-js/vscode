import React, { useState, useMemo } from 'react';
import { VscodeIcon } from '@vscode-elements/react-elements';
import { css, cx, spacing } from '@mongodb-js/compass-components';
import type { JsonTokenColors } from './extension-app-message-constants';

interface DocumentTreeViewProps {
  document: Record<string, unknown>;
  themeColors?: JsonTokenColors;
}

interface TreeNode {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  itemCount?: number;
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
};

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

const clickableRowStyles = css({
  cursor: 'pointer',
});

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({
  document,
  themeColors,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

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

  const getValueColor = (type: TreeNode['type']): string => {
    switch (type) {
      case 'number':
        return colors.number;
      case 'boolean':
      case 'null':
        return colors.boolean;
      case 'string':
        return colors.string;
      case 'object':
        return colors.object;
      case 'array':
        return colors.object;
      default:
        return colors.string;
    }
  };

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

  const isObjectId = (value: unknown): boolean => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return '$oid' in obj && typeof obj.$oid === 'string';
    }
    return false;
  };

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
  };

  const parseDocument = (doc: Record<string, unknown>): TreeNode[] => {
    return Object.entries(doc).map(([key, value]) => {
      const type = getNodeType(value);
      let itemCount: number | undefined;
      if (type === 'array') itemCount = (value as unknown[]).length;
      else if (type === 'object')
        itemCount = Object.keys(value as Record<string, unknown>).length;
      return { key, value, type, itemCount };
    });
  };

  const renderExpandButton = (
    isExpanded: boolean,
    itemKey: string,
  ): JSX.Element => (
    <button
      type="button"
      tabIndex={0}
      className={expandButtonStyles}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
      onClick={(e): void => {
        e.stopPropagation();
        toggleExpanded(itemKey);
      }}
      onKeyDown={(e): void => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          toggleExpanded(itemKey);
        }
      }}
    >
      <VscodeIcon
        name={isExpanded ? 'chevron-down' : 'chevron-right'}
        size={12}
      />
    </button>
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

      return (
        <div key={index}>
          <div className={nodeRowStyles}>
            <div className={caretStyles}>
              {hasExpandable && renderExpandButton(isExp, itemKey)}
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

      return (
        <div key={key}>
          <div className={nodeRowStyles}>
            <div className={caretStyles}>
              {hasExpandable && renderExpandButton(isExp, itemKey)}
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

  const getValueKind = (value: unknown): 'array' | 'object' | 'primitive' => {
    if (Array.isArray(value)) return 'array';
    if (value !== null && typeof value === 'object') return 'object';
    return 'primitive';
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

  const formatIdValue = (value: unknown): string => {
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
  };

  const renderNode = (node: TreeNode, isLast = false): JSX.Element => {
    const isIdField = node.key === '_id';
    const hasExpandable =
      !isIdField && (node.type === 'object' || node.type === 'array');
    const isExp = expandedKeys.has(node.key);
    const valueColor = getValueColor(isIdField ? 'string' : node.type);

    const handleClick = hasExpandable
      ? (): void => toggleExpanded(node.key)
      : undefined;
    const rowClassName = hasExpandable
      ? cx(nodeRowStyles, clickableRowStyles)
      : nodeRowStyles;

    const interactiveProps = hasExpandable
      ? {
          onClick: handleClick,
          onKeyDown: (e: React.KeyboardEvent): void => {
            if (e.key === 'Enter' || e.key === ' ') handleClick?.();
          },
          role: 'button' as const,
          tabIndex: 0,
        }
      : {};

    return (
      <div key={node.key}>
        <div className={rowClassName} {...interactiveProps}>
          <div className={caretStyles}>
            {hasExpandable && renderExpandButton(isExp, node.key)}
          </div>
          <div className={keyValueContainerStyles}>
            <span style={{ color: colors.key, fontWeight: 'bold' }}>
              &quot;{node.key}&quot;
            </span>
            <span style={{ color: colors.divider }}>:</span>
            <span style={{ color: valueColor }}>
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

  const nodes = parseDocument(document);

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
