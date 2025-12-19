import React from 'react';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import PreviewPage from './preview-page';

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <PreviewPage />
    </LeafyGreenProvider>
  );
};

export default App;
