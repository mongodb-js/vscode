import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  ConnectionFormChangedAction
} from '../../../store/actions';
import { AppState } from '../../../store/store';
import ReadPreferenceSelect from './read-preference-select';
import ReplicaSetInput from './replica-set-input';
import READ_PREFERENCES from '../../../connection-model/constants/read-preferences';
import SSH_TUNNEL_TYPES from '../../../connection-model/constants/ssh-tunnel-types';

type StateProps = {
  readPreference: READ_PREFERENCES;
  replicaSet?: string;
  sshTunnel: SSH_TUNNEL_TYPES;
};

type DispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = StateProps & DispatchProps;

export class AdvancedTab extends React.Component<props> {
  render(): React.ReactNode {
    const {
      readPreference,
      replicaSet,
      sshTunnel
    } = this.props;

    return (
      <React.Fragment>
        <ReplicaSetInput sshTunnel={sshTunnel} replicaSet={replicaSet} />
        <ReadPreferenceSelect readPreference={readPreference} />
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    readPreference: state.currentConnection.readPreference,
    replicaSet: state.currentConnection.replicaSet,
    sshTunnel: state.currentConnection.sshTunnel
  };
};

const mapDispatchToProps: DispatchProps = {
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedTab);
