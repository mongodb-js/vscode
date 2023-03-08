import React, { useEffect } from 'react';
import LeafyGreenProvider from '@leafygreen-ui/leafygreen-provider';
import { Provider } from 'react-redux';

import { store } from './store/store';
import { Root } from './routes/root';
import { handleMessageFromExtension } from './extension-app-msg';

const App: React.FunctionComponent = () => {
  useEffect(() => {
    window.addEventListener('message', handleMessageFromExtension);

    return () => {
      window.removeEventListener('message', handleMessageFromExtension);
    };
  }, []);

  return (
    <LeafyGreenProvider darkMode>
      <Provider store={store}>
        <Root />
      </Provider>
    </LeafyGreenProvider>
  );
};

export { App };
