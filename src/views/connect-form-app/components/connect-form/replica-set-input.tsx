import * as React from 'react';

import Actions from '../../store/actions';
import FormInput from './form-input';

type props = {
  sshTunnel: string;
  replicaSet: string;
};

class ReplicaSetInput extends React.PureComponent<props> {
  static displayName = 'ReplicaSetInput';

  /**
   * Handles a replica set change.
   *
   * @param {Object} evt - evt.
   */
  onReplicaSetChanged(evt): void {
    Actions.onReplicaSetChanged(evt.target.value);
  }

  render(): React.ReactNode {
    const {
      replicaSet,
      sshTunnel
    } = this.props;

    if (sshTunnel === 'NONE' || !sshTunnel) {
      return (
        <FormInput
          label="Replica Set Name"
          name="replicaSet"
          changeHandler={this.onReplicaSetChanged.bind(this)}
          value={replicaSet || ''} />
      );
    }

    return null;
  }
}

export default ReplicaSetInput;
