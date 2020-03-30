import * as React from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

type props = {
  port: number;
  isPortChanged: boolean;
};

class PortInput extends React.PureComponent<props> {
  static displayName = 'PortInput';

  /**
   * Changes port.
   *
   * @param {Object} evt - evt.
   */
  onPortChanged(evt): void {
    Actions.onPortChanged(evt.target.value);
  }

  /**
   * Gets port.
   *
   * @returns {String} port.
   */
  getPort(): string {
    if (this.props.isPortChanged === false) {
      return '';
    }

    return `${this.props.port}`;
  }

  render(): React.ReactNode {
    return (
      <FormInput
        label="Port"
        name="port"
        placeholder="27017"
        changeHandler={this.onPortChanged.bind(this)}
        value={this.getPort()}
      />
    );
  }
}

export default PortInput;
