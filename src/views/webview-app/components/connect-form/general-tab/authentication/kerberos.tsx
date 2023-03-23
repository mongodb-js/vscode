import * as React from 'react';
import { connect } from 'react-redux';
import Toggle from '@leafygreen-ui/toggle';

import {
  ActionTypes,
  KerberosParameters,
  KerberosParametersChanged,
} from '../../../../store/actions';
import FormInput from '../../../form/form-input';

import styles from '../../../../connect.module.less';

type DispatchProps = {
  kerberosParametersChanged: (newParams: KerberosParameters) => void;
};

type props = {
  isValid: boolean;
  kerberosCanonicalizeHostname: boolean;
  kerberosPassword?: string;
  kerberosPrincipal?: string;
  kerberosServiceName?: string;
} & DispatchProps;

/**
 * The kerberos auth role component.
 */
class Kerberos extends React.Component<props> {
  /**
   * Handle the principal change.
   *
   * @param {Event} evt - The event.
   */
  onPrincipalChanged = (evt): void => {
    const {
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosServiceName,
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal: evt.target.value.trim(),
      kerberosServiceName,
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
      kerberosServiceName,
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword: evt.target.value,
      kerberosPrincipal,
      kerberosServiceName,
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
      kerberosPrincipal,
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName: evt.target.value,
    });
  };

  onCnameToggle = (): void => {
    const {
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName,
    } = this.props;

    this.props.kerberosParametersChanged({
      kerberosCanonicalizeHostname: !kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName,
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
      kerberosServiceName,
    } = this.props;

    return (
      <div id="kerberos-authentication" className="form-group">
        <FormInput
          label="Principal"
          name="kerberos-principal"
          error={!isValid && kerberosPrincipal === undefined}
          changeHandler={this.onPrincipalChanged}
          value={kerberosPrincipal || ''}
          // Open the help page for the principal.
          linkTo="https://docs.mongodb.com/manual/core/kerberos/#principals"
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
            aria-labelledby="Kerberos Canonicalize Host Name"
            className={styles['form-toggle']}
            name="kerberosCanonicalizeHostname"
            onChange={this.onCnameToggle}
            checked={kerberosCanonicalizeHostname || false}
            size="small"
            disabled={false}
          />
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  kerberosParametersChanged: (
    newKerberosParams
  ): KerberosParametersChanged => ({
    type: ActionTypes.KERBEROS_PARAMETERS_CHANGED,
    ...newKerberosParams,
  }),
};

export default connect(null, mapDispatchToProps)(Kerberos);
