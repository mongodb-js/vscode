import React, { lazy, Suspense } from 'react';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { VscodeProgressRing } from '@vscode-elements/react-elements';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import type { WebviewType } from '../../utils/webviewHelpers';

// Use lazy loading to avoid loading both vscode-api modules at once.
// Each vscode-api.ts calls acquireVsCodeApi() at module load time,
// and acquireVsCodeApi() can only be called once per webview.
const OverviewPage = lazy(() => import('./overview-page'));
const PreviewPage = lazy(() => import('../data-browsing-app/preview-page'));

declare global {
  interface Window {
    WEBVIEW_TYPE: WebviewType;
  }
}

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const webviewType = window.WEBVIEW_TYPE;

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <Suspense fallback={<VscodeProgressRing />}>
        {webviewType === 'dataBrowser' ? <PreviewPage /> : <OverviewPage />}
      </Suspense>
    </LeafyGreenProvider>
  );
};

export default App;
