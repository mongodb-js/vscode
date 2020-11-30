import * as React from 'react';
import { connect } from 'react-redux';

import FormGroup from '../../form/form-group';
import HostInput from './host-input';
import PortInput from './port-input';
import FormInput from '../../form/form-input';
import Authentication from './authentication/authentication';
import {
  ActionTypes,
  HostsChangedAction,
  IsSrvRecordToggledAction,
  ReplicaSetChangedAction
} from '../../../store/actions';
import { AppState } from '../../../store/store';
import { Host } from '../../../connection-model/connection-model';
import RadioBoxGroup from '../../form/radio-box-group/radio-box-group';

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
  connectionMessage: string;
  errorMessage: string;
  hosts: Host[];
  isConnected: boolean;
  isConnecting: boolean;
  isSrvRecord: boolean;
  isValid: boolean;
  replicaSet?: string;
  syntaxErrorMessage: string;
};

type DispatchProps = {
  setReplicaSet: (replicaSet?: string) => void;
  toggleSRVRecord: () => void;
  updateHosts: (hosts: Host[]) => void;
};

export class GeneralTab extends React.Component<StateProps & DispatchProps> {
  onConnectionTypeChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    switch (evt.target.value as CONNECTION_TYPE) {
      case CONNECTION_TYPE.STANDALONE:
        this.props.setReplicaSet();
        if (this.props.hosts.length > 1) {
          // Remove extra hosts when moving to standalone from replica set.
          this.props.updateHosts(this.props.hosts.slice(0, 1));
        }

        break;
      case CONNECTION_TYPE.REPLICA_SET:
        if (this.props.replicaSet === undefined) {
          this.props.setReplicaSet('');
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
  }

  getCurrentConnectionType(): CONNECTION_TYPE {
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
  }

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
    return (
      <React.Fragment>
        <HostInput />
        <PortInput />
      </React.Fragment>
    );
  }

  renderReplicaSetHosts(): React.ReactNode {
    const {
      hosts
    } = this.props;

    return hosts.map((host, index) => (
      <div
        key={`host-${index}-${host.host}-${host.port}`}
      >
        <FormInput
          label="Hostname"
          name={`hostname-${index}`}
          placeholder="localhost"
          changeHandler={this.onHostnameChanged}
          value={host.host}
        />
      </div>
    ));
  }

  renderSRVRecordHost(): React.ReactNode {
    return (
      <HostInput />
    );
  }

  renderConnectionType(): React.ReactNode {
    switch (this.getCurrentConnectionType()) {
      case CONNECTION_TYPE.STANDALONE:
        return this.renderStandaloneHost();
      case CONNECTION_TYPE.REPLICA_SET:
        return this.renderReplicaSetHosts();
      case CONNECTION_TYPE.SRV_RECORD:
        return this.renderSRVRecordHost();
      default:
        break;
    }
  }

  render(): React.ReactNode {
    return (
      <React.Fragment>
        <FormGroup id="connection-host-information" separator>
          {this.renderConnectionTypeOptions()}
          {this.renderConnectionType()}
        </FormGroup>
        <Authentication />
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionMessage: state.connectionMessage,
    errorMessage: state.errorMessage,
    hosts: state.currentConnection.hosts,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isSrvRecord: state.currentConnection.isSrvRecord,
    isValid: state.isValid,
    replicaSet: state.currentConnection.replicaSet,
    syntaxErrorMessage: state.syntaxErrorMessage
  };
};

const mapDispatchToProps: DispatchProps = {
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

export default connect(mapStateToProps, mapDispatchToProps)(GeneralTab);
