import * as React from 'react';

import MongoDBLogo from '../mongodb-logo/mongodb-logo';

const styles = require('./overview-page.less');

class OverviewHeader extends React.PureComponent {
  render(): React.ReactNode {
    return (
      <div className={styles['overview-header']}>
        <MongoDBLogo />
        <div className={styles['overview-header-description']}>
          Navigate your databases and collections, use playgrounds for exploring and transforming your data
        </div>
        <div className={styles['overview-header-bar']}/>
      </div>
    );
  }
}

export default OverviewHeader;
