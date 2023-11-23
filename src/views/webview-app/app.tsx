import React, { useEffect, useState } from 'react';
import type { FeatureFlags } from '../../featureFlags';
import { vscode } from './vscode-api';
import {
  type MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
  MESSAGE_TYPES,
} from './extension-app-message-constants';
import LegacyApp from './legacy/app-with-store';

const App: React.FC = () => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    useNewConnectionForm: false,
  });
  useEffect(() => {
    const handleFeatureFlagResponse = (event: any) => {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;
      if (message.command === MESSAGE_TYPES.FEATURE_FLAGS_RESULTS) {
        setFeatureFlags(message.featureFlags);
      }
    };

    window.addEventListener('message', handleFeatureFlagResponse);
    vscode.postMessage({ command: MESSAGE_TYPES.GET_FEATURE_FLAGS });
    return () =>
      window.removeEventListener('message', handleFeatureFlagResponse);
  }, []);

  return featureFlags.useNewConnectionForm ? (
    <>Silence is golden</>
  ) : (
    <LegacyApp />
  );
};

export default App;
