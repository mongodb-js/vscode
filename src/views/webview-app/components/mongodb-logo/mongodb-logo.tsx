import * as React from 'react';

import {
  MongoDBLogo as LeafyGreenMongoDBLogo
} from '@leafygreen-ui/logo';

const styles = require('./mongodb-logo.less');

class MongoDBLogo extends React.PureComponent {
  render(): React.ReactNode {
    let darkMode = true;
    // Update the MongoDB green color we used based on the current
    // theme kind of the VSCode user.
    const element = document.querySelector('body');
    if (element?.getAttribute('data-vscode-theme-kind') === 'vscode-light') {
      darkMode = false;
    }

    return (
      <LeafyGreenMongoDBLogo
        className={styles['mdb-logo-svg']}
        color={darkMode ? 'green-base' : 'green-dark-2'}
      />
    );
  }
}

export default MongoDBLogo;
