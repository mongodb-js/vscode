import * as React from 'react';
import classnames from 'classnames';

const styles = require('../connect.module.less');

import ConnectionForm from './connect-form/connection-form';
import HelpPanel from './help-panel/help-panel';

type props = {
  currentConnection: any;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isHostChanged: boolean;
  isPortChanged: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

export default class App extends React.Component<props> {
  render(): React.ReactNode {
    const {
      currentConnection,
      errorMessage,
      isConnected,
      isConnecting,
      isHostChanged,
      isPortChanged,
      isValid,
      syntaxErrorMessage
    } = this.props;

    return (
      <div className={classnames(styles.page, styles.connect)}>
        <div>
          <h1>Connect to MongoDB</h1>

          <ConnectionForm
            currentConnection={currentConnection}
            errorMessage={errorMessage}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isHostChanged={isHostChanged}
            isPortChanged={isPortChanged}
            isValid={isValid}
            syntaxErrorMessage={syntaxErrorMessage}
          />
        </div>
        <HelpPanel />
      </div>
    );
  }
}
