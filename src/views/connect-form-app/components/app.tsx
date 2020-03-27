import * as React from 'react';
import classnames from 'classnames';

const styles = require('../connect.module.less');

import ConnectionForm from './connect-form/connection-form';

export default class App extends React.Component {
  render(): React.ReactNode {
    console.log('styles in app', styles);

    return (
      <div className={classnames(styles.page, styles.connect)}>
        <div>
          <h1>Connect to MongoDB</h1>

          <ConnectionForm
            currentConnection={{}}
            errorMessage=""
            isConnected={false}
            isHostChanged={false}
            isPortChanged={false}
            isValid={false}
            syntaxErrorMessage=""
          />
        </div>
        <div>
          Info about atlas and creating a db.
        </div>
      </div>
    );
  }
}
