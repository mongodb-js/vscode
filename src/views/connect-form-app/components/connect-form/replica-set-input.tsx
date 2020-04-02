import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, ReplicaSetChangedAction } from '../../store/actions';
import FormInput from './form-input';

type dispatchProps = {
  onReplicaSetChanged: (newReplicaSetName: string) => void;
};

type props = {
  sshTunnel: string;
  replicaSet?: string;
} & dispatchProps;

class ReplicaSetInput extends React.PureComponent<props> {
  static displayName = 'ReplicaSetInput';

  /**
   * Handles a replica set change.
   *
   * @param {Object} evt - evt.
   */
  onReplicaSetChanged = (evt): void => {
    this.props.onReplicaSetChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { replicaSet, sshTunnel } = this.props;

    if (sshTunnel === 'NONE' || !sshTunnel) {
      return (
        <FormInput
          label="Replica Set Name"
          name="replicaSet"
          changeHandler={this.onReplicaSetChanged}
          value={replicaSet || ''}
        />
      );
    }

    return null;
  }
}

const mapDispatchToProps: dispatchProps = {
  onReplicaSetChanged: (
    newReplicaSetName: string
  ): ReplicaSetChangedAction => ({
    type: ActionTypes.REPLICA_SET_CHANGED,
    replicaSet: newReplicaSetName
  })
};

export default connect(null, mapDispatchToProps)(ReplicaSetInput);
