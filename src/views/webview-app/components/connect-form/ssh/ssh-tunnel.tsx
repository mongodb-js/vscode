import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, SSHTunnelChangedAction } from '../../../store/actions';
import SSH_TUNNEL_TYPES, {
  SSHTunnelOptions,
} from '../../../connection-model/constants/ssh-tunnel-types';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';
import SSHTunnelPasswordValidation from './ssh-tunnel-password-validation';
import SSHTunnelIdentityFileValidation from './ssh-tunnel-identity-file-validation';

type DispatchProps = {
  onSSHTunnelChanged: (sshTunnel: SSH_TUNNEL_TYPES) => void;
};

type props = {
  sshTunnel: string;
} & DispatchProps;

class SSHTunnel extends React.Component<props> {
  static displayName = 'SSHTunnel';

  /**
   * Handles SSH tunnel change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelChanged = (evt): void => {
    this.props.onSSHTunnelChanged(evt.target.value);
  };

  /**
   * Renders an SSL tunnel.
   *
   * @returns {React.Component}
   */
  renderSSHTunnel(): React.ReactNode {
    const { sshTunnel } = this.props;

    if (sshTunnel === SSH_TUNNEL_TYPES.USER_PASSWORD) {
      return <SSHTunnelPasswordValidation />;
    }

    if (sshTunnel === SSH_TUNNEL_TYPES.IDENTITY_FILE) {
      return <SSHTunnelIdentityFileValidation />;
    }
  }

  render(): React.ReactNode {
    const { sshTunnel } = this.props;

    return (
      <FormGroup id="ssh-tunnel" separator>
        <FormItemSelect
          label="SSH Tunnel"
          name="sshTunnel"
          options={SSHTunnelOptions.map((sshTunnelOption) => ({
            [`${sshTunnelOption.id}`]: sshTunnelOption.title,
          }))}
          changeHandler={this.onSSHTunnelChanged}
          value={sshTunnel}
        />
        {this.renderSSHTunnel()}
      </FormGroup>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onSSHTunnelChanged: (newSSHTunnel): SSHTunnelChangedAction => ({
    type: ActionTypes.SSH_TUNNEL_CHANGED,
    sshTunnel: newSSHTunnel,
  }),
};

export default connect(null, mapDispatchToProps)(SSHTunnel);
