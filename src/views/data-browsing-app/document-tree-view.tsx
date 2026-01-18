import React, { useState } from 'react';
import { VscodeIcon } from '@vscode-elements/react-elements';

interface DocumentTreeViewProps {
  document: Record<string, unknown>;
}

interface TreeNode {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  itemCount?: number;
}

// Color palette for syntax highlighting (VS Code dark theme compatible)
const colors = {
  key: 'var(--vscode-debugTokenExpression-name, #9CDCFE)',
  string: 'var(--vscode-debugTokenExpression-string, #CE9178)',
  number: 'var(--vscode-debugTokenExpression-number, #B5CEA8)',
  boolean: 'var(--vscode-debugTokenExpression-boolean, #569CD6)',
  null: 'var(--vscode-debugTokenExpression-boolean, #569CD6)',
  objectArray: 'var(--vscode-symbolIcon-classForeground, #4EC9B0)',
  divider: 'var(--vscode-foreground, #CCCCCC)',
};

const styles = {
  container: {
    marginBottom: '8px',
  },
  card: {
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border, #3C3C3C)',
    borderRadius: '4px',
    padding: '12px 16px',
    fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
    fontSize: '12px',
    lineHeight: '18px',
  },
  nodeRow: {
    display: 'flex',
    gap: '4px',
    minHeight: '18px',
    paddingLeft: '16px',
  },
  caret: {
    width: '16px',
    height: '18px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '-16px',
  },
  expandButton: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    display: 'flex',
    cursor: 'pointer',
    color: 'inherit',
  },
  childrenContainer: {
    paddingLeft: '16px',
  },
  keyValueContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
  },
  clickableRow: {
    cursor: 'pointer',
  },
};

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({ document }) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const getValueColor = (type: TreeNode['type']): string => {
    switch (type) {
      case 'number': return colors.number;
      case 'boolean':
      case 'null': return colors.boolean;
      case 'string': return colors.string;
      case 'object':
      case 'array': return colors.objectArray;
      default: return colors.string;
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

  const formatValue = (value: unknown, type: TreeNode['type'], isExpanded = true): string => {
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
    if (isObjectId(value)) return formatObjectId(value);
    const strValue = String(value);
    if (strValue.startsWith('"') || strValue.match(/^[A-Z][a-z]+\(/)) return strValue;
    return `"${strValue}"`;
  };

  const parseDocument = (doc: Record<string, unknown>): TreeNode[] => {
    return Object.entries(doc).map(([key, value]) => {
      const type = getNodeType(value);
      let itemCount: number | undefined;
      if (type === 'array') itemCount = (value as unknown[]).length;
      else if (type === 'object') itemCount = Object.keys(value as Record<string, unknown>).length;
      return { key, value, type, itemCount };
    });
  };

  const renderExpandButton = (isExpanded: boolean, itemKey: string): JSX.Element => (
    <button
      type="button"
      style={styles.expandButton}
      aria-pressed={isExpanded}
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
      onClick={(e): void => { e.stopPropagation(); toggleExpanded(itemKey); }}
    >
      <VscodeIcon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={12} />
    </button>
  );

  const renderChildren = (value: unknown, parentKey: string): JSX.Element[] => {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const type = getNodeType(item);
        const isLast = index === value.length - 1;
        const itemKey = `${parentKey}.${index}`;
        const hasExpandable = type === 'object' || type === 'array';
        const isExp = expandedKeys.has(itemKey);

        return (
          <div key={index}>
            <div style={styles.nodeRow}>
              <div style={styles.caret}>
                {hasExpandable && renderExpandButton(isExp, itemKey)}
              </div>
              <div style={styles.keyValueContainer}>
                <span style={{ color: getValueColor(type) }}>
                  {formatValue(item, type, isExp)}
                </span>
                {!isLast && <span style={{ color: colors.divider }}>,</span>}
              </div>
            </div>
            {hasExpandable && isExp && (
              <div style={styles.childrenContainer}>
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
        const hasExpandable = type === 'object' || type === 'array';
        const isExp = expandedKeys.has(itemKey);

        return (
          <div key={key}>
            <div style={styles.nodeRow}>
              <div style={styles.caret}>
                {hasExpandable && renderExpandButton(isExp, itemKey)}
              </div>
              <div style={styles.keyValueContainer}>
                <span style={{ color: colors.key, fontWeight: 'bold' }}>"{key}"</span>
                <span style={{ color: colors.divider }}>:&nbsp;</span>
                <span style={{ color: getValueColor(type) }}>
                  {formatValue(val, type, isExp)}
                </span>
                {!isLast && <span style={{ color: colors.divider }}>,</span>}
              </div>
            </div>
            {hasExpandable && isExp && (
              <div style={styles.childrenContainer}>
                {renderChildren(val, itemKey)}
              </div>
            )}
          </div>
        );
      });
    }
    return [];
  };

  const renderClosingBracket = (nodeType: TreeNode['type'], isLast: boolean): JSX.Element => (
    <div style={styles.nodeRow}>
      <div style={styles.caret} />
      <div style={styles.keyValueContainer}>
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
    const hasExpandable = !isIdField && (node.type === 'object' || node.type === 'array');
    const isExp = expandedKeys.has(node.key);
    const valueColor = getValueColor(isIdField ? 'string' : node.type);

    const handleClick = hasExpandable ? (): void => toggleExpanded(node.key) : undefined;
    const rowStyle = hasExpandable
      ? { ...styles.nodeRow, ...styles.clickableRow }
      : styles.nodeRow;

    return (
      <div key={node.key}>
        <div style={rowStyle} onClick={handleClick}>
          <div style={styles.caret}>
            {hasExpandable && renderExpandButton(isExp, node.key)}
          </div>
          <div style={styles.keyValueContainer}>
            <span style={{ color: colors.key, fontWeight: 'bold' }}>"{node.key}"</span>
            <span style={{ color: colors.divider }}>:</span>
            <span style={{ color: valueColor }}>
              {isIdField ? formatIdValue(node.value) : formatValue(node.value, node.type, isExp)}
            </span>
            {!isExp && !isLast && <span style={{ color: colors.divider }}>,</span>}
          </div>
        </div>
        {hasExpandable && isExp && (
          <div style={styles.childrenContainer}>
            {renderChildren(node.value, node.key)}
          </div>
        )}
        {hasExpandable && isExp && renderClosingBracket(node.type, isLast)}
      </div>
    );
  };

  const nodes = parseDocument(document);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {nodes.map((node, index) => renderNode(node, index === nodes.length - 1))}
      </div>
    </div>
  );
};

export default DocumentTreeView;

