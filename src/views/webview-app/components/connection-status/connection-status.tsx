import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  CreateNewPlaygroundAction
} from '../../store/actions';
import InfoSprinkle from '../info-sprinkle/info-sprinkle';

const styles = require('./connection-status.less');

type DispatchProps = {
  onClickCreatePlayground: () => void;
};

class ConnectionStatus extends React.Component<DispatchProps> {
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
              Create a playground.<InfoSprinkle linkTo="https://docs.mongodb.com/mongodb-vscode/playgrounds" />
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

const mapDispatchToProps: DispatchProps = {
  onClickCreatePlayground: (): CreateNewPlaygroundAction => ({
    type: ActionTypes.CREATE_NEW_PLAYGROUND
  })
};

export default connect(() => ({}), mapDispatchToProps)(ConnectionStatus);

