import * as React from 'react';
import { connect } from 'react-redux';

import { AppState } from '../../store/store';
import OverviewHeader from './overview-header';
import ConnectionForm from '../connect-form/connection-form';
import ConnectHelper from '../connect-helper/connect-helper';
import ConnectionStatus from '../connection-status/connection-status';
import AtlasCTA from '../atlas-cta/atlas-cta';
import {
  ActionTypes,
  ToggleShowConnectionFormAction
} from '../../store/actions';

const styles = require('./overview-page.less');

type StateProps = {
  showConnectForm: boolean;
};

type DispatchProps = {
  toggleShowConnectForm: () => void;
};

export class Overview extends React.PureComponent<StateProps & DispatchProps> {
  renderConnectForm(): React.ReactNode {
    return (
      <React.Fragment>
        <div
          className={styles['overview-page-connect-form-modal-back']}
          onClick={(): void => this.props.toggleShowConnectForm()}
        />
        <div className={styles['overview-page-connection-form-modal']}>
          <ConnectionForm />
        </div>
      </React.Fragment>
    );
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

const mapDispatchToProps: DispatchProps = {
  toggleShowConnectForm: (): ToggleShowConnectionFormAction => ({
    type: ActionTypes.TOGGLE_SHOW_CONNECTION_FORM
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(Overview);

