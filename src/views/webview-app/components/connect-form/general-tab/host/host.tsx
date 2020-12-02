import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  HostnameChangedAction,
  HostsChangedAction,
  IsSrvRecordToggledAction,
  PortChangedAction,
  ReplicaSetChangedAction
} from '../../../../store/actions';
import FormInput from '../../../form/form-input';
import { AppState } from '../../../../store/store';
import FormGroup from '../../../form/form-group';
import RadioBoxGroup from '../../../form/radio-box-group/radio-box-group';
import { DEFAULT_HOST, Host } from '../../../../connection-model/connection-model';
import ReplicaSetInput from './replica-set-input';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

const styles = require('./host.less');

enum CONNECTION_TYPE {
  STANDALONE = 'STANDALONE',
  REPLICA_SET = 'REPLICA_SET',
  SRV_RECORD = 'SRV_RECORD'
}

const CONNECTION_TYPE_OPTIONS: {
  [connectionType in CONNECTION_TYPE]: {
    label: string;
    value: CONNECTION_TYPE;
  }
} = {
  [CONNECTION_TYPE.STANDALONE]: {
    label: 'Standalone',
    value: CONNECTION_TYPE.STANDALONE
  },
  [CONNECTION_TYPE.REPLICA_SET]: {
    label: 'Replica Set',
    value: CONNECTION_TYPE.REPLICA_SET
  },
  [CONNECTION_TYPE.SRV_RECORD]: {
    label: 'SRV',
    value: CONNECTION_TYPE.SRV_RECORD
  }
};

type StateProps = {
  hostname: string;
  hosts: Host[];
  isSrvRecord: boolean;
  port: number;
  replicaSet?: string;
};

type DispatchProps = {
  onHostnameChanged: (newHostName: string) => void;
  onPortChanged: (newPort: number) => void;
  setReplicaSet: (replicaSet?: string) => void;
  toggleSRVRecord: () => void;
  updateHosts: (hosts: Host[]) => void;
};

export class HostInput extends React.PureComponent<StateProps & DispatchProps> {
  onConnectionTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    switch (event.target.value as CONNECTION_TYPE) {
      case CONNECTION_TYPE.STANDALONE:
        this.props.setReplicaSet();
        if (this.props.hosts.length > 1) {
          // Remove extra hosts when moving to standalone from replica set.
          this.props.updateHosts(this.props.hosts.slice(0, 1));
        }
        if (this.props.isSrvRecord) {
          this.props.toggleSRVRecord();
        }

        break;
      case CONNECTION_TYPE.REPLICA_SET:
        if (this.props.replicaSet === undefined) {
          this.props.setReplicaSet('');
        }
        if (this.props.isSrvRecord) {
          this.props.toggleSRVRecord();
        }

        break;
      case CONNECTION_TYPE.SRV_RECORD:
        this.props.setReplicaSet();

        if (!this.props.isSrvRecord) {
          this.props.toggleSRVRecord();
        }
        break;
      default:
        break;
    }
  };

  onHostChanged = (updatedHost, hostIndex): void => {
    const { hosts } = this.props;

    const newHosts = [ ...hosts ];

    newHosts[hostIndex] = updatedHost;

    this.props.updateHosts(newHosts);
  };

  onAddNewHost = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();

    const { hosts, replicaSet } = this.props;

    this.props.updateHosts([
      ...hosts,
      {
        ...DEFAULT_HOST
      }
    ]);

    if (!replicaSet) {
      this.props.setReplicaSet('');
    }
  };

  onHostnameChanged = (event): void => {
    this.props.onHostnameChanged(event.target.value);
  };

  onPortChanged = (event): void => {
    this.props.onPortChanged(event.target.value.trim());
  };

  onRemoveHost = (
    event: React.MouseEvent<HTMLButtonElement>,
    hostIndex: number
  ): void => {
    event.preventDefault();

    const { hosts } = this.props;

    const newHosts = [ ...hosts ];
    newHosts.splice(hostIndex, 1);

    this.props.updateHosts(newHosts);
  };

  getCurrentConnectionType = (): CONNECTION_TYPE => {
    const {
      isSrvRecord,
      replicaSet
    } = this.props;

    if (isSrvRecord) {
      return CONNECTION_TYPE.SRV_RECORD;
    } else if (replicaSet !== undefined) {
      return CONNECTION_TYPE.REPLICA_SET;
    }

    return CONNECTION_TYPE.STANDALONE;
  };

  renderConnectionTypeOptions(): React.ReactNode {
    return (
      <RadioBoxGroup
        label="Connection Type"
        name="connectionType"
        options={Object.values(CONNECTION_TYPE_OPTIONS)}
        onChange={this.onConnectionTypeChange}
        value={this.getCurrentConnectionType()}
      />
    );
  }

  renderStandaloneHost(): React.ReactNode {
    const {
      hostname,
      port
    } = this.props;

    return (
      <div
        className={styles['host-input-area']}
      >
        <FormInput
          className={styles['host-input-host']}
          label="Hostname"
          name="hostname"
          placeholder="localhost"
          changeHandler={this.onHostnameChanged}
          value={hostname}
        />
        <FormInput
          className={styles['host-input-port']}
          label="Port"
          name="host-port"
          placeholder="27017"
          changeHandler={this.onPortChanged}
          type="number"
          value={port}
        />
        <button
          className={`${styles['host-add-host-button']} ${styles['first-host']}`}
          onClick={this.onAddNewHost}
        >
          <FontAwesomeIcon
            icon={faPlus}
          />
        </button>
      </div>
    );
  }

  renderReplicaSetOptions(): React.ReactNode {
    const {
      hosts
    } = this.props;

    return (
      <React.Fragment>
        {hosts.map((host, index) => (
          <div
            className={styles['host-input-area']}
            key={`host-${index}`}
          >
            <FormInput
              className={styles['host-input-host']}
              label={index === 0 ? 'Hostname' : undefined}
              name={`host-name-${index}`}
              placeholder="localhost"
              changeHandler={(event: React.ChangeEvent<HTMLInputElement>): void => this.onHostChanged({
                host: event.target.value,
                port: host.port
              }, index)}
              value={host.host}
            />
            <FormInput
              className={styles['host-input-port']}
              label={index === 0 ? 'Port' : undefined}
              name={`host-port-${index}`}
              placeholder="27017"
              changeHandler={(event: React.ChangeEvent<HTMLInputElement>): void => this.onHostChanged({
                host: host.host,
                port: event.target.value
              }, index)}
              value={host.port}
              type="number"
            />
            <button
              className={classnames(styles['host-add-host-button'], {
                [styles['first-host']]: index === 0
              })}
              onClick={this.onAddNewHost}
            >
              <FontAwesomeIcon
                icon={faPlus}
              />
            </button>
            {hosts.length > 1 && (<button
              className={classnames(styles['host-remove-host-button'], {
                [styles['first-host']]: index === 0
              })}
              onClick={(event): void => this.onRemoveHost(event, index)}
            >
              <FontAwesomeIcon
                icon={faMinus}
              />
            </button>)}
          </div>
        ))}
        <ReplicaSetInput />
      </React.Fragment>
    );
  }

  renderSRVRecordHost(): React.ReactNode {
    const { hostname } = this.props;

    return (
      <FormInput
        label="Hostname"
        name="hostname"
        placeholder="localhost"
        changeHandler={this.onHostnameChanged}
        value={hostname}
      />
    );
  }

  renderConnectionType(): React.ReactNode {
    switch (this.getCurrentConnectionType()) {
      case CONNECTION_TYPE.STANDALONE:
        return this.renderStandaloneHost();
      case CONNECTION_TYPE.REPLICA_SET:
        return this.renderReplicaSetOptions();
      case CONNECTION_TYPE.SRV_RECORD:
        return this.renderSRVRecordHost();
      default:
        break;
    }
  }

  render(): React.ReactNode {
    return (
      <FormGroup id="connection-host-information" separator>
        {this.renderConnectionTypeOptions()}
        {this.renderConnectionType()}
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    hostname: state.currentConnection.hostname,
    hosts: state.currentConnection.hosts,
    isSrvRecord: state.currentConnection.isSrvRecord,
    port: state.currentConnection.port,
    replicaSet: state.currentConnection.replicaSet
  };
};

const mapDispatchToProps: DispatchProps = {
  onHostnameChanged: (newHostname: string): HostnameChangedAction => ({
    type: ActionTypes.HOSTNAME_CHANGED,
    hostname: newHostname
  }),
  onPortChanged: (port: number): PortChangedAction => ({
    type: ActionTypes.PORT_CHANGED,
    port
  }),
  setReplicaSet: (replicaSet?: string): ReplicaSetChangedAction => ({
    type: ActionTypes.REPLICA_SET_CHANGED,
    replicaSet
  }),
  toggleSRVRecord: (): IsSrvRecordToggledAction => ({
    type: ActionTypes.IS_SRV_RECORD_TOGGLED
  }),
  updateHosts: (hosts: Host[]): HostsChangedAction => ({
    type: ActionTypes.HOSTS_CHANGED,
    hosts
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(HostInput);
