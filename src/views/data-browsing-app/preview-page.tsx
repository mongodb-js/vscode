import React, { useEffect, useState } from 'react';
import { css, spacing, useDarkMode } from '@mongodb-js/compass-components';
import { VscodeProgressRing } from '@vscode-elements/react-elements';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import { PreviewMessageType } from './extension-app-message-constants';
import { sendGetDocuments } from './vscode-api';

interface PreviewDocument {
  [key: string]: unknown;
}
const loadingOverlayStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[600],
  flexDirection: 'column',
  gap: spacing[300],
});

const PreviewApp: React.FC = () => {
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const darkMode = useDarkMode();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === PreviewMessageType.loadDocuments) {
        setDocuments(message.documents || []);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial documents
    sendGetDocuments();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF',
        minHeight: '100vh',
        color: darkMode ? '#CCCCCC' : '#000000',
      }}
    >
      <div style={{ padding: '16px' }}>
        {isLoading ? (
          <div className={loadingOverlayStyles}>
            <VscodeProgressRing />
            <span style={{ color: darkMode ? '#888' : '#666' }}>
              Loading documents...
            </span>
          </div>
        ) : (
          <>HELLO THERE! We have {documents.length} documents.</>
        )}
      </div>
    </div>
  );
};

export default PreviewApp;
