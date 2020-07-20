import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import ChangeStreamViewer from './change-stream/change-stream-viewer';
import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';
import {
  ActionTypes,
  ChangeStreamEventOccuredAction,
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes
} from '../store/actions';
import {
  MESSAGE_TYPES,
  WEBVIEWS,
  WEBVIEW_TYPE_GLOBAL_ID,
  ChangeStreamEventMessage,
  ConnectResultsMessage,
  FilePickerResultsMessage
} from '../extension-app-message-constants';

const styles = require('../connect.module.less');

type props = {
  onChangeStreamEvent: (
    changeStreamEvent: any
  ) => void;
  onConnectedEvent: (
    successfullyConnected: boolean,
    connectionMessage: string
  ) => void;
  onFilePickerEvent: (
    action: FilePickerActionTypes,
    files: string[] | undefined
  ) => void;
};

type MessageFromExtension = ConnectResultsMessage | FilePickerResultsMessage | ChangeStreamEventMessage;

class App extends React.Component<props> {
  componentDidMount(): void {
    window.addEventListener('message', (event) => {
      const message: MessageFromExtension = event.data;

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
        case MESSAGE_TYPES.CHANGE_STREAM_EVENT:
          this.props.onChangeStreamEvent(message.changeStreamEvent);
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
        {global[WEBVIEW_TYPE_GLOBAL_ID] === WEBVIEWS.CONNECT && (
          <React.Fragment>
            <ConnectionForm />
            <HelpPanel />
          </React.Fragment>
        )}
        {global[WEBVIEW_TYPE_GLOBAL_ID] === WEBVIEWS.CHANGE_STREAM && (
          <React.Fragment>
            <ChangeStreamViewer />
          </React.Fragment>
        )}
      </div>
    );
  }
}

const mapDispatchToProps: props = {
  onChangeStreamEvent: (changeStreamEvent: any): ChangeStreamEventOccuredAction => ({
    type: ActionTypes.CHANGE_STREAM_EVENT_OCCURED,
    changeStreamEvent
  }),
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
