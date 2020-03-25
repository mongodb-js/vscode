import React, { PureComponent, ReactNode } from 'react';

import Actions from '../../store/actions';
import FormItemSelect from './form-item-select';

type props = { readPreference: string };

class ReadPreferenceSelect extends PureComponent<props> {
  static displayName = 'ReadPreferenceSelect';

  /**
   * Handles a read preference change.
   *
   * @param {Object} evt - evt.
   */
  onReadPreferenceChanged(evt): void {
    Actions.onReadPreferenceChanged(evt.target.value);
  }

  render(): ReactNode {
    return (
      <FormItemSelect
        label="Read Preference"
        name="readPreference"
        options={[
          { 'primary': 'Primary' },
          { 'primaryPreferred': 'Primary Preferred' },
          { 'secondary': 'Secondary' },
          { 'secondaryPreferred': 'Secondary Preferred' },
          { 'nearest': 'Nearest' }
        ]}
        changeHandler={this.onReadPreferenceChanged.bind(this)}
        value={this.props.readPreference}
      />
    );
  }
}

export default ReadPreferenceSelect;
