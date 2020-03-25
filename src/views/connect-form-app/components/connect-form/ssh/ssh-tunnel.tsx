import * as React from 'react';

import Actions from '../../../store/actions';
import { SSHTunnelOptions } from '../../../store/ssh-tunnel-options';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';

type props = {
  sshTunnel: string;
};

class SSHTunnel extends React.Component<props> {
  static displayName = 'SSHTunnel';

  /**
   * Handles SSH tunnel change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelChanged(evt): void {
    Actions.onSSHTunnelChanged(evt.target.value);
  }

  /**
   * Renders an SSL tunnel.
   *
   * @returns {React.Component}
   */
  renderSSHTunnel(): React.ReactNode {
    // const currentRole = this.roles.find(
    //   role => role.name === this.state.sshTunnel
    // );

    // if (currentRole.component) {
    //   return <currentRole.component {...this.props} />;
    // }

    return (
      <div>
        TODO: Render SSH Tunnel component.
      </div>
    );
  }

  render(): React.ReactNode {
    const {
      sshTunnel
    } = this.props;

    return (
      <FormGroup id="ssh-tunnel" separator>
        <FormItemSelect
          label="SSH Tunnel"
          name="sshTunnel"
          options={SSHTunnelOptions.map(sshTunnelOption => ({
            [`${sshTunnelOption.id}`]: sshTunnelOption.title
          }))}
          changeHandler={this.onSSHTunnelChanged.bind(this)}
          value={sshTunnel}
        />
        {this.renderSSHTunnel()}
      </FormGroup>
    );
  }
}

export default SSHTunnel;
