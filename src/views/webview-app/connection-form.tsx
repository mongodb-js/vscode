import React from 'react';
import CompassConnectionForm from '@mongodb-js/connection-form';
import {
  CancelLoader,
  Modal,
  css,
  cx,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
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

const connectingContainerStyles = css({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  background: 'rgba(255, 255, 255, 0.8)',
  borderRadius: spacing[4],
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1,
});

const connectingContainerDarkModeStyles = css({
  background: 'rgba(0, 0, 0, 0.8)',
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
  isConnecting: boolean;
  onCancelConnectClicked: () => void;
  onConnectClicked: (connectionInfo: ConnectionInfo) => void;
  onClose: () => void;
  open: boolean;
  connectionErrorMessage: string;
}> = ({
  connectionErrorMessage,
  isConnecting,
  onCancelConnectClicked,
  onConnectClicked,
  onClose,
  open,
}) => {
  const darkMode = useDarkMode();

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
      {isConnecting && (
        <div
          className={cx(
            connectingContainerStyles,
            darkMode && connectingContainerDarkModeStyles
          )}
        >
          <CancelLoader
            onCancel={onCancelConnectClicked}
            progressText="Connecting…"
            cancelText="Cancel"
          />
        </div>
      )}
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
