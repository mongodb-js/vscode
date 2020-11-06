import * as React from 'react';
import { connect } from 'react-redux';

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

export class GeneralTab extends React.Component<StateProps> {
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

export default connect(mapStateToProps, null)(GeneralTab);
