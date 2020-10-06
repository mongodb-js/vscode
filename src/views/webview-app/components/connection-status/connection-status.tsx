import * as React from 'react';
import Button from '@leafygreen-ui/button';

const styles = require('./connection-status.less');

class ConnectionStatus extends React.Component {
  render(): React.ReactNode {
    return (
      <div className={styles['connection-status']}>
        <div className={styles['connection-status-status-message']}>
          Connection Status - coming soon.
        </div>
        <div>
          <div className={styles['connection-status-playground-message']}>
            <div>
              All set. Ready to start?
            </div>
            <div>
              Create a Playground.
            </div>
          </div>
          <div className={styles['connection-status-playground-button']}>
            <Button
              variant="primary"
              className="connection-status-create-playground-button"
            >
              Create playground
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ConnectionStatus;
