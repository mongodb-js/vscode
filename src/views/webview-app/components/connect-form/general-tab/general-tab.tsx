import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  ConnectionFormChangedAction
} from '../../../store/actions';
import FormGroup from '../../form/form-group';
import HostInput from './host-input';
import PortInput from './port-input';
import SRVInput from './srv-input';
import Authentication from './authentication/authentication';
import ConnectionModel from '../../../connection-model/connection-model';
import { AppState } from '../../../store/store';

type StateProps = {
  connectionMessage: string;
  currentConnection: ConnectionModel;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

type DispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = StateProps & DispatchProps;

export class GeneralTab extends React.Component<props> {
  /**
   * Renders a port input.
   *
   * @returns {React.Component}
   */
  renderPort(): React.ReactNode {
    const { currentConnection } = this.props;

    const { isSrvRecord, port } = currentConnection;

    if (!isSrvRecord) {
      return <PortInput port={port} />;
    }
  }

  render(): React.ReactNode {
    const { currentConnection, isValid } = this.props;

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
          <HostInput hostname={hostname} />
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
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionMessage: state.connectionMessage,
    currentConnection: state.currentConnection,
    errorMessage: state.errorMessage,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isValid: state.isValid,
    syntaxErrorMessage: state.syntaxErrorMessage
  };
};

const mapDispatchToProps: DispatchProps = {
  // Resets URL validation if form was changed.
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(GeneralTab);
