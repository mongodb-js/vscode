import React, { useState } from 'react';
import { css } from '@mongodb-js/compass-components';

const documentTreeViewContainerStyles = css({
  display: 'flex',
  padding: '0',
  alignItems: 'flex-start',
  alignSelf: 'stretch',
  position: 'relative',
  width: '100%',
  marginBottom: '8px',
});

const documentContentStyles = css({
  display: 'flex',
  padding: '12px 16px',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  flex: '1 0 0',
  borderRadius: '4px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  position: 'relative',
  backgroundColor: '#2D2D30',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  width: '100%',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  '@media (max-width: 991px)': {
    padding: '10px 14px',
  },
  '@media (max-width: 640px)': {
    padding: '8px 12px',
    fontSize: '12px',
  },
});

const parentNodeStyles = css({
  display: 'flex',
  padding: '0',
  flexDirection: 'column',
  alignItems: 'flex-start',
  position: 'relative',
  width: '100%',
});

const nodeRowStyles = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '4px',
  alignSelf: 'stretch',
  position: 'relative',
  minHeight: '19px',
  paddingLeft: '16px',
  '@media (max-width: 640px)': {
    gap: '3px',
    paddingLeft: '12px',
  },
});

const caretStyles = css({
  width: '16px',
  height: '19px',
  position: 'relative',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: '-16px',
  '@media (max-width: 640px)': {
    marginLeft: '-12px',
  },
});

const caretIconStyles = css({
  color: '#CCCCCC',
  fontSize: '12px',
  lineHeight: '19px',
  fontFamily: 'codicon',
  userSelect: 'none',
  cursor: 'pointer',
  transition: 'transform 0.1s ease',
  '&:hover': {
    color: '#FFFFFF',
  },
});

const clickableRowStyle = css({
  cursor: 'pointer',
});

const caretExpandedStyles = css({
  transform: 'rotate(90deg)',
});

const childrenContainerStyles = css({
  paddingLeft: '16px',
  '@media (max-width: 640px)': {
    paddingLeft: '12px',
  },
});

const keyValueContainerStyles = css({
  display: 'flex',
  alignItems: 'flex-start',
  position: 'relative',
  flexWrap: 'wrap',
  gap: '0',
});

const keyStyles = css({
  color: '#9CDCFE',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  whiteSpace: 'nowrap',
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
});

const colonStyles = css({
  color: '#D4D4D4',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
});

const valueStyles = css({
  color: '#CE9178',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
});

const numberValueStyles = css({
  color: '#B5CEA8',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
});

const objectValueStyles = css({
  color: '#4EC9B0',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
});

const commaStyles = css({
  color: '#D4D4D4',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '19px',
  fontWeight: 400,
  '@media (max-width: 640px)': {
    fontSize: '12px',
  },
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

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
    isExpanded = true
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
                {hasExpandableContent && (
                  <span
                    className={`${caretIconStyles} ${isExpanded ? caretExpandedStyles : ''}`}
                    onClick={(): void => toggleExpanded(itemKey)}
                  >
                    ›
                  </span>
                )}
              </div>
              <div className={keyValueContainerStyles}>
                <span className={valueStyles}>
                  {formatValue(item, type)}
                </span>
                {!isLast && <span className={commaStyles}>,</span>}
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
                {hasExpandableContent && (
                  <span
                    className={`${caretIconStyles} ${isExpanded ? caretExpandedStyles : ''}`}
                    onClick={(): void => toggleExpanded(itemKey)}
                  >
                    ›
                  </span>
                )}
              </div>
              <div className={keyValueContainerStyles}>
                <span className={keyStyles}>{key}</span>
                <span className={colonStyles}>:</span>
                <span className={type === 'number' || type === 'boolean' || type === 'null' ? numberValueStyles : valueStyles}>
                  {formatValue(val, type)}
                </span>
                {!isLast && <span className={commaStyles}>,</span>}
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

  const getValueClassName = (type: TreeNode['type']): string => {
    if (type === 'number') {
      return numberValueStyles;
    }
    if (type === 'object' || type === 'array') {
      return objectValueStyles;
    }
    if (type === 'boolean' || type === 'null') {
      return numberValueStyles;
    }
    return valueStyles;
  };

  const renderClosingBracket = (
    nodeType: TreeNode['type'],
    isLast: boolean
  ): JSX.Element => (
    <div className={nodeRowStyles}>
      <div className={caretStyles} />
      <div className={keyValueContainerStyles}>
        <span className={objectValueStyles}>
          {nodeType === 'array' ? ']' : '}'}
        </span>
        {!isLast && <span className={commaStyles}>,</span>}
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
    isExpanded: boolean
  ): string => {
    if (isIdField) {
      return formatIdValue(node.value);
    }
    return formatValue(node.value, node.type, isExpanded);
  };

  const renderExpandCaret = (
    isExpanded: boolean
  ): JSX.Element => (
    <span
      className={`${caretIconStyles} ${isExpanded ? caretExpandedStyles : ''}`}
    >
      ›
    </span>
  );

  const getRowClassName = (hasExpandableContent: boolean): string =>
    `${nodeRowStyles} ${hasExpandableContent ? clickableRowStyle : ''}`;

  const createRowClickHandler = (
    hasExpandableContent: boolean,
    nodeKey: string
  ): (() => void) | undefined =>
    hasExpandableContent ? (): void => toggleExpanded(nodeKey) : undefined;

  const renderNode = (node: TreeNode, isLast = false): JSX.Element => {
    const isIdField = node.key === '_id';
    const hasExpandableContent =
      !isIdField && (node.type === 'object' || node.type === 'array');
    const isExpanded = expandedKeys.has(node.key);
    const displayClassName = isIdField ? valueStyles : getValueClassName(node.type);

    return (
      <div className={parentNodeStyles} key={node.key}>
        <div
          className={getRowClassName(hasExpandableContent)}
          onClick={createRowClickHandler(hasExpandableContent, node.key)}
        >
          <div className={caretStyles}>
            {hasExpandableContent && renderExpandCaret(isExpanded)}
          </div>
          <div className={keyValueContainerStyles}>
            <span className={keyStyles}>"{node.key}"</span>
            <span className={colonStyles}>:</span>
            <span className={displayClassName}>
              {getNodeDisplayValue(node, isIdField, isExpanded)}
            </span>
            {!isExpanded && !isLast && <span className={commaStyles}>,</span>}
          </div>
        </div>
        {hasExpandableContent && isExpanded && (
          <div className={childrenContainerStyles}>
            {renderChildren(node.value, node.key)}
          </div>
        )}
        {hasExpandableContent && isExpanded && renderClosingBracket(node.type, isLast)}
      </div>
    );
  };

  const nodes = parseDocument(document);

  return (
    <div className={documentTreeViewContainerStyles}>
      <div className={documentContentStyles}>
        {nodes.map((node, index) => renderNode(node, index === nodes.length - 1))}
      </div>
    </div>
  );
};

export default DocumentTreeView;
