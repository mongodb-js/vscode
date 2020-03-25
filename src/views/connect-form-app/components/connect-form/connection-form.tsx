import * as React from 'react';
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

import styles from '../../connect.less';

type props = {
  currentConnection: any; // TODO: Connection model type.
  errorMessage: string;
  hasUnsavedChanges: boolean;
  isConnected: boolean;
  isHostChanged: boolean;
  isPortChanged: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};
type state = { activeTab: number };

class ConnectionForm extends React.Component<props, state> {
  static displayName = 'ConnectionForm';

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

  tabs: string[];

  /**
   * Renders a port input.
   *
   * @returns {React.Component}
   */
  renderPort(): React.ReactNode {
    const {
      currentConnection,
      isPortChanged
    } = this.props;

    const {
      isSrvRecord,
      port
    } = currentConnection;

    if (!isSrvRecord) {
      return (
        <PortInput
          port={port}
          isPortChanged={isPortChanged}
        />
      );
    }
  }

  /**
   * Renders tabs.
   *
   * @returns {React.Component}
   */
  renderTabs(): React.ReactNode {
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

  renderHostnameTab(): React.ReactNode {
    const {
      currentConnection,
      isHostChanged,
      isValid
    } = this.props;

    const {
      authStrategy,
      hostname,
      isSrvRecord
    } = currentConnection;

    return (
      <div className={classnames(styles['tabs-view'])}>
        <div className={classnames(styles['tabs-view-content'])}>
          <div className={classnames(styles['tabs-view-content-form'])}>
            <FormGroup id="connection-host-information" separator >
              <HostInput
                hostname={hostname}
                isHostChanged={isHostChanged}
              />
              {this.renderPort()}
              <SRVInput isSrvRecord={isSrvRecord} />
            </FormGroup>
            <Authentication
              authStrategy={authStrategy}
              isValid={isValid}
            />
          </div>
        </div>
      </div>
    );
  }

  renderConnectionOptionsTab(): React.ReactNode {
    const {
      currentConnection
    } = this.props;

    const {
      readPreference,
      replicaSet,
      sshTunnel,
      sslMethod
    } = currentConnection;

    return (
      <div className={classnames(styles['tabs-view'])}>
        <div className={classnames(styles['tabs-view-content'])}>
          <div className={classnames(styles['tabs-view-content-form'])}>
            <FormGroup id="read-preference" separator>
              <ReplicaSetInput
                sshTunnel={sshTunnel}
                replicaSet={replicaSet}
              />
              <ReadPreferenceSelect
                readPreference={readPreference}
              />
            </FormGroup>
            <SSLMethod
              sslMethod={sslMethod}
            />
            <SSHTunnel
              sshTunnel={sshTunnel}
            />
          </div>
        </div>
      </div>
    );
  }

  /**
   * Renders views.
   *
   * @returns {React.Component}
   */
  renderView(): React.ReactNode {
    if (this.state.activeTab === 0) {
      return this.renderHostnameTab();
    }

    if (this.state.activeTab === 1) {
      return this.renderConnectionOptionsTab();
    }
  }

  render(): React.ReactNode {
    const {
      currentConnection,
      errorMessage,
      hasUnsavedChanges,
      isConnected,
      isValid,
      syntaxErrorMessage
    } = this.props;

    return (
      <form
        onChange={this.onConnectionFormChanged.bind(this)}
        className={classnames(styles['connect-form'])}
      >
        <div className={classnames(styles.tabs)}>
          <div className={classnames(styles['tabs-container'])}>
            {this.renderTabs()}
            {this.renderView()}
          </div>
        </div>
        <FormActions
          currentConnection={currentConnection}
          errorMessage={errorMessage}
          hasUnsavedChanges={hasUnsavedChanges}
          isConnected={isConnected}
          isValid={isValid}
          syntaxErrorMessage={syntaxErrorMessage}
        />
      </form>
    );
  }
}

export default ConnectionForm;
