import React from 'react';
import { getFeatureFlag } from '../../featureFlags';
import LegacyApp from './legacy/app-with-store';
import OverviewPage from './overview-page';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';

const App: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();

  return true || getFeatureFlag('useNewConnectionForm') ? (
    <LeafyGreenProvider darkMode={darkMode}>
      <OverviewPage />
    </LeafyGreenProvider>
  ) : (
    <LegacyApp />
  );
};

export default App;
