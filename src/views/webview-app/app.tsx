import React from 'react';
import OverviewPage from './overview-page';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <OverviewPage />
    </LeafyGreenProvider>
  );
};

export default App;
