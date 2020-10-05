import * as React from 'react';

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
              All Set. Ready to start?
            </div>
            <div>
              Create a Playground.
            </div>
          </div>
          <div className={styles['connection-status-playground-button']}>
            <button>
              Create playground
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ConnectionStatus;
