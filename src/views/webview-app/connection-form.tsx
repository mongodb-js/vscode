import React from 'react';
import type { ComponentProps } from 'react';
import CompassConnectionForm from '@mongodb-js/connection-form';
import {
  CancelLoader,
  Modal,
  css,
  cx,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import { VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID } from './extension-app-message-constants';

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

const ConnectionForm: React.FunctionComponent<
  {
    isConnecting: boolean;
    onCancelConnectClicked: () => void;
    onClose: () => void;
    open: boolean;
    connectionErrorMessage: string;
  } & Pick<
    ComponentProps<typeof CompassConnectionForm>,
    'onConnectClicked' | 'onSaveClicked' | 'initialConnectionInfo'
  >
> = ({
  initialConnectionInfo,
  connectionErrorMessage,
  isConnecting,
  onCancelConnectClicked,
  onConnectClicked,
  onClose,
  onSaveClicked,
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
          onSaveClicked={onSaveClicked}
          initialConnectionInfo={initialConnectionInfo}
          preferences={{
            showFavoriteActions: false,
            protectConnectionStrings: false,
            forceConnectionOptions: [],
            showKerberosPasswordField: false,
            showOIDCDeviceAuthFlow:
              window[VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID],
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
