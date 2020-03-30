import * as React from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

type props = {
  isValid: boolean;
  ldapPassword?: string;
  ldapUsername?: string;
};

/**
 * The LDAP auth role component.
 */
class LDAP extends React.Component<props> {
  static displayName = 'LDAP';

  /**
   * Handle the username change.
   *
   * @param {Event} evt - The event.
   */
  onUsernameChanged = (evt): void => {
    Actions.onLDAPUsernameChanged(evt.target.value.trim());
  };

  /**
   * Handle the password change.
   *
   * @param {Event} evt - The event.
   */
  onPasswordChanged = (evt): void => {
    Actions.onLDAPPasswordChanged(evt.target.value);
  };

  /**
   * Open the help page for LDAP.
   */
  onLDAPHelp = (): void => {
    window.open('https://docs.mongodb.com/manual/core/security-ldap/');
  };

  /**
   * Render the kerberos component.
   *
   * @returns {React.Component} The component.
   */
  render(): React.ReactNode {
    const {
      isValid,
      ldapPassword,
      ldapUsername
    } = this.props;

    return (
      <div id="ldap-authentication" className="form-group">
        <FormInput
          label="Username"
          name="ldap-username"
          error={!isValid && ldapUsername === undefined}
          changeHandler={this.onUsernameChanged}
          value={ldapUsername || ''}
          linkHandler={this.onLDAPHelp}
        />
        <FormInput
          label="Password"
          name="ldap-password"
          type="password"
          error={!isValid && ldapPassword === undefined}
          changeHandler={this.onPasswordChanged}
          value={ldapPassword || ''}
        />
      </div>
    );
  }
}

export default LDAP;
