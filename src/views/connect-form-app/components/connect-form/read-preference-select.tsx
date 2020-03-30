import * as React from 'react';

import Actions from '../../store/actions';
import FormItemSelect from './form-item-select';
import READ_PREFERENCES from '../../connection-model/constants/read-preferences';

type props = { readPreference: string };

class ReadPreferenceSelect extends React.PureComponent<props> {
  static displayName = 'ReadPreferenceSelect';

  /**
   * Handles a read preference change.
   *
   * @param {Object} evt - evt.
   */
  onReadPreferenceChanged(evt): void {
    Actions.onReadPreferenceChanged(evt.target.value);
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

export default ReadPreferenceSelect;
