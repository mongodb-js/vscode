import React from 'react';
import { css, spacing } from '@mongodb-js/compass-components';
import { SyntaxHighlighterViewer, CustomJsonViewer, MonacoViewer, type ViewerType } from './json-viewers';
import { JsonTokenColors } from '../../utils/themeColorReader';

interface DocumentTreeViewProps {
  document: Record<string, unknown>;
  viewerType?: ViewerType;
  themeColors?: JsonTokenColors;
}

const containerStyles = css({
  marginBottom: spacing[200],
});

const cardStyles = css({
  backgroundColor: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border: '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
});

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({
  document,
  viewerType = 'monaco',
  themeColors,
}) => {
  const renderViewer = (): React.ReactNode => {
    switch (viewerType) {
      case 'syntax-highlighter':
        return <SyntaxHighlighterViewer document={document} />;
      case 'custom':
        return <CustomJsonViewer document={document} themeColors={themeColors} />;
      case 'monaco':
      default:
        return <MonacoViewer document={document} />;
    }
  };

  return (
    <div className={containerStyles}>
      <div className={cardStyles}>
        {renderViewer()}
      </div>
    </div>
  );
};

export default DocumentTreeView;
export type { ViewerType };

