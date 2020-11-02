import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  ConnectionFormChangedAction
} from '../../../store/actions';
import FormGroup from '../../form/form-group';
import HostInput from './host-input';
import PortInput from './port-input';
import SRVInput from './srv-input';
import Authentication from './authentication/authentication';
import { AppState } from '../../../store/store';

type StateProps = {
  connectionMessage: string;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isSrvRecord: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

type DispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = StateProps & DispatchProps;

export class GeneralTab extends React.Component<props> {
  /**
   * Renders a port input.
   *
   * @returns {React.Component}
   */
  renderPort(): React.ReactNode {
    const { isSrvRecord } = this.props;

    if (!isSrvRecord) {
      return <PortInput />;
    }
  }

  render(): React.ReactNode {
    return (
      <div>
        <FormGroup id="connection-host-information" separator>
          <HostInput />
          {this.renderPort()}
          <SRVInput />
        </FormGroup>
        <Authentication />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionMessage: state.connectionMessage,
    errorMessage: state.errorMessage,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isSrvRecord: state.currentConnection.isSrvRecord,
    isValid: state.isValid,
    syntaxErrorMessage: state.syntaxErrorMessage
  };
};

const mapDispatchToProps: DispatchProps = {
  // Resets URL validation if form was changed.
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(GeneralTab);
