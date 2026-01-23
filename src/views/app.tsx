import React, { lazy, Suspense } from 'react';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { VscodeProgressRing } from '@vscode-elements/react-elements';
import { useDetectVsCodeDarkMode } from './webview-app/use-detect-vscode-dark-mode';
import type { WebviewType } from '../utils/webviewHelpers';
import { Provider } from 'react-redux';
import { store } from './data-browsing-app/store';

// Use lazy loading to avoid loading both vscode-api modules at once.
// Each vscode-api.ts calls acquireVsCodeApi() at module load time,
// and acquireVsCodeApi() can only be called once per webview.
const OverviewPage = lazy(() => import('./webview-app/overview-page'));
const PreviewPage = lazy(() => import('./data-browsing-app/preview-page'));

declare global {
  interface Window {
    WEBVIEW_TYPE: WebviewType;
  }
}

const PreviewPageWithProvider: React.FC = () => {
  return (
    <Provider store={store}>
      <PreviewPage />
    </Provider>
  );
};

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const webviewType = window.WEBVIEW_TYPE;

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <Suspense fallback={<VscodeProgressRing />}>
        {webviewType === 'dataBrowser' ? (
          <PreviewPageWithProvider />
        ) : (
          <OverviewPage />
        )}
      </Suspense>
    </LeafyGreenProvider>
  );
};

export default App;
