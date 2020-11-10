import * as React from 'react';
import { connect } from 'react-redux';

import { AppState } from '../../../store/store';
import { ActionTypes, ReadPreferenceChangedAction } from '../../../store/actions';
import RadioBoxGroup from '../../form/radio-box-group/radio-box-group';
import READ_PREFERENCES from '../../../connection-model/constants/read-preferences';

type ReadPreferenceOption = {
  label: string;
  value: READ_PREFERENCES;
};

const ReadPreferencesOptions: ReadPreferenceOption[] = [
  {
    label: 'Primary',
    value: READ_PREFERENCES.PRIMARY
  },
  {
    label: 'Primary Preferred',
    value: READ_PREFERENCES.PRIMARY_PREFERRED
  },
  {
    label: 'Secondary',
    value: READ_PREFERENCES.SECONDARY
  },
  {
    label: 'Secondary Preferred',
    value: READ_PREFERENCES.SECONDARY_PREFERRED
  },
  {
    label: 'Nearest',
    value: READ_PREFERENCES.NEAREST
  }
];

type StateProps = {
  readPreference: READ_PREFERENCES;
};

type DispatchProps = {
  onReadPreferenceChanged: (newReadPreference: READ_PREFERENCES) => void;
};

class ReadPreferenceSelect extends React.PureComponent<StateProps & DispatchProps> {
  /**
   * Handles a read preference change.
   *
   * @param {Object} evt - evt.
   */
  onReadPreferenceChanged = (evt): void => {
    this.props.onReadPreferenceChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { readPreference } = this.props;

    return (
      <RadioBoxGroup
        label="Read Preference"
        name="readPreference"
        options={ReadPreferencesOptions}
        onChange={this.onReadPreferenceChanged}
        value={readPreference}
      />
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    readPreference: state.currentConnection.readPreference
  };
};

const mapDispatchToProps: DispatchProps = {
  onReadPreferenceChanged: (
    newReadPreference: READ_PREFERENCES
  ): ReadPreferenceChangedAction => ({
    type: ActionTypes.READ_PREFERENCE_CHANGED,
    readPreference: newReadPreference
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ReadPreferenceSelect);
