import * as React from 'react';

import OverviewHeader from './overview-header';
import ConnectHelper from '../connect-helper/connect-helper';
import ConnectionStatus from '../connection-status/connection-status';
import HelpPanel from '../help-panel/help-panel';

const styles = require('./overview-page.less');

export class Overview extends React.PureComponent {
  render(): React.ReactNode {
    return (
      <div className={styles.overview}>
        <OverviewHeader />
        <ConnectionStatus />
        <ConnectHelper />
        <div className={styles['overview-help-panel-container']}>
          <HelpPanel />
        </div>
      </div>
    );
  }
}

export default Overview;
