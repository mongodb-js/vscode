import * as React from 'react';

import Actions from '../../../store/actions';
import { SSLMethodOptions } from '../../../connection-model/constants/ssl-methods';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';

type props = {
  sslMethod: string;
};

class SSLMethod extends React.Component<props> {
  static displayName = 'SSLMethod';

  /**
   * Handles SSL method change.
   *
   * @param {Object} evt - evt.
   */
  onSSLMethodChanged = (evt): void => {
    Actions.onSSLMethodChanged(evt.target.value);
  };

  /**
   * Renders an SSL method.
   *
   * @returns {React.Component}
   */
  renderSSLMethod(): React.ReactNode {
    // const currentRole = find(
    //   this.roles,
    //   role => role.name === this.state.sslMethod
    // );

    // if (currentRole.component) {
    //   return <currentRole.component {...this.props} />;
    // }

    return (
      <div>
        TODO: Render SSL Methods.
      </div>
    );
  }

  render(): React.ReactNode {
    const { sslMethod } = this.props;

    return (
      <FormGroup id="sslMethod" separator>
        <FormItemSelect
          label="SSL"
          name="sslMethod"
          options={SSLMethodOptions.map(methodOption => ({
            [`${methodOption.id}`]: methodOption.title
          }))}
          changeHandler={this.onSSLMethodChanged.bind(this)}
          value={sslMethod}
        />
        {this.renderSSLMethod()}
      </FormGroup>
    );
  }
}

export default SSLMethod;
