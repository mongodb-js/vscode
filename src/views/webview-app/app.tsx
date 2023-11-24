import React from 'react';
import { getFeatureFlag } from '../../featureFlags';
import LegacyApp from './legacy/app-with-store';

const App: React.FC = () => {
  return getFeatureFlag('useNewConnectionForm') ? (
    <>Silence is golden</>
  ) : (
    <LegacyApp />
  );
};

export default App;
