import * as React from 'react';
import { connect } from 'react-redux';

import { AppState } from '../../store/store';
import OverviewHeader from './overview-header';
import ConnectionForm from '../connect-form/connection-form';
import ConnectHelper from '../connect-helper/connect-helper';
import ConnectionStatus from '../connection-status/connection-status';
import AtlasCTA from '../atlas-cta/atlas-cta';

const styles = require('./overview-page.less');

type StateProps = {
  showConnectForm: boolean;
};

export class Overview extends React.PureComponent<StateProps> {
  renderConnectForm() {
    return (
      <div className={styles['overview-page-connection-form-modal']}>
        <ConnectionForm />
      </div>
    )
  }

  render(): React.ReactNode {
    const { showConnectForm } = this.props;

    return (
      <div className={styles.overview}>
        {showConnectForm && this.renderConnectForm()}
        <OverviewHeader />
        <ConnectionStatus />
        <ConnectHelper />
        <div className={styles['overview-help-panel-container']}>
          <AtlasCTA />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    showConnectForm: state.showConnectForm
  };
};

export default connect(mapStateToProps, null)(Overview);

