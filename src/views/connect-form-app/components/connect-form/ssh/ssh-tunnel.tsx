import React, { Component, ReactNode } from 'react';

import Actions from '../../../store/actions';
import { SSHTunnelOptions } from '../../../store/store';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';

// static propTypes = { currentConnection: PropTypes.object.isRequired };
type props = {
  sshTunnel: string;
};

class SSHTunnel extends Component<props> {
  static displayName = 'SSHTunnel';

  // constructor(props) {
  //   super(props);
  //   this.setupSSHTunnelRoles();
  //   this.state = { sshTunnel: props.currentConnection.sshTunnel };
  // }

  // componentWillReceiveProps(nextProps) {
  //   const sshMethod = nextProps.currentConnection.sshTunnel;

  //   if (sshMethod !== this.state.sshTunnel) {
  //     this.setState({ sshTunnel: sshMethod });
  //   }
  // }

  /**
   * Handles SSH tunnel change.
   *
   * @param {Object} evt - evt.
   */
  onSSHTunnelChanged(evt): void {
    // this.setState({ sshTunnel: evt.target.value });
    Actions.onSSHTunnelChanged(evt.target.value);
  }

  /**
   * Sets options for an SSH tunnel.
   */
  // setupSSHTunnelRoles(): {
  //   this.roles = global.hadronApp.appRegistry.getRole('Connect.SSHTunnel');
  //   this.selectOptions = this.roles.map(role => role.selectOption);
  // }

  /**
   * Renders an SSL tunnel.
   *
   * @returns {React.Component}
   */
  renderSSHTunnel(): ReactNode {
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

  render(): ReactNode {
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
