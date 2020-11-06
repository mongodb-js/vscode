import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, ReplicaSetChangedAction } from '../../../store/actions';
import { AppState } from '../../../store/store';
import FormInput from '../../form/form-input';
import SSH_TUNNEL_TYPES from '../../../connection-model/constants/ssh-tunnel-types';

type StateProps = {
  isSrvRecord: boolean;
  replicaSet?: string;
  sshTunnel: SSH_TUNNEL_TYPES;
};

type DispatchProps = {
  onReplicaSetChanged: (newReplicaSetName: string) => void;
};

class ReplicaSetInput extends React.PureComponent<StateProps & DispatchProps> {
  /**
   * Handles a replica set change.
   *
   * @param {Object} evt - evt.
   */
  onReplicaSetChanged = (evt): void => {
    this.props.onReplicaSetChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { isSrvRecord, replicaSet, sshTunnel } = this.props;

    if (sshTunnel !== SSH_TUNNEL_TYPES.NONE || isSrvRecord) {
      // Don't show the replica set input when the connection
      // is using an ssh tunnel or srv record.
      return null;
    }

    return (
      <FormInput
        label="Replica Set Name"
        name="replicaSet"
        changeHandler={this.onReplicaSetChanged}
        value={replicaSet || ''}
      />
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isSrvRecord: state.currentConnection.isSrvRecord,
    replicaSet: state.currentConnection.replicaSet,
    sshTunnel: state.currentConnection.sshTunnel
  };
};

const mapDispatchToProps: DispatchProps = {
  onReplicaSetChanged: (
    newReplicaSetName: string
  ): ReplicaSetChangedAction => ({
    type: ActionTypes.REPLICA_SET_CHANGED,
    replicaSet: newReplicaSetName
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ReplicaSetInput);
