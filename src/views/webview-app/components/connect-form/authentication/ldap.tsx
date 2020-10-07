import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  LDAPPasswordChangedAction,
  LDAPUsernameChangedAction
} from '../../../store/actions';
import FormInput from '../form-input';

type DispatchProps = {
  onLDAPPasswordChanged: (newPassword: string) => void;
  onLDAPUsernameChanged: (newUsername: string) => void;
};

type props = {
  isValid: boolean;
  ldapPassword?: string;
  ldapUsername?: string;
} & DispatchProps;

/**
 * The LDAP auth role component.
 */
class LDAP extends React.Component<props> {
  static displayName = 'LDAP';

  /**
   * Handle the password change.
   *
   * @param {Event} evt - The event.
   */
  onPasswordChanged = (evt): void => {
    this.props.onLDAPPasswordChanged(evt.target.value);
  };

  /**
   * Handle the username change.
   *
   * @param {Event} evt - The event.
   */
  onUsernameChanged = (evt): void => {
    this.props.onLDAPUsernameChanged(evt.target.value.trim());
  };

  /**
   * Render the kerberos component.
   *
   * @returns {React.Component} The component.
   */
  render(): React.ReactNode {
    const { isValid, ldapPassword, ldapUsername } = this.props;

    return (
      <div id="ldap-authentication" className="form-group">
        <FormInput
          label="Username"
          name="ldap-username"
          error={!isValid && ldapUsername === undefined}
          changeHandler={this.onUsernameChanged}
          value={ldapUsername || ''}
          // Open the help page for LDAP.
          linkTo="https://docs.mongodb.com/manual/core/security-ldap/"
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

const mapDispatchToProps: DispatchProps = {
  onLDAPPasswordChanged: (newPassword): LDAPPasswordChangedAction => ({
    type: ActionTypes.LDAP_PASSWORD_CHANGED,
    ldapPassword: newPassword
  }),
  onLDAPUsernameChanged: (newPassword): LDAPUsernameChangedAction => ({
    type: ActionTypes.LDAP_USERNAME_CHANGED,
    ldapUsername: newPassword
  })
};

export default connect(null, mapDispatchToProps)(LDAP);
