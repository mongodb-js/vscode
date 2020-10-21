import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, ReadPreferenceChangedAction } from '../../../store/actions';
import FormItemSelect from '../../form/form-item-select';
import READ_PREFERENCES from '../../../connection-model/constants/read-preferences';

type DispatchProps = {
  onReadPreferenceChanged: (newReadPreference: READ_PREFERENCES) => void;
};
type props = { readPreference: string } & DispatchProps;

class ReadPreferenceSelect extends React.PureComponent<props> {
  /**
   * Handles a read preference change.
   *
   * @param {Object} evt - evt.
   */
  onReadPreferenceChanged(evt): void {
    this.props.onReadPreferenceChanged(evt.target.value);
  }

  render(): React.ReactNode {
    const { readPreference } = this.props;

    return (
      <FormItemSelect
        label="Read Preference"
        name="readPreference"
        options={[
          { [READ_PREFERENCES.PRIMARY]: 'Primary' },
          { [READ_PREFERENCES.PRIMARY_PREFERRED]: 'Primary Preferred' },
          { [READ_PREFERENCES.SECONDARY]: 'Secondary' },
          { [READ_PREFERENCES.SECONDARY_PREFERRED]: 'Secondary Preferred' },
          { [READ_PREFERENCES.NEAREST]: 'Nearest' }
        ]}
        changeHandler={this.onReadPreferenceChanged.bind(this)}
        value={readPreference}
      />
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onReadPreferenceChanged: (
    newReadPreference: READ_PREFERENCES
  ): ReadPreferenceChangedAction => ({
    type: ActionTypes.READ_PREFERENCE_CHANGED,
    readPreference: newReadPreference
  })
};

export default connect(null, mapDispatchToProps)(ReadPreferenceSelect);
