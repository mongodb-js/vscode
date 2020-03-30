import * as React from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

type props = {
  x509Username: string;
  isValid: boolean;
};

/**
 * The kerberos auth role component.
 */
class X509 extends React.Component<props> {
  static displayName = 'X509';

  /**
   * Handle the username change.
   *
   * @param {Event} evt - The event.
   */
  onUsernameChanged = (evt): void => {
    Actions.onX509UsernameChanged(evt.target.value.trim());
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
          value={x509Username || ''} />
      </div>
    );
  }
}

export default X509;
