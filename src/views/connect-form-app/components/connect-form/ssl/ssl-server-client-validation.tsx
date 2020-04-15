import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import FileInputButton from '../file-input-button';
import FormInput from '../form-input';
import {
  ActionTypes,
  OnChangeSSLCAAction,
  OnChangeSSLCertAction,
  OnChangeSSLKeyAction,
  SSLPassChangedAction
} from '../../../store/actions';
import { AppState } from '../../../store/store';

const styles = require('../../../connect.module.less');

type stateProps = {
  isValid: boolean;
  sslCA?: string[];
  sslCert?: string[];
  sslKey?: string[];
  sslPass?: string;
};

type dispatchProps = {
  onChangeSSLCA: () => void;
  onChangeSSLCertificate: () => void;
  onChangeSSLPrivateKey: () => void;
  sslPrivateKeyPasswordChanged: (newSSLPass: string) => void;
};

type props = stateProps & dispatchProps;

class SSLServerClientValidation extends React.Component<props> {
  static displayName = 'SSLServerClientValidation';

  /**
   * Handles sslCA change.
   */
  onCertificateAuthorityChanged = (): void => {
    this.props.onChangeSSLCA();
  };

  /**
   * Handles sslCert change.
   */
  onClientCertificateChanged = (): void => {
    this.props.onChangeSSLCertificate();
  };

  /**
   * Handles sslKey change.
   */
  onClientPrivateKeyChanged = (): void => {
    this.props.onChangeSSLPrivateKey();
  };

  /**
   * Handles sslPass change.
   *
   * @param {Object} evt - evt.
   */
  onClientKeyPasswordChanged = (evt): void => {
    this.props.sslPrivateKeyPasswordChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { isValid, sslCA, sslCert, sslKey, sslPass } = this.props;

    return (
      <div
        id="ssl-server-client-validation"
        className={classnames(styles['form-group'])}
      >
        <FileInputButton
          label="Certificate Authority"
          id="sslCA"
          error={!isValid && sslCA === undefined}
          onClick={this.onCertificateAuthorityChanged}
          values={sslCA}
          link="https://docs.mongodb.com/manual/tutorial/configure-ssl/#certificate-authorities"
          multi
        />
        <FileInputButton
          label="Client Certificate"
          id="sslCert"
          error={!isValid && sslCert === undefined}
          onClick={this.onClientCertificateChanged}
          values={sslCert}
          link="https://docs.mongodb.com/manual/tutorial/configure-ssl/#pem-file"
        />
        <FileInputButton
          label="Client Private Key"
          id="sslKey"
          error={!isValid && sslKey === undefined}
          onClick={this.onClientPrivateKeyChanged}
          values={sslKey}
          link="https://docs.mongodb.com/manual/tutorial/configure-ssl/#pem-file"
        />
        <FormInput
          label="Client Key Password"
          name="sslPass"
          type="password"
          changeHandler={this.onClientKeyPasswordChanged}
          value={sslPass || ''}
          // Opens documentation about net.ssl.PEMKeyPassword.
          linkTo="https://docs.mongodb.com/manual/reference/configuration-options/#net.ssl.PEMKeyPassword"
        />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): stateProps => {
  return {
    isValid: state.isValid,
    sslCA: state.currentConnection.sslCA,
    sslCert: state.currentConnection.sslCert,
    sslKey: state.currentConnection.sslKey,
    sslPass: state.currentConnection.sslPass
  };
};

const mapDispatchToProps: dispatchProps = {
  onChangeSSLCA: (): OnChangeSSLCAAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CA
  }),
  onChangeSSLCertificate: (): OnChangeSSLCertAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CERT
  }),
  onChangeSSLPrivateKey: (): OnChangeSSLKeyAction => ({
    type: ActionTypes.ON_CHANGE_SSL_KEY
  }),
  sslPrivateKeyPasswordChanged: (newSSLPass: string): SSLPassChangedAction => ({
    type: ActionTypes.SSL_PASS_CHANGED,
    sslPass: newSSLPass
  })
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSLServerClientValidation);
