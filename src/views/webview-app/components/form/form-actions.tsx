import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import { ActionTypes, ConnectAction } from '../../store/actions';
import FormGroup from './form-group';
import ConnectionModel from '../../connection-model/connection-model';

const styles = require('./form.less');

type DispatchProps = {
  onConnectClicked: () => void;
};

type props = {
  connectionMessage: string;
  currentConnection: ConnectionModel;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
} & DispatchProps;

class FormActions extends React.Component<props> {
  static displayName = 'FormActions';

  /**
   * Handles a connect click.
   *
   * @param {Object} evt - evt.
   */
  onConnectClicked = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();
    this.props.onConnectClicked();
  };

  /**
   * Checks for a syntax error.
   *
   * @returns {Boolean} True in case of a syntax error.
   */
  hasSyntaxError = (): boolean => {
    return !this.props.isValid && !!this.props.syntaxErrorMessage;
  };

  /**
   * Checks for an server error.
   *
   * @returns {Boolean} True in case of a server error.
   */
  hasError(): boolean {
    return !this.props.isValid && !!this.props.errorMessage;
  }

  /**
   * Renders "Connect" button.
   *
   * @returns {React.Component}
   */
  renderConnect = (): React.ReactNode => {
    const syntaxError = this.hasSyntaxError() ? 'disabled' : '';

    return (
      <button
        type="submit"
        name="connect"
        className={classnames(styles.btn, syntaxError)}
        onClick={this.onConnectClicked}
      >
        Connect
      </button>
    );
  };

  /**
   * Renders a component with messages.
   *
   * @returns {React.Component}
   */
  renderMessage(): React.ReactNode {
    let message: React.ReactNode = this.props.connectionMessage;
    let colorStyle = styles['form-message-container-success'];
    let hasMessage = false;

    if (this.props.isConnected) {
      hasMessage = true;
    } else if (this.props.isConnecting) {
      hasMessage = true;
      message = 'Connecting...';
    } else if (this.hasError()) {
      hasMessage = true;
      message = this.props.errorMessage;
      colorStyle = styles['form-message-container-error'];
    }

    if (hasMessage === true) {
      return (
        <div className={styles['form-message-container']}>
          <div className={classnames(colorStyle)}>
            <div className={styles['connection-message']}>{message}</div>
          </div>
        </div>
      );
    }
  }

  render(): React.ReactNode {
    return (
      <FormGroup id="favorite">
        {this.renderMessage()}
        <div className={classnames(styles.buttons)}>{this.renderConnect()}</div>
      </FormGroup>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onConnectClicked: (): ConnectAction => ({
    type: ActionTypes.CONNECT
  })
};

export default connect(null, mapDispatchToProps)(FormActions);
