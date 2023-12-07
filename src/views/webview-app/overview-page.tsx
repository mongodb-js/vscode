import React, { useCallback, useState } from 'react';
import { HorizontalRule, css, spacing } from '@mongodb-js/compass-components';
import OverviewHeader from './overview-header';
import ConnectionStatus from './connection-status';
import ConnectHelper from './connect-helper';
import AtlasCta from './atlas-cta';
import ResourcesPanel from './resources-panel/panel';
import { ConnectionForm } from './connection-form';

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
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const handleResourcesPanelClose = useCallback(
    () => setShowResourcesPanel(false),
    []
  );
  const handleResourcesClick = useCallback(
    () => setShowResourcesPanel(true),
    []
  );
  return (
    <div className={pageStyles}>
      {showResourcesPanel && (
        <ResourcesPanel onClose={handleResourcesPanelClose} />
      )}
      {showConnectionForm && (
        <ConnectionForm
          onConnectClicked={(connectionInfo) => {
            // TODO(VSCODE-489): Type connection form and post message to the webview controller.
            // Maintain connecting status.
            console.log('connect', connectionInfo);
          }}
          onClose={() => setShowConnectionForm(false)}
          open={showConnectionForm}
        />
      )}
      <OverviewHeader onResourcesClick={handleResourcesClick} />
      <HorizontalRule />
      <ConnectionStatus />
      <ConnectHelper
        onClickOpenConnectionForm={() => setShowConnectionForm(true)}
      />
      <AtlasCta />
    </div>
  );
};

export default OverviewPage;
