import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, PortChangedAction } from '../../../store/actions';
import FormInput from '../form-input';

type dispatchProps = {
  onPortChanged: (newPort: number) => void;
};

type props = {
  port: number;
} & dispatchProps;

class PortInput extends React.PureComponent<props> {
  static displayName = 'PortInput';

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

const mapDispatchToProps: dispatchProps = {
  onPortChanged: (newPort: number): PortChangedAction => ({
    type: ActionTypes.PORT_CHANGED,
    port: newPort
  })
};

export default connect(null, mapDispatchToProps)(PortInput);
