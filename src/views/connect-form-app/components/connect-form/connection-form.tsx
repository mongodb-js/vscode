import React, { Component, ReactNode } from 'react';
import classnames from 'classnames';

import Actions from '../../store/actions';
import FormGroup from './form-group';
import HostInput from './host/host-input';
import PortInput from './host/port-input';
import SRVInput from './host/srv-input';
import Authentication from './authentication/authentication';
import ReplicaSetInput from './replica-set-input';
import ReadPreferenceSelect from './read-preference-select';
import SSLMethod from './ssl/ssl-method';
import SSHTunnel from './ssh/ssh-tunnel';
import FormActions from './form-actions';

import styles from '../connect.less';

type props = {
  currentConnection: any; // TODO: Connection model type.
  isHostChanged: boolean; // optional?
  isPortChanged: boolean; // optional?
  isValid: boolean;
};
type state = { activeTab: number };

class ConnectionForm extends Component<props, state> {
  static displayName = 'ConnectionForm';

  tabs: string[];

  constructor(props) {
    super(props);
    this.state = { activeTab: 0 };
    this.tabs = ['Hostname', 'More Options'];
  }

  /**
   * Resests URL validation if form was changed.
   */
  onConnectionFormChanged(): void {
    Actions.onConnectionFormChanged();
  }

  /**
   * Handles the tab click.
   *
   * @param {Number} activeTab - The index of the clicked tab.
   * @param {Object} evt - evt.
   */
  onTabClicked(activeTab, evt): void {
    evt.preventDefault();

    if (this.state.activeTab === activeTab) {
      return;
    }

    this.setState({ activeTab });
  }

  /**
   * Renders a port input.
   *
   * @returns {React.Component}
   */
  renderPort(): ReactNode {
    if (!this.props.currentConnection.isSrvRecord) {
      return (
        <PortInput
          port={this.props.currentConnection.port}
          isPortChanged={this.props.isPortChanged}
        />
      );
    }
  }

  /**
   * Renders tabs.
   *
   * @returns {React.Component}
   */
  renderTabs(): ReactNode {
    return (
      <div className={classnames(styles['tabs-header'])}>
        <ul className={classnames(styles['tabs-header-items'])}>
          {this.tabs.map((name, key) => {
            const liClassName = classnames({
              [styles['tabs-header-item']]: true,
              [styles['selected-header-item']]: (this.state.activeTab === key)
            });
            const spanClassName = classnames({
              [styles['tabs-header-item-name']]: true,
              [styles['selected-header-item-name']]: (this.state.activeTab === key)
            });

            return (
              <li
                id={name.replace(/ /g, '_')}
                key={`tab-${name}`}
                data-test-id={`${name.toLowerCase().replace(/ /g, '-')}-tab`}
                onClick={this.onTabClicked.bind(this, key)}
                className={liClassName}
              >
                <span className={spanClassName}>{name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /**
   * Renders views.
   *
   * @returns {React.Component}
   */
  renderView(): ReactNode {
    if (this.state.activeTab === 0) {
      return (
        <div className={classnames(styles['tabs-view'])}>
          <div className={classnames(styles['tabs-view-content'])}>
            <div className={classnames(styles['tabs-view-content-form'])}>
              <FormGroup separator>
                <HostInput
                  hostname={this.props.currentConnection.hostname}
                  isHostChanged={this.props.isHostChanged}
                />
                {this.renderPort()}
                <SRVInput isSrvRecord={this.props.currentConnection.isSrvRecord} />
              </FormGroup>
              <Authentication
                currentConnection={this.props.currentConnection}
                isValid={this.props.isValid}
              />
            </div>
          </div>
        </div>
      );
    }

    if (this.state.activeTab === 1) {
      return (
        <div className={classnames(styles['tabs-view'])}>
          <div className={classnames(styles['tabs-view-content'])}>
            <div className={classnames(styles['tabs-view-content-form'])}>
              <FormGroup id="read-preference" separator>
                <ReplicaSetInput
                  sshTunnel={this.props.currentConnection.sshTunnel}
                  replicaSet={this.props.currentConnection.replicaSet} />
                <ReadPreferenceSelect
                  readPreference={this.props.currentConnection.readPreference} />
              </FormGroup>
              <SSLMethod {...this.props} />
              <SSHTunnel {...this.props} />
            </div>
          </div>
        </div>
      );
    }
  }

  render(): ReactNode {
    return (
      <form
        onChange={this.onConnectionFormChanged.bind(this)}
        className={classnames(styles['connect-form'])} >
        <div className={classnames(styles.tabs)}>
          <div className={classnames(styles['tabs-container'])}>
            {this.renderTabs()}
            {this.renderView()}
          </div>
        </div>
        <FormActions {...this.props} />
      </form>
    );
  }
}

export default ConnectionForm;
