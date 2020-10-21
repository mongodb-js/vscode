import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, HostnameChangedAction } from '../../../store/actions';
import FormInput from '../../form/form-input';

type DispatchProps = {
  onHostnameChanged: (newHostName: string) => void;
};

type props = {
  hostname: string;
} & DispatchProps;

class HostInput extends React.PureComponent<props> {
  /**
   * Changes a host name.
   *
   * @param {Object} evt - evt.
   */
  onHostnameChanged = (evt): void => {
    this.props.onHostnameChanged(evt.target.value);
  };

  /**
   * Gets a host name.
   *
   * @returns {String} hostname.
   */
  getHostname(): string {
    return this.props.hostname;
  }

  render(): React.ReactNode {
    return (
      <FormInput
        label="Hostname"
        name="hostname"
        placeholder="localhost"
        changeHandler={this.onHostnameChanged}
        value={this.getHostname()}
      />
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onHostnameChanged: (newHostname: string): HostnameChangedAction => ({
    type: ActionTypes.HOSTNAME_CHANGED,
    hostname: newHostname
  })
};

export default connect(null, mapDispatchToProps)(HostInput);
