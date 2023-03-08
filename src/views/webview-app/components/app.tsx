import * as React from 'react';
import { connect } from 'react-redux';

import OverviewPage from './overview-page/overview-page';
import {
  ActionTypes,
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes,
  SetConnectionStatusAction,
} from '../store/actions';
import {
  CONNECTION_STATUS,
  MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
  MESSAGE_TYPES,
} from '../extension-app-message-constants';
import { App as AICodeApp } from '../ai-code/app';

const styles = require('../connect.module.less');

import './app.less';

type DispatchProps = {
  onConnectedEvent: (
    connectionAttemptId: string,
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

export class App extends React.Component<DispatchProps> {
  componentDidMount(): void {
    window.addEventListener('message', this.handleMessageFromExtension);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.handleMessageFromExtension);
  }

  handleMessageFromExtension = (event) => {
    const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;

    switch (message.command) {
      case MESSAGE_TYPES.CONNECT_RESULT:
        this.props.onConnectedEvent(
          message.connectionAttemptId,
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
  };

  render(): React.ReactNode {
    if ((window as any)?.isSidepanel) {
      return (
        <div>
          {/* sidepanel view ! */}
          <AICodeApp />
        </div>
      );
    }

    return (
      <div className={styles.page}>
        <OverviewPage />
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onConnectedEvent: (
    connectionAttemptId: string,
    successfullyConnected: boolean,
    connectionMessage: string
  ): ConnectionEventOccuredAction => ({
    type: ActionTypes.CONNECTION_EVENT_OCCURED,
    connectionAttemptId,
    successfullyConnected,
    connectionMessage,
  }),
  onFilePickerEvent: (
    action: FilePickerActionTypes,
    files: string[] | undefined
  ): FilePickerActions => ({
    type: action,
    files,
  }),
  setConnectionStatus: (
    connectionStatus: CONNECTION_STATUS,
    activeConnectionName: string
  ): SetConnectionStatusAction => ({
    type: ActionTypes.SET_CONNECTION_STATUS,
    activeConnectionName,
    connectionStatus,
  }),
};

export default connect(null, mapDispatchToProps)(App);
