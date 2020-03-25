import React, { PureComponent, ReactNode } from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

type props = {
  hostname: string;
  isHostChanged: boolean;
};

class HostInput extends PureComponent<props> {
  static displayName = 'HostInput';

  /**
   * Changes a host name.
   *
   * @param {Object} evt - evt.
   */
  onHostnameChanged(evt): void {
    Actions.onHostnameChanged(evt.target.value);
  }

  /**
   * Gets a host name.
   *
   * @returns {String} hostname.
   */
  getHostname(): string {
    if (this.props.isHostChanged === false) {
      return '';
    }

    return this.props.hostname;
  }

  render(): ReactNode {
    return (
      <FormInput
        label="Hostname"
        name="hostname"
        placeholder="localhost"
        changeHandler={this.onHostnameChanged.bind(this)}
        value={this.getHostname()}
      />
    );
  }
}

export default HostInput;
