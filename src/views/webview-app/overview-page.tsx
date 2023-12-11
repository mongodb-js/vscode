import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  HorizontalRule,
  SpinLoaderWithLabel,
  css,
  resetGlobalCSS,
  spacing,
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

const loadingContainerStyles = css({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1,
});

const OverviewPage: React.FC = () => {
  const [showResourcesPanel, setShowResourcesPanel] = useState(false);
  const {
    connectionInProgress,
    connectionFormOpened,
    openConnectionForm,
    closeConnectionForm,
    connectionErrorMessage,
    handleConnectClicked,
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

  return (
    <div className={pageStyles}>
      {connectionInProgress && (
        <div className={loadingContainerStyles}>
          <SpinLoaderWithLabel progressText="Connecting..." />
        </div>
      )}
      {showResourcesPanel && (
        <ResourcesPanel onClose={handleResourcesPanelClose} />
      )}
      {connectionFormOpened && (
        <ConnectionForm
          onConnectClicked={handleConnectClicked}
          onClose={closeConnectionForm}
          open={connectionFormOpened}
          connectionErrorMessage={connectionErrorMessage}
        />
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
