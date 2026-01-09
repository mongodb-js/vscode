import React, { useEffect, useState, useRef } from 'react';
import {
  Icon,
  css,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import {
  MessageFromExtensionToWebview,
  PreviewMessageType,
} from './extension-app-message-constants';
import {
  sendGetDocuments,
} from './vscode-api';

interface PreviewDocument {
  [key: string]: unknown;
}
const spinnerKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const loadingOverlayStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[600],
  flexDirection: 'column',
  gap: spacing[300],
});

const spinnerStyles = css({
  animation: 'spin 1s linear infinite',
});

const PreviewApp: React.FC = () => {
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const darkMode = useDarkMode();
    const [isLoading, setIsLoading] = useState(true);

  // Track when loading started for minimum loading duration
  const loadingStartTimeRef = useRef<number>(Date.now());
  const MIN_LOADING_DURATION_MS = 500;

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === PreviewMessageType.loadDocuments) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Ensure minimum loading duration before hiding loader
        setTimeout(() => {
          setDocuments(message.documents || []);
               setIsLoading(false);
        }, remainingTime);
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
        {/* Inject keyframes for spinner animation */}
        <style>{spinnerKeyframes}</style>

        {isLoading ? (
          <div className={loadingOverlayStyles}>
            <span className={spinnerStyles}>
              <Icon glyph="Refresh" size="large" />
            </span>
            <span style={{ color: darkMode ? '#888' : '#666' }}>
              Loading documents...
            </span>
          </div>
        ) : (
          <>
             HELLO THERE! We have {documents.length} documents.
          </>
        )}
      </div>
    </div>

  );
};

export default PreviewApp;
