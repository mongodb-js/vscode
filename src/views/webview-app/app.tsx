import React from 'react';
import OverviewPage from './overview-page';
import PreviewPage from '../data-browsing-app/preview-page';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import type { WebviewType } from '../../utils/webviewHelpers';

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
      {webviewType === 'dataBrowser' ? <PreviewPage /> : <OverviewPage />}
    </LeafyGreenProvider>
  );
};

export default App;
