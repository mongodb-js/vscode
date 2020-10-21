import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import { AppState } from '../../store/store';
import {
  ActionTypes,
  CreateNewPlaygroundAction,
  RenameConnectionAction,
  RequestConnectionStatusAction
} from '../../store/actions';
import InfoSprinkle from '../info-sprinkle/info-sprinkle';
import { CONNECTION_STATUS } from '../../extension-app-message-constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt } from '@fortawesome/free-solid-svg-icons';

const styles = require('./connection-status.less');

const CONNECTION_STATUS_POLLING_FREQ_MS = 1000;

type StateProps = {
  activeConnectionName: string;
  connectionStatus: CONNECTION_STATUS;
};

type DispatchProps = {
  onClickCreatePlayground: () => void;
  onClickRenameConnection: () => void;
  requestConnectionStatus: () => void;
};

export class ConnectionStatus extends React.Component<StateProps & DispatchProps> {
  componentDidMount(): void {
    this.startConnectionStatusPolling();
  }

  componentWillUnmount(): void {
    this.stopConnectionStatusPolling();
  }

  connectionStatusPollingInterval: null | number = null;

  startConnectionStatusPolling = (): void => {
    if (this.connectionStatusPollingInterval !== null) {
      return;
    }

    this.props.requestConnectionStatus();
    this.connectionStatusPollingInterval = setInterval(() => {
      this.props.requestConnectionStatus();
    }, CONNECTION_STATUS_POLLING_FREQ_MS) as any;
  };

  stopConnectionStatusPolling = (): void => {
    if (this.connectionStatusPollingInterval === null) {
      return;
    }

    clearInterval(this.connectionStatusPollingInterval);

    this.connectionStatusPollingInterval = null;
  };

  renderConnectedStatus(): React.ReactNode {
    const {
      activeConnectionName,
      onClickCreatePlayground,
      onClickRenameConnection
    } = this.props;

    return (
      <React.Fragment>
        <div className={styles['connection-status-status-message']}>
          <span className={classnames(
            styles['connection-status-dot'],
            styles['connection-status-dot-connected']
          )}/>Connected to: <strong>{activeConnectionName}</strong>
          <button
            className={styles['connection-status-rename']}
            onClick={(): void => onClickRenameConnection()}
          >
            <FontAwesomeIcon
              icon={faPencilAlt}
            />
          </button>
        </div>
        <div className={styles['connection-status-playground-area']}>
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
      </React.Fragment>
    );
  }

  renderConnectingStatus(): React.ReactNode {
    return (
      <React.Fragment>
        <div className={styles['connection-status-status-message']}>
          Connecting...
        </div>
      </React.Fragment>
    );
  }

  renderDisconnectedStatus(): React.ReactNode {
    return (
      <div className={styles['connection-status-status-message']}>
        <span className={classnames(
          styles['connection-status-dot'],
          styles['connection-status-dot-disconnected']
        )}/>Not connected.
      </div>
    );
  }

  renderDisconnectingStatus(): React.ReactNode {
    return (
      <div className={styles['connection-status-status-message']}>
        Disconnecting...
      </div>
    );
  }

  renderLoadingStatus(): React.ReactNode {
    return (
      <div className={styles['connection-status-status-message']}>
        Loading...
      </div>
    );
  }

  render(): React.ReactNode {
    const {
      connectionStatus
    } = this.props;

    return (
      <div className={styles['connection-status']}>
        {connectionStatus === CONNECTION_STATUS.CONNECTED && this.renderConnectedStatus()}
        {connectionStatus === CONNECTION_STATUS.CONNECTING && this.renderConnectingStatus()}
        {connectionStatus === CONNECTION_STATUS.DISCONNECTED && this.renderDisconnectedStatus()}
        {connectionStatus === CONNECTION_STATUS.DISCONNECTING && this.renderDisconnectingStatus()}
        {connectionStatus === CONNECTION_STATUS.LOADING && this.renderLoadingStatus()}
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    activeConnectionName: state.activeConnectionName,
    connectionStatus: state.connectionStatus
  };
};

const mapDispatchToProps: DispatchProps = {
  onClickCreatePlayground: (): CreateNewPlaygroundAction => ({
    type: ActionTypes.CREATE_NEW_PLAYGROUND
  }),
  onClickRenameConnection: (): RenameConnectionAction => ({
    type: ActionTypes.RENAME_CONNECTION
  }),
  requestConnectionStatus: (): RequestConnectionStatusAction => ({
    type: ActionTypes.REQUEST_CONNECTION_STATUS
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionStatus);

