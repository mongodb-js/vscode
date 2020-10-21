import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  ConnectionFormChangedAction,
  SetConnectionFormTabAction
} from '../../store/actions';
import FormGroup from '../form/form-group';
import HostInput from './host/host-input';
import PortInput from './host/port-input';
import SRVInput from './host/srv-input';
import Authentication from './authentication/authentication';
import ReplicaSetInput from './replica-set-input';
import ReadPreferenceSelect from './read-preference-select';
import SSLMethod from './ssl/ssl-method';
import SSHTunnel from './ssh/ssh-tunnel';
import FormActions from '../form/form-actions';
import ConnectionModel from '../../connection-model/connection-model';
import { AppState } from '../../store/store';
import { CONNECTION_FORM_TABS } from '../../store/constants';

const styles = require('./connection-form.less');

type StateProps = {
  connectionFormTab: CONNECTION_FORM_TABS;
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
  setConnectionFormTab: (connectionFormTab: CONNECTION_FORM_TABS) => void;
};

type props = StateProps & DispatchProps;

export class ConnectionForm extends React.Component<props> {
  static displayName = 'ConnectionForm';

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

  renderHostnameArea(): React.ReactNode {
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

  renderConnectionOptionsArea(): React.ReactNode {
    const { currentConnection } = this.props;

    const {
      readPreference,
      replicaSet,
      sshTunnel,
      sslMethod
    } = currentConnection;

    return (
      <div>
        <FormGroup id="read-preference" separator>
          <ReplicaSetInput sshTunnel={sshTunnel} replicaSet={replicaSet} />
          <ReadPreferenceSelect readPreference={readPreference} />
        </FormGroup>
        <SSLMethod sslMethod={sslMethod} />
        <SSHTunnel sshTunnel={sshTunnel} />
      </div>
    );
  }

  /**
   * Renders a component with messages.
   *
   * @returns {React.Component}
   */
  renderConnectionMessage(): React.ReactNode {
    const { isConnected, connectionMessage } = this.props;

    if (isConnected && connectionMessage) {
      return (
        <div className={styles['connection-message-container']}>
          <div className={styles['connection-message-container-success']}>
            <div
              className={styles['connection-message']}
            >{connectionMessage}</div>
          </div>
        </div>
      );
    }
  }

  render(): React.ReactNode {
    const {
      connectionFormTab,
      connectionMessage,
      currentConnection,
      errorMessage,
      isConnected,
      isConnecting,
      isValid,
      onConnectionFormChanged,
      setConnectionFormTab,
      syntaxErrorMessage
    } = this.props;

    return (
      <form
        onChange={onConnectionFormChanged}
        className={styles['connection-form']}
      >
        <h2 className={styles['connection-form-title']}>New connection</h2>
        <ul
          className={styles['connection-form-tabs-container']}
          role="tablist"
        >
          <li
            className={classnames({
              [styles['connection-form-tab']]: true,
              [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.GENERAL
            })}
            onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.GENERAL)}
            role="tab"
            aria-selected={connectionFormTab === CONNECTION_FORM_TABS.GENERAL}
          >General</li>
          <li
            className={classnames({
              [styles['connection-form-tab']]: true,
              [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.SSL
            })}
            onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.SSL)}
            role="tab"
            aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSL}
          >SSL/TLS</li>
          <li
            className={classnames({
              [styles['connection-form-tab']]: true,
              [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.SSH
            })}
            onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.SSH)}
            role="tab"
            aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSH}
          >SSH Tunnel</li>
          <li
            className={classnames({
              [styles['connection-form-tab']]: true,
              [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.ADVANCED
            })}
            onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.ADVANCED)}
            role="tab"
            aria-selected={connectionFormTab === CONNECTION_FORM_TABS.ADVANCED}
          >Advanced</li>
        </ul>
        <div className={styles['connection-form-fields']}>
          {this.renderHostnameArea()}
          {this.renderConnectionOptionsArea()}
        </div>
        <FormActions
          connectionMessage={connectionMessage}
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

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionFormTab: state.connectionFormTab,
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
  }),
  setConnectionFormTab: (connectionFormTab: CONNECTION_FORM_TABS): SetConnectionFormTabAction => ({
    type: ActionTypes.SET_CONNECTION_FORM_TAB,
    connectionFormTab
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionForm);
