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

type StateProps = {
  readPreference: READ_PREFERENCES;
};

type DispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = StateProps & DispatchProps;

export class AdvancedTab extends React.Component<props> {
  render(): React.ReactNode {
    const {
      readPreference
    } = this.props;

    return (
      <React.Fragment>
        <ReplicaSetInput />
        <ReadPreferenceSelect readPreference={readPreference} />
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    readPreference: state.currentConnection.readPreference
  };
};

const mapDispatchToProps: DispatchProps = {
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedTab);
