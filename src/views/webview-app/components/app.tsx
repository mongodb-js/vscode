import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';
import OverviewPage from './overview-page/overview-page';
import {
  ActionTypes,
  ConnectionEventOccuredAction,
  FilePickerActions,
  FilePickerActionTypes
} from '../store/actions';
import { AppState } from '../store/store';
import {
  MESSAGE_TYPES,
  ConnectResultsMessage,
  FilePickerResultsMessage,
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
};

class App extends React.Component<DispatchProps& StateProps> {
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
    const { currentView } = this.props;

    return (
      <div className={styles.page}>
        {currentView === WEBVIEW_VIEWS.CONNECT && (
          <div className={styles.connect}>
            <ConnectionForm />
            <div className={classnames(styles['connect-form-help-panel'])}>
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
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
