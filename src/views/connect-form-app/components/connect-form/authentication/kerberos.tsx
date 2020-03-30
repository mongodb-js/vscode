import * as React from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

type props = {
  isValid: boolean;
  kerberosCanonicalizeHostname: boolean;
  kerberosPassword: string;
  kerberosPrincipal: string;
  kerberosServiceName: string;
};

/**
 * The kerberos auth role component.
 */
class Kerberos extends React.Component<props> {
  static displayName = 'Kerberos';

  /**
   * Handle the principal change.
   *
   * @param {Event} evt - The event.
   */
  onPrincipalChanged = (evt): void => {
    Actions.onKerberosPrincipalChanged(evt.target.value.trim());
  };

  /**
   * Handle the password change.
   *
   * @param {Event} evt - The event.
   */
  onPasswordChanged = (evt): void => {
    Actions.onKerberosPasswordChanged(evt.target.value);
  };

  /**
   * Handle the service name change.
   *
   * @param {Event} evt - The event.
   */
  onServiceNameChanged = (evt): void => {
    Actions.onKerberosServiceNameChanged(evt.target.value);
  };

  /**
   * Open the help page for the principal.
   */
  onPrincipalHelp = (): void => {
    window.open('https://docs.mongodb.com/manual/core/kerberos/#principals');
  };

  onCnameToggle = (): void => {
    Actions.onKerberosCnameToggle();
  };

  /**
   * Render the kerberos component.
   *
   * @returns {React.Component} The component.
   */
  render(): React.ReactNode {
    const {
      isValid,
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName
    } = this.props;

    return (
      <div id="kerberos-authentication" className="form-group">
        <FormInput
          label="Principal"
          name="kerberos-principal"
          error={!isValid && kerberosPrincipal === undefined}
          changeHandler={this.onPrincipalChanged}
          value={kerberosPrincipal || ''}
          linkHandler={this.onPrincipalHelp}
        />
        <FormInput
          label="Password"
          name="kerberos-password"
          type="password"
          changeHandler={this.onPasswordChanged}
          value={kerberosPassword || ''}
        />
        <FormInput
          label="Service Name"
          placeholder="mongodb"
          name="kerberos-service-name"
          changeHandler={this.onServiceNameChanged}
          value={kerberosServiceName || ''}
        />
        <div className="form-item">
          <label>
            <span className="form-item-label">
              Canonicalize Host Name
            </span>
          </label>
          <div className="form-item-switch-wrapper">
            <input
              checked={kerberosCanonicalizeHostname || false}
              className="form-control-switch"
              onChange={this.onCnameToggle}
              name="kerberosCanonicalizeHostname"
              type="checkbox"
            />
          </div>
        </div>
      </div>
    );
  }
}

export default Kerberos;
