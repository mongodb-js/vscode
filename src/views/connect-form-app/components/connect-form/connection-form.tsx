import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, ConnectionFormChangedAction } from '../../store/actions';
import FormGroup from './form-group';
import HostInput from './host/host-input';
import PortInput from './host/port-input';
import SRVInput from './host/srv-input';
import Authentication from './authentication/authentication';
import ReplicaSetInput from './replica-set-input';
import ReadPreferenceSelect from './read-preference-select';
// import SSLMethod from './ssl/ssl-method';
// import SSHTunnel from './ssh/ssh-tunnel';
import FormActions from './form-actions';
import ConnectionModel from '../../connection-model/connection-model';
import { AppState } from '../../store/store';

const styles = require('../../connect.module.less');

type stateProps = {
  currentConnection: ConnectionModel;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isHostChanged: boolean;
  isPortChanged: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

type dispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = stateProps & dispatchProps;

class ConnectionForm extends React.Component<props> {
  static displayName = 'ConnectionForm';

  /**
   * Renders a port input.
   *
   * @returns {React.Component}
   */
  renderPort(): React.ReactNode {
    const { currentConnection, isPortChanged } = this.props;

    const { isSrvRecord, port } = currentConnection;

    if (!isSrvRecord) {
      return <PortInput port={port} isPortChanged={isPortChanged} />;
    }
  }

  renderHostnameArea(): React.ReactNode {
    const { currentConnection, isHostChanged, isValid } = this.props;

    const {
      authStrategy,
      hostname,
      isSrvRecord,
      kerberosCanonicalizeHostname,
      kerberosPassword,
      kerberosPrincipal,
      kerberosServiceName,
      ldapPassword,
      ldapUsername,
      mongodbDatabaseName,
      mongodbPassword,
      mongodbUsername,
      x509Username
    } = currentConnection;

    return (
      <div>
        <FormGroup id="connection-host-information" separator>
          <HostInput hostname={hostname} isHostChanged={isHostChanged} />
          {this.renderPort()}
          <SRVInput isSrvRecord={isSrvRecord} />
        </FormGroup>
        <Authentication
          authStrategy={authStrategy}
          isValid={isValid}
          kerberosCanonicalizeHostname={kerberosCanonicalizeHostname}
          kerberosPassword={kerberosPassword}
          kerberosPrincipal={kerberosPrincipal}
          kerberosServiceName={kerberosServiceName}
          ldapPassword={ldapPassword}
          ldapUsername={ldapUsername}
          mongodbDatabaseName={mongodbDatabaseName}
          mongodbPassword={mongodbPassword}
          mongodbUsername={mongodbUsername}
          x509Username={x509Username}
        />
      </div>
    );
  }

  renderConnectionOptionsArea(): React.ReactNode {
    const { currentConnection } = this.props;

    const {
      readPreference,
      replicaSet,
      sshTunnel
      // sslMethod
    } = currentConnection;

    return (
      <div>
        <FormGroup id="read-preference" separator>
          <ReplicaSetInput sshTunnel={sshTunnel} replicaSet={replicaSet} />
          <ReadPreferenceSelect readPreference={readPreference} />
        </FormGroup>
        {/* <SSLMethod
          sslMethod={sslMethod}
        />
        <SSHTunnel
          sshTunnel={sshTunnel}
        /> */}
      </div>
    );
  }

  render(): React.ReactNode {
    const {
      currentConnection,
      errorMessage,
      isConnected,
      isConnecting,
      isValid,
      onConnectionFormChanged,
      syntaxErrorMessage
    } = this.props;

    return (
      <form
        onChange={onConnectionFormChanged}
        className={classnames(styles['connect-form'])}
      >
        <h1>Connect to MongoDB</h1>
        <div className={classnames(styles.fields)}>
          {this.renderHostnameArea()}
          {this.renderConnectionOptionsArea()}
        </div>
        <FormActions
          currentConnection={currentConnection}
          errorMessage={errorMessage}
          isConnected={isConnected}
          isConnecting={isConnecting}
          isValid={isValid}
          syntaxErrorMessage={syntaxErrorMessage}
        />
      </form>
    );
  }
}

const mapStateToProps = (state: AppState): stateProps => {
  return {
    currentConnection: state.currentConnection,
    errorMessage: state.errorMessage,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isHostChanged: state.isHostChanged,
    isPortChanged: state.isPortChanged,
    isValid: state.isValid,
    syntaxErrorMessage: state.syntaxErrorMessage
  };
};

const mapDispatchToProps: dispatchProps = {
  // Resets URL validation if form was changed.
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionForm);
