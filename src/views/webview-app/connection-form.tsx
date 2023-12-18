import React from 'react';
import CompassConnectionForm from '@mongodb-js/connection-form';
import { Modal, css, spacing } from '@mongodb-js/compass-components';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionInfo } from 'mongodb-data-service-legacy';

const modalContentStyles = css({
  // Override LeafyGreen width to accommodate the strict connection-form size.
  width: `${spacing[6] * 12}px !important`,
});

const formContainerStyles = css({
  padding: spacing[3],
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
});

function createNewConnectionInfo() {
  return {
    id: uuidv4(),
    connectionOptions: {
      connectionString: 'mongodb://localhost:27017',
    },
  };
}

const initialConnectionInfo = createNewConnectionInfo();

const ConnectionForm: React.FunctionComponent<{
  onConnectClicked: (onConnectClicked: ConnectionInfo) => void;
  onClose: () => void;
  open: boolean;
  connectionErrorMessage: string;
}> = ({ connectionErrorMessage, onConnectClicked, onClose, open }) => {
  return (
    <Modal
      // Warning: This property may be removed in future
      // modal releases.
      contentClassName={modalContentStyles}
      setOpen={() => onClose()}
      open={open}
      data-testid="connection-form-modal"
      size="large"
    >
      <div className={formContainerStyles}>
        <CompassConnectionForm
          onConnectClicked={onConnectClicked}
          initialConnectionInfo={initialConnectionInfo}
          preferences={{
            protectConnectionStrings: false,
            forceConnectionOptions: [],
            showKerberosPasswordField: false,
            showOIDCDeviceAuthFlow: false,
            enableOidc: true,
            enableDebugUseCsfleSchemaMap: false,
            protectConnectionStringsForNewConnections: false,
            showOIDCAuth: true,
            showKerberosAuth: false,
            showCSFLE: false,
          }}
          connectionErrorMessage={connectionErrorMessage}
        />
      </div>
    </Modal>
  );
};

export { ConnectionForm };
