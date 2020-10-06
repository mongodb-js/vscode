import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  CreateNewPlaygroundAction
} from '../../store/actions';

const styles = require('./connection-status.less');

type dispatchProps = {
  onClickCreatePlayground: () => void;
};

class ConnectionStatus extends React.Component<dispatchProps> {
  render(): React.ReactNode {
    const { onClickCreatePlayground } = this.props;

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
          <button
            className={styles['connection-status-create-playground-button']}
            onClick={(): void => onClickCreatePlayground()}
          >
            Create playground
          </button>
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
  onClickCreatePlayground: (): CreateNewPlaygroundAction => ({
    type: ActionTypes.CREATE_NEW_PLAYGROUND
  })
};

export default connect(() => ({}), mapDispatchToProps)(ConnectionStatus);

