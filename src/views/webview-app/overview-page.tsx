import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  HorizontalRule,
  css,
  resetGlobalCSS,
  spacing,
  // FileInputBackendProvider,
  // createElectronFileInputBackend,
} from '@mongodb-js/compass-components';

import OverviewHeader from './overview-header';
import ConnectionStatus from './connection-status';
import ConnectHelper from './connect-helper';
import AtlasCta from './atlas-cta';
import ResourcesPanel from './resources-panel/panel';
import { ConnectionForm } from './connection-form';
import useConnectionForm from './use-connection-form';

const pageStyles = css({
  width: '90%',
  minWidth: '500px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  padding: spacing[3],
  gap: spacing[4],
  alignItems: 'center',
  textAlign: 'center',
  fontSize: '14px',
});

const OverviewPage: React.FC = () => {
  const [showResourcesPanel, setShowResourcesPanel] = useState(false);
  const {
    initialConnectionInfo,
    isConnecting,
    isConnectionFormOpen,
    openConnectionForm,
    closeConnectionForm,
    connectionErrorMessage,
    handleCancelConnectClicked,
    handleSaveConnectionClicked,
    handleConnectClicked,
    // dialog,
  } = useConnectionForm();
  const handleResourcesPanelClose = useCallback(
    () => setShowResourcesPanel(false),
    []
  );
  const handleResourcesClick = useCallback(
    () => setShowResourcesPanel(true),
    []
  );

  useLayoutEffect(() => {
    // TODO(VSCODE-490): Move this reset css call to the top level entry point
    // of the app and out of the react lifecycle.
    resetGlobalCSS();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const util = require('util');
  console.log('(globalThis as any).vscode----------------------');
  console.log(`${util.inspect((globalThis as any).vscode)}`);
  console.log('----------------------');

  return (
    <div data-testid="overview-page" className={pageStyles}>
      {showResourcesPanel && (
        <ResourcesPanel onClose={handleResourcesPanelClose} />
      )}
      {isConnectionFormOpen && (
        // <FileInputBackendProvider createFileInputBackend={createElectronFileInputBackend(dialog, (globalThis as any).vscode?.webUtils)}>
        <ConnectionForm
          isConnecting={isConnecting}
          initialConnectionInfo={initialConnectionInfo}
          onSaveAndConnectClicked={({ id, connectionOptions }) => {
            void handleSaveConnectionClicked({
              id,
              connectionOptions,
            });
            handleConnectClicked({
              id,
              connectionOptions,
            });
          }}
          onCancelConnectClicked={handleCancelConnectClicked}
          onClose={closeConnectionForm}
          open={isConnectionFormOpen}
          connectionErrorMessage={connectionErrorMessage}
        />
        // </FileInputBackendProvider>
      )}
      <OverviewHeader onResourcesClick={handleResourcesClick} />
      <HorizontalRule />
      <ConnectionStatus />
      <ConnectHelper onClickOpenConnectionForm={openConnectionForm} />
      <AtlasCta />
    </div>
  );
};

export default OverviewPage;
