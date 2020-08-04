import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';
import {
  ActionTypes,
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes
} from '../store/actions';
import {
  MESSAGE_TYPES,
  ConnectResultsMessage,
  FilePickerResultsMessage
} from '../extension-app-message-constants';

const styles = require('../connect.module.less');

type props = {
  onConnectedEvent: (
    successfullyConnected: boolean,
    connectionMessage: string
  ) => void;
  onFilePickerEvent: (
    action: FilePickerActionTypes,
    files: string[] | undefined
  ) => void;
};

class App extends React.Component<props> {
  componentDidMount(): void {
    window.addEventListener('message', (event) => {
      const message: ConnectResultsMessage | FilePickerResultsMessage =
        event.data;

      switch (message.command) {
        case MESSAGE_TYPES.CONNECT_RESULT:
          this.props.onConnectedEvent(
            message.connectionSuccess,
            message.connectionMessage
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
    return (
      <div className={classnames(styles.page, styles.connect)}>
        <ConnectionForm />
        <HelpPanel />
      </div>
    );
  }
}

const mapDispatchToProps: props = {
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
  })
};

export default connect(null, mapDispatchToProps)(App);
