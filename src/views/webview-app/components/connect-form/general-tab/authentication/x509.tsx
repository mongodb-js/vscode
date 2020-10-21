import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, X509UsernameChangedAction } from '../../../../store/actions';
import FormInput from '../../../form/form-input';

type DispatchProps = {
  onX509UsernameChanged: (newUsername: string) => void;
};

type props = {
  isValid: boolean;
  x509Username?: string;
} & DispatchProps;

/**
 * The kerberos auth role component.
 */
class X509 extends React.Component<props> {
  /**
   * Handle the username change.
   *
   * @param {Event} evt - The event.
   */
  onUsernameChanged = (evt): void => {
    this.props.onX509UsernameChanged(evt.target.value.trim());
  };

  /**
   * Render the kerberos component.
   *
   * @returns {React.Component} The component.
   */
  render(): React.ReactNode {
    const { isValid, x509Username } = this.props;

    return (
      <div id="x509-authentication" className="form-group">
        <FormInput
          label="Username"
          name="x509-username"
          error={!isValid && x509Username === undefined}
          changeHandler={this.onUsernameChanged}
          value={x509Username || ''}
        />
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onX509UsernameChanged: (newUsername: string): X509UsernameChangedAction => ({
    type: ActionTypes.X509_USERNAME_CHANGED,
    x509Username: newUsername
  })
};

export default connect(null, mapDispatchToProps)(X509);
