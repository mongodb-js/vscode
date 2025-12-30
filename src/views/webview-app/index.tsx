import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import type { WebviewType } from '../../utils/webviewHelpers';

// Lazy load the page components to keep initial bundle small
const OverviewPage = lazy(() => import('./overview-page'));
const PreviewPage = lazy(() => import('../data-browsing-app/preview-page'));

// Extension sets this before loading the script via webviewHelpers.ts
declare global {
  interface Window {
    WEBVIEW_TYPE: WebviewType;
  }
}

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const viewType = window.WEBVIEW_TYPE;

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <Suspense fallback={<div>Loading...</div>}>
        {viewType === 'connection' && <OverviewPage />}
        {viewType === 'dataBrowser' && <PreviewPage />}
      </Suspense>
    </LeafyGreenProvider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
