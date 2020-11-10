import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, AuthStrategyChangedAction } from '../../../../store/actions';
import AUTH_STRATEGIES, {
  AuthStrategies
} from '../../../../connection-model/constants/auth-strategies';
import FormGroup from '../../../form/form-group';
import Kerberos from './kerberos';
import LDAP from './ldap';
import MongoDBAuth from './mongodb-authentication';
import ScramSha256 from './scram-sha-256';
import X509 from './x509';
import { AppState } from '../../../../store/store';
import RadioBoxGroup from '../../../form/radio-box-group/radio-box-group';

type StateProps = {
  authStrategy: AUTH_STRATEGIES;
  isValid: boolean;
  kerberosCanonicalizeHostname: boolean;
  kerberosPassword?: string;
  kerberosPrincipal?: string;
  kerberosServiceName?: string;
  ldapPassword?: string;
  ldapUsername?: string;
  mongodbDatabaseName?: string;
  mongodbPassword?: string;
  mongodbUsername?: string;
  x509Username?: string;
};

type DispatchProps = {
  onAuthStrategyChanged: (authStrategy: AUTH_STRATEGIES) => void;
};

export class Authentication extends React.Component<StateProps & DispatchProps> {
  /**
   * Changes an authentication strategy.
   *
   * @param {Object} evt - evt.
   */
  onAuthStrategyChanged = (evt): void => {
    this.props.onAuthStrategyChanged(evt.target.value);
  };

  /**
   * Renders an authentication strategy component.
   *
   * @returns {React.Component}
   */
  renderAuthStrategy(): React.ReactNode {
    const { authStrategy, isValid } = this.props;

    if (authStrategy === AUTH_STRATEGIES.KERBEROS) {
      const {
        kerberosCanonicalizeHostname,
        kerberosPassword,
        kerberosPrincipal,
        kerberosServiceName
      } = this.props;

      return (
        <Kerberos
          isValid={isValid}
          kerberosCanonicalizeHostname={kerberosCanonicalizeHostname}
          kerberosPassword={kerberosPassword}
          kerberosPrincipal={kerberosPrincipal}
          kerberosServiceName={kerberosServiceName}
        />
      );
    }
    if (authStrategy === AUTH_STRATEGIES.LDAP) {
      const { ldapPassword, ldapUsername } = this.props;

      return (
        <LDAP
          isValid={isValid}
          ldapPassword={ldapPassword}
          ldapUsername={ldapUsername}
        />
      );
    }
    if (authStrategy === AUTH_STRATEGIES.MONGODB) {
      const {
        mongodbDatabaseName,
        mongodbPassword,
        mongodbUsername
      } = this.props;

      return (
        <MongoDBAuth
          isValid={isValid}
          mongodbDatabaseName={mongodbDatabaseName}
          mongodbPassword={mongodbPassword}
          mongodbUsername={mongodbUsername}
        />
      );
    }
    if (authStrategy === AUTH_STRATEGIES['SCRAM-SHA-256']) {
      const {
        mongodbDatabaseName,
        mongodbPassword,
        mongodbUsername
      } = this.props;

      return (
        <ScramSha256
          isValid={isValid}
          mongodbDatabaseName={mongodbDatabaseName}
          mongodbPassword={mongodbPassword}
          mongodbUsername={mongodbUsername}
        />
      );
    }
    if (authStrategy === AUTH_STRATEGIES.X509) {
      const { x509Username } = this.props;
      return <X509 x509Username={x509Username} />;
    }
  }

  render(): React.ReactNode {
    const { authStrategy } = this.props;

    return (
      <FormGroup id="authStrategy" separator>
        {/* <FormItemSelect
          label="Authentication"
          name="authStrategy"
          options={AuthStrategies.map((authStrat) => ({
            [`${authStrat.id}`]: authStrat.title
          }))}
          changeHandler={this.onAuthStrategyChanged}
          value={authStrategy}
        /> */}
        <RadioBoxGroup
          label="Authentication"
          name="authStrategy"
          options={AuthStrategies.map((authStrat) => ({
            label: authStrat.title,
            value: authStrat.id
          }))}
          onChange={this.onAuthStrategyChanged}
          value={authStrategy}
        />
        {this.renderAuthStrategy()}
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    authStrategy: state.currentConnection.authStrategy,
    isValid: state.isValid,
    kerberosCanonicalizeHostname: state.currentConnection.kerberosCanonicalizeHostname,
    kerberosPassword: state.currentConnection.kerberosPassword,
    kerberosPrincipal: state.currentConnection.kerberosPrincipal,
    kerberosServiceName: state.currentConnection.kerberosServiceName,
    ldapPassword: state.currentConnection.ldapPassword,
    ldapUsername: state.currentConnection.ldapUsername,
    mongodbDatabaseName: state.currentConnection.mongodbDatabaseName,
    mongodbPassword: state.currentConnection.mongodbPassword,
    mongodbUsername: state.currentConnection.mongodbUsername,
    x509Username: state.currentConnection.x509Username
  };
};

const mapDispatchToProps: DispatchProps = {
  onAuthStrategyChanged: (newAuthStrategy): AuthStrategyChangedAction => ({
    type: ActionTypes.AUTH_STRATEGY_CHANGED,
    authStrategy: newAuthStrategy
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(Authentication);
