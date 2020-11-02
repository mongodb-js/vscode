import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, PortChangedAction } from '../../../store/actions';
import FormInput from '../../form/form-input';
import { AppState } from '../../../store/store';

type StateProps = {
  port: number;
};

type DispatchProps = {
  onPortChanged: (newPort: number) => void;
};

class PortInput extends React.PureComponent<StateProps & DispatchProps> {
  /**
   * Changes port.
   *
   * @param {Object} evt - evt.
   */
  onPortChanged = (evt): void => {
    this.props.onPortChanged(evt.target.value.trim());
  };

  /**
   * Gets port.
   *
   * @returns {String} port.
   */
  getPort(): string {
    return `${this.props.port}`;
  }

  render(): React.ReactNode {
    return (
      <FormInput
        label="Port"
        name="port"
        placeholder="27017"
        changeHandler={this.onPortChanged}
        value={this.getPort()}
        type="number"
      />
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    port: state.currentConnection.port
  };
};

const mapDispatchToProps: DispatchProps = {
  onPortChanged: (newPort: number): PortChangedAction => ({
    type: ActionTypes.PORT_CHANGED,
    port: newPort
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(PortInput);
