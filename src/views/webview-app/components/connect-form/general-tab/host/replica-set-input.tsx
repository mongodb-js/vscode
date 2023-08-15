import * as React from 'react';
import { connect } from 'react-redux';

import type { ReplicaSetChangedAction } from '../../../../store/actions';
import { ActionTypes } from '../../../../store/actions';
import type { AppState } from '../../../../store/store';
import FormInput from '../../../form/form-input';

type StateProps = {
  replicaSet?: string;
};

type DispatchProps = {
  onReplicaSetChanged: (newReplicaSetName: string) => void;
};

class ReplicaSetInput extends React.PureComponent<StateProps & DispatchProps> {
  onReplicaSetChanged = (evt: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.onReplicaSetChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { replicaSet } = this.props;

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
    replicaSet: state.currentConnection.replicaSet,
  };
};

const mapDispatchToProps: DispatchProps = {
  onReplicaSetChanged: (
    newReplicaSetName: string
  ): ReplicaSetChangedAction => ({
    type: ActionTypes.REPLICA_SET_CHANGED,
    replicaSet: newReplicaSetName,
  }),
};

export default connect(mapStateToProps, mapDispatchToProps)(ReplicaSetInput);
