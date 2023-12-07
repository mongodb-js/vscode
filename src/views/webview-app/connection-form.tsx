import React from 'react';
import CompassConnectionForm from '@mongodb-js/connection-form';
import { Modal, ModalBody, css, spacing } from '@mongodb-js/compass-components';
import { v4 as uuidv4 } from 'uuid';

const modalContentStyles = css({
  // Override LeafyGreen width to accommodate the strict connection-form size.
  width: `${spacing[6] * 12}px !important`,
});

const formContainerStyles = css({
  padding: spacing[1],
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
  onConnectClicked: (onConnectClicked: unknown) => void;
  onClose: () => void;
  open: boolean;
}> = ({ onConnectClicked, onClose, open }) => {
  return (
    <>
      <Modal
        // Warning: This property may be removed in future
        // modal releases.
        contentClassName={modalContentStyles}
        setOpen={() => onClose()}
        open={open}
        data-testid="connection-form-modal"
        size="large"
      >
        <ModalBody>
          <div className={formContainerStyles}>
            <CompassConnectionForm
              onConnectClicked={onConnectClicked}
              initialConnectionInfo={initialConnectionInfo}
              preferences={{
                protectConnectionStrings: false,
                forceConnectionOptions: [],
                showKerberosPasswordField: false,
                showOIDCDeviceAuthFlow: false,
                enableOidc: false,
                enableDebugUseCsfleSchemaMap: false,
                protectConnectionStringsForNewConnections: false,
                showOIDCAuth: false,
                showKerberosAuth: false,
                showCSFLE: false,
              }}
            />
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export { ConnectionForm };
