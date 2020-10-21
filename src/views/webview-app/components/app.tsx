import * as React from 'react';
import { connect } from 'react-redux';

import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';
import OverviewPage from './overview-page/overview-page';
import {
  ActionTypes,
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes,
  SetConnectionStatusAction
} from '../store/actions';
import { AppState } from '../store/store';
import {
  CONNECTION_STATUS,
  MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
  MESSAGE_TYPES,
  WEBVIEW_VIEWS
} from '../extension-app-message-constants';

const styles = require('../connect.module.less');

type StateProps = {
  currentView: WEBVIEW_VIEWS;
};

type DispatchProps = {
  onConnectedEvent: (
    successfullyConnected: boolean,
    connectionMessage: string
  ) => void;
  onFilePickerEvent: (
    action: FilePickerActionTypes,
    files: string[] | undefined
  ) => void;
  setConnectionStatus: (
    connectionStatus: CONNECTION_STATUS,
    activeConnectionName: string
  ) => void;
};

export class App extends React.Component<DispatchProps & StateProps> {
  componentDidMount(): void {
    window.addEventListener('message', (event) => {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;

      switch (message.command) {
        case MESSAGE_TYPES.CONNECT_RESULT:
          this.props.onConnectedEvent(
            message.connectionSuccess,
            message.connectionMessage
          );

          return;
        case MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE:
          this.props.setConnectionStatus(
            message.connectionStatus,
            message.activeConnectionName
          );

          return;
        case MESSAGE_TYPES.FILE_PICKER_RESULTS:
          this.props.onFilePickerEvent(message.action, message.files);
          return;
        default:
          // No-op.
          return;
      }
    });
  }

  render(): React.ReactNode {
    const { currentView } = this.props;

    return (
      <div className={styles.page}>
        {currentView === WEBVIEW_VIEWS.CONNECT && (
          <div className={styles.connect}>
            <ConnectionForm />
            <div className={styles['connect-form-help-panel']}>
              <HelpPanel />
            </div>
          </div>
        )}
        {currentView === WEBVIEW_VIEWS.OVERVIEW && <OverviewPage />}
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    currentView: state.currentView
  };
};

const mapDispatchToProps: DispatchProps = {
  onConnectedEvent: (
    successfullyConnected: boolean,
    connectionMessage: string
  ): ConnectionEventOccuredAction => ({
    type: ActionTypes.CONNECTION_EVENT_OCCURED,
    successfullyConnected,
    connectionMessage
  }),
  onFilePickerEvent: (
    action: FilePickerActionTypes,
    files: string[] | undefined
  ): FilePickerActions => ({
    type: action,
    files
  }),
  setConnectionStatus: (
    connectionStatus: CONNECTION_STATUS,
    activeConnectionName: string
  ): SetConnectionStatusAction => ({
    type: ActionTypes.SET_CONNECTION_STATUS,
    activeConnectionName,
    connectionStatus
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
