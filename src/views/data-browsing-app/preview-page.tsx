import React, { useEffect, useState } from 'react';
import {
  VscodeFormContainer,
  VscodeLabel,
  VscodeProgressRing,
} from '@vscode-elements/react-elements';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import { PreviewMessageType } from './extension-app-message-constants';
import { sendGetDocuments } from './vscode-api';

interface PreviewDocument {
  [key: string]: unknown;
}

const PreviewApp: React.FC = () => {
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
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
    <VscodeFormContainer>
      {isLoading ? (
        <>
          <VscodeProgressRing />
          <VscodeLabel>Loading documents...</VscodeLabel>
        </>
      ) : (
        <VscodeLabel>HELLO THERE! We have {documents.length} documents.</VscodeLabel>
      )}
    </VscodeFormContainer>
  );
};

export default PreviewApp;
