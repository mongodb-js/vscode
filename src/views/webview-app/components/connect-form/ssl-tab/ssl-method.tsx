import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  SSLMethodChangedAction
} from '../../../store/actions';
import { AppState } from '../../../store/store';
import SSL_METHODS, {
  SSLMethodOptions
} from '../../../connection-model/constants/ssl-methods';
import FormGroup from '../../form/form-group';
import FormItemSelect from '../../form/form-item-select';
import SSLServerValidation from './ssl-server-validation';
import SSLServerClientValidation from './ssl-server-client-validation';

type DispatchProps = {
  onSSLMethodChanged: (authStrategy: SSL_METHODS) => void;
};

type StateProps = {
  sslMethod: string;
};

class SSLMethod extends React.Component<StateProps & DispatchProps> {
  /**
   * Handles SSL method change.
   *
   * @param {Object} evt - evt.
   */
  onSSLMethodChanged = (evt): void => {
    this.props.onSSLMethodChanged(evt.target.value);
  };

  /**
   * Renders an SSL method.
   *
   * @returns {React.Component}
   */
  renderSSLMethod(): React.ReactNode {
    const { sslMethod } = this.props;

    if (sslMethod === SSL_METHODS.SERVER) {
      return <SSLServerValidation />;
    }
    if (sslMethod === SSL_METHODS.ALL) {
      return <SSLServerClientValidation />;
    }
  }

  render(): React.ReactNode {
    const { sslMethod } = this.props;

    return (
      <FormGroup id="sslMethod" separator>
        <FormItemSelect
          label="SSL"
          name="sslMethod"
          options={SSLMethodOptions.map((methodOption) => ({
            [`${methodOption.id}`]: methodOption.title
          }))}
          changeHandler={this.onSSLMethodChanged}
          value={sslMethod}
        />
        {this.renderSSLMethod()}
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    sslMethod: state.currentConnection.sslMethod
  };
};

const mapDispatchToProps: DispatchProps = {
  onSSLMethodChanged: (newSSLMethod): SSLMethodChangedAction => ({
    type: ActionTypes.SSL_METHOD_CHANGED,
    sslMethod: newSSLMethod
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(SSLMethod);
