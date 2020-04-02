import * as React from 'react';
import Toggle from '@leafygreen-ui/toggle';
import { connect } from 'react-redux';

import {
  ActionTypes,
  KerberosParameters,
  KerberosParametersChanged
} from '../../../store/actions';
import FormInput from '../form-input';

const styles = require('../../../connect.module.less');

type dispatchProps = {
  kerberosParametersChanged: (newParams: KerberosParameters) => void;
};

type props = {
  isValid: boolean;
  kerberosCanonicalizeHostname: boolean;
  kerberosPassword?: string;
  kerberosPrincipal?: string;
  kerberosServiceName?: string;
} & dispatchProps;

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
    const {
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosServiceName
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal: evt.target.value.trim(),
      kerberosServiceName
    });
  };

  /**
   * Handle the password change.
   *
   * @param {Event} evt - The event.
   */
  onPasswordChanged = (evt): void => {
    const {
      kerberosCanonicalizeHostname,
      kerberosPrincipal,
      kerberosServiceName
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword: evt.target.value,
      kerberosPrincipal,
      kerberosServiceName
    });
  };

  /**
   * Handle the service name change.
   *
   * @param {Event} evt - The event.
   */
  onServiceNameChanged = (evt): void => {
    const {
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName: evt.target.value
    });
  };

  /**
   * Open the help page for the principal.
   */
  onPrincipalHelp = (): void => {
    window.open('https://docs.mongodb.com/manual/core/kerberos/#principals');
  };

  onCnameToggle = (): void => {
    const {
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname: !kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName
    });
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
        <div className={styles['form-item']}>
          <div>
            <label>
              <span>Canonicalize Host Name</span>
            </label>
          </div>
          <Toggle
            className={styles['form-toggle']}
            name="kerberosCanonicalizeHostname"
            onChange={this.onCnameToggle}
            checked={kerberosCanonicalizeHostname || false}
            size="small"
            variant="default"
            disabled={false}
          />
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
  kerberosParametersChanged: (
    newKerberosParams
  ): KerberosParametersChanged => ({
    type: ActionTypes.KERBEROS_PARAMETERS_CHANGED,
    ...newKerberosParams
  })
};

export default connect(null, mapDispatchToProps)(Kerberos);
