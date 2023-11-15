import * as React from 'react';
import CompassConnectionForm from '@mongodb-js/connection-form';
import type { ConnectionInfo } from '@mongodb-js/connection-storage/renderer';
import { v4 as uuidv4 } from 'uuid';

function createNewConnectionInfo(): ConnectionInfo {
  return {
    id: uuidv4(),
    connectionOptions: {
      connectionString: 'mongodb://localhost:27017',
    },
  };
}

const initialConnectionInfo = createNewConnectionInfo();

function ConnectionForm() {
  return (
    <div>
      <CompassConnectionForm
        onConnectClicked={(connectionInfo) => {
          // void connect({
          //   ...cloneDeep(connectionInfo),
          // })
          // TODO:

          console.log('todo');
          console.log('connect', connectionInfo);

          alert('test');
        }}
        initialConnectionInfo={initialConnectionInfo}
      />
    </div>
  );
}

export { ConnectionForm };
export default ConnectionForm;
