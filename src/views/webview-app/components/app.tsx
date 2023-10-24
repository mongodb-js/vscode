import * as React from 'react';
import { connect } from 'react-redux';
import OverviewPage from './overview-page/overview-page';
import MockDataGenerator from './mock-data-generator/mock-data-generator';
import type { AppState } from '../store/store';
import type {
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes,
  SetConnectionStatusAction,
  OpenMockDataGeneratorAction

} from '../store/actions';
import { ActionTypes } from '../store/actions';
import type {
  CONNECTION_STATUS,
  MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
} from '../extension-app-message-constants';
import { MESSAGE_TYPES } from '../extension-app-message-constants';

import styles from '../connect.module.less';

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
  openMockDataGenerator: (
    openMockDataGenerator: MESSAGE_TYPES.OPEN_MOCK_DATA_GENERATOR
  ) => void;
};

type StateProps = {
  showMockDataGenerator: boolean;
};

type CombinedProps = StateProps & DispatchProps;

export class App extends React.Component<CombinedProps> {
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
      case MESSAGE_TYPES.OPEN_MOCK_DATA_GENERATOR:
        this.props.openMockDataGenerator(MESSAGE_TYPES.OPEN_MOCK_DATA_GENERATOR);
        return;
      default:
        // No-op.
        return;
    }
  };

  render(): React.ReactNode {
    const { showMockDataGenerator } = this.props;
    return (
      <div className={styles.page}>
        { showMockDataGenerator && <MockDataGenerator />}
        { !showMockDataGenerator && <OverviewPage />}
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
  openMockDataGenerator: (
  ): OpenMockDataGeneratorAction => ({
    type: ActionTypes.OPEN_MOCK_DATA_GENERATOR
  }),
};

const mapStateToProps = (state: AppState): StateProps => {
  return {
    showMockDataGenerator: state.showMockDataGenerator,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
