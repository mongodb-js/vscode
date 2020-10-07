import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  SSHTunnelHostnameChangedAction,
  SSHTunnelPasswordChangedAction,
  SSHTunnelPortChangedAction,
  SSHTunnelUsernameChangedAction,
} from '../../../store/actions';
import { AppState } from '../../../store/store';
import FormInput from '../form-input';
import FormGroup from '../form-group';

type DispatchProps = {
  onSSHTunnelHostnameChanged: (sshTunnelHostname: string) => void;
  onSSHTunnelPasswordChanged: (sshTunnelPassword: string) => void;
  onSSHTunnelPortChanged: (sshTunnelPort: number) => void;
  onSSHTunnelUsernameChanged: (sshTunnelUsername: string) => void;
};

type StateProps = {
  isValid: boolean;
  sshTunnelHostname?: string;
  sshTunnelPassword?: string;
  sshTunnelPort: number;
  sshTunnelUsername?: string;
};

type props = StateProps & DispatchProps;

class SSHTunnelPasswordValidation extends React.Component<props> {
  static displayName = 'SSHTunnelPasswordValidation';

  /**
   * Handles sshTunnelHostname change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelHostnameChanged = (evt) => {
    this.props.onSSHTunnelHostnameChanged(evt.target.value);
  };

  /**
   * Handles sshTunnelUsername change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelUsernameChanged = (evt) => {
    this.props.onSSHTunnelUsernameChanged(evt.target.value.trim());
  };

  /**
   * Handles sshTunnelPassword change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelPasswordChanged = (evt) => {
    this.props.onSSHTunnelPasswordChanged(evt.target.value);
  };

  /**
   * Handles sshTunnelPort change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelPortChanged = (evt) => {
    this.props.onSSHTunnelPortChanged(evt.target.value);
  };

  render() {
    const {
      isValid,
      sshTunnelHostname,
      sshTunnelPassword,
      sshTunnelPort,
      sshTunnelUsername,
    } = this.props;

    return (
      <FormGroup id="sshTunnelPassword">
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
          error={!isValid && sshTunnelPort === undefined}
          changeHandler={this.onSSHTunnelPortChanged}
          value={sshTunnelPort}
          type="number"
        />
        <FormInput
          label="SSH Username"
          name="sshTunnelUsername"
          error={!isValid && sshTunnelUsername === undefined}
          changeHandler={this.onSSHTunnelUsernameChanged}
          value={sshTunnelUsername || ''}
        />
        <FormInput
          label="SSH Password"
          name="sshTunnelPassword"
          type="password"
          error={!isValid && sshTunnelPassword === undefined}
          changeHandler={this.onSSHTunnelPasswordChanged}
          value={sshTunnelPassword || ''}
        />
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isValid: state.isValid,
    sshTunnelHostname: state.currentConnection.sshTunnelHostname,
    sshTunnelPassword: state.currentConnection.sshTunnelPassword,
    sshTunnelPort: state.currentConnection.sshTunnelPort,
    sshTunnelUsername: state.currentConnection.sshTunnelUsername,
  };
};

const mapDispatchToProps: DispatchProps = {
  onSSHTunnelHostnameChanged: (
    sshTunnelHostname: string
  ): SSHTunnelHostnameChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_HOSTNAME_CHANGED,
    sshTunnelHostname,
  }),
  onSSHTunnelPasswordChanged: (
    sshTunnelPassword: string
  ): SSHTunnelPasswordChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_PASSWORD_CHANGED,
    sshTunnelPassword,
  }),
  onSSHTunnelPortChanged: (
    sshTunnelPort: number
  ): SSHTunnelPortChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_PORT_CHANGED,
    sshTunnelPort,
  }),
  onSSHTunnelUsernameChanged: (
    sshTunnelUsername: string
  ): SSHTunnelUsernameChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_USERNAME_CHANGED,
    sshTunnelUsername,
  }),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSHTunnelPasswordValidation);
