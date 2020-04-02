import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';
import { ActionTypes, ConnectionEventOccuredAction } from '../store/actions';

const styles = require('../connect.module.less');

type props = {
  onConnectedEvent: (
    successfullyConnected: boolean,
    connectionMessage: string
  ) => void;
};

class App extends React.Component<props> {
  componentDidMount(): void {
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        default:
          // No-op.
          return;
        case 'connectResult':
          this.props.onConnectedEvent(
            message.connectionSuccess,
            message.connectionMessage
          );
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
  })
};

export default connect(null, mapDispatchToProps)(App);
