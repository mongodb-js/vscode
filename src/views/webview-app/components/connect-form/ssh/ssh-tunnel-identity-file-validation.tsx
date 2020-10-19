import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  OnChangeSSHTunnelIdentityFileAction,
  SSHTunnelHostnameChangedAction,
  SSHTunnelPassphraseChangedAction,
  SSHTunnelPortChangedAction,
  SSHTunnelUsernameChangedAction
} from '../../../store/actions';
import { AppState } from '../../../store/store';
import FormInput from '../../form/form-input';
import FileInputButton from '../../form/file-input-button';
import FormGroup from '../../form/form-group';

type DispatchProps = {
  onChangeSSHTunnelIdentityFile: () => void;
  onSSHTunnelHostnameChanged: (sshTunnelHostname: string) => void;
  onSSHTunnelPassphraseChanged: (sshTunnelPassphrase: string) => void;
  onSSHTunnelPortChanged: (sshTunnelPort: number) => void;
  onSSHTunnelUsernameChanged: (sshTunnelUsername: string) => void;
};

type StateProps = {
  isValid: boolean;
  sshTunnelHostname?: string;
  sshTunnelIdentityFile?: string[];
  sshTunnelPassphrase?: string;
  sshTunnelPort: number;
  sshTunnelUsername?: string;
};

type props = StateProps & DispatchProps;

class SSHTunnelIdentityFileValidation extends React.Component<props> {
  static displayName = 'SSHTunnelIdentityFileValidation';

  /**
   * Handles sshTunnelHostname change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelHostnameChanged = (evt): void => {
    this.props.onSSHTunnelHostnameChanged(evt.target.value);
  };

  /**
   * Handles sshTunnelUsername change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelUsernameChanged = (evt): void => {
    this.props.onSSHTunnelUsernameChanged(evt.target.value.trim());
  };

  /**
   * Handles sshTunnelIdentityFile change.
   *
   * @param {Object} evt - evt.
   */
  onChangeSSHTunnelIdentityFile = (): void => {
    this.props.onChangeSSHTunnelIdentityFile();
  };

  /**
   * Handles sshTunnelPassphrase change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelPassphraseChanged = (evt): void => {
    this.props.onSSHTunnelPassphraseChanged(evt.target.value);
  };

  /**
   * Handles sshTunnelPort change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelPortChanged = (evt): void => {
    this.props.onSSHTunnelPortChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const {
      isValid,
      sshTunnelHostname,
      sshTunnelIdentityFile,
      sshTunnelPassphrase,
      sshTunnelPort,
      sshTunnelUsername
    } = this.props;

    return (
      <FormGroup id="sshTunnelIdentityFileValidation">
        <FormInput
          label="SSH Hostname"
          name="sshTunnelHostname"
          error={!isValid && sshTunnelHostname === undefined}
          changeHandler={this.onSSHTunnelHostnameChanged}
          value={sshTunnelHostname || ''}
          linkTo="https://docs.mongodb.com/compass/current/connect"
        />
        <FormInput
          label="SSH Tunnel Port"
          name="sshTunnelPort"
          placeholder="22"
          error={!isValid && sshTunnelPort === undefined}
          changeHandler={this.onSSHTunnelPortChanged}
          value={sshTunnelPort}
        />
        <FormInput
          label="SSH Username"
          name="sshTunnelUsername"
          error={!isValid && sshTunnelUsername === undefined}
          changeHandler={this.onSSHTunnelUsernameChanged}
          value={sshTunnelUsername || ''}
        />
        <FileInputButton
          label="SSH Identity File"
          id="sshTunnelIdentityFile"
          error={!isValid && sshTunnelIdentityFile === undefined}
          onClick={this.onChangeSSHTunnelIdentityFile}
          values={sshTunnelIdentityFile}
        />
        <FormInput
          label="SSH Passphrase"
          name="sshTunnelPassphrase"
          type="password"
          changeHandler={this.onSSHTunnelPassphraseChanged.bind(this)}
          value={sshTunnelPassphrase || ''}
        />
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isValid: state.isValid,
    sshTunnelHostname: state.currentConnection.sshTunnelHostname,
    sshTunnelIdentityFile: state.currentConnection.sshTunnelIdentityFile,
    sshTunnelPassphrase: state.currentConnection.sshTunnelPassphrase,
    sshTunnelPort: state.currentConnection.sshTunnelPort,
    sshTunnelUsername: state.currentConnection.sshTunnelUsername
  };
};

const mapDispatchToProps: DispatchProps = {
  onChangeSSHTunnelIdentityFile: (): OnChangeSSHTunnelIdentityFileAction => ({
    type: ActionTypes.ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE
  }),
  onSSHTunnelHostnameChanged: (
    sshTunnelHostname: string
  ): SSHTunnelHostnameChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_HOSTNAME_CHANGED,
    sshTunnelHostname
  }),
  onSSHTunnelPassphraseChanged: (
    sshTunnelPassphrase: string
  ): SSHTunnelPassphraseChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_PASSPHRASE_CHANGED,
    sshTunnelPassphrase
  }),
  onSSHTunnelPortChanged: (
    sshTunnelPort: number
  ): SSHTunnelPortChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_PORT_CHANGED,
    sshTunnelPort
  }),
  onSSHTunnelUsernameChanged: (
    sshTunnelUsername: string
  ): SSHTunnelUsernameChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_USERNAME_CHANGED,
    sshTunnelUsername
  })
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSHTunnelIdentityFileValidation);
