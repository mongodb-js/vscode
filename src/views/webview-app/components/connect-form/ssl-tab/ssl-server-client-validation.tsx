import * as React from 'react';
import { connect } from 'react-redux';

import FileInputButton from '../../form/file-input-button';
import FormInput from '../../form/form-input';
import {
  ActionTypes,
  OnChangeSSLCAAction,
  OnChangeSSLCertAction,
  SSLPassChangedAction,
} from '../../../store/actions';
import { AppState } from '../../../store/store';

const styles = require('../../../connect.module.less');

type StateProps = {
  isValid: boolean;
  sslCA?: string[];
  sslCert?: string[];
  sslPass?: string;
};

type DispatchProps = {
  onChangeSSLCA: () => void;
  onChangeSSLCertificate: () => void;
  sslPrivateKeyPasswordChanged: (newSSLPass: string) => void;
};

type props = StateProps & DispatchProps;

class SSLServerClientValidation extends React.Component<props> {
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
   * Handles sslPass change.
   *
   * @param {Object} evt - evt.
   */
  onClientKeyPasswordChanged = (evt): void => {
    this.props.sslPrivateKeyPasswordChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const { isValid, sslCA, sslCert, sslPass } = this.props;

    return (
      <div id="ssl-server-client-validation" className={styles['form-group']}>
        <FileInputButton
          label="Certificate Authority (.pem)"
          id="sslCA"
          error={!isValid && sslCA === undefined}
          onClick={this.onCertificateAuthorityChanged}
          values={sslCA}
          link="https://docs.mongodb.com/manual/tutorial/configure-ssl/#certificate-authorities"
        />
        <FileInputButton
          label="Client Certificate and Key (.pem)"
          id="sslCert"
          error={!isValid && sslCert === undefined}
          onClick={this.onClientCertificateChanged}
          values={sslCert}
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

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isValid: state.isValid,
    sslCA: state.currentConnection.sslCA,
    sslCert: state.currentConnection.sslCert,
    sslPass: state.currentConnection.sslPass,
  };
};

const mapDispatchToProps: DispatchProps = {
  onChangeSSLCA: (): OnChangeSSLCAAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CA,
  }),
  onChangeSSLCertificate: (): OnChangeSSLCertAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CERT,
  }),
  sslPrivateKeyPasswordChanged: (newSSLPass: string): SSLPassChangedAction => ({
    type: ActionTypes.SSL_PASS_CHANGED,
    sslPass: newSSLPass,
  }),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSLServerClientValidation);
