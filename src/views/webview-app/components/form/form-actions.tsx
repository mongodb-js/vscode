import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import {
  ActionTypes,
  ConnectAction,
  ToggleShowConnectionFormAction,
} from '../../store/actions';
import FormGroup from './form-group';

import styles from './form.less';

type DispatchProps = {
  onConnectClicked: () => void;
  toggleShowConnectForm: () => void;
};

type props = {
  connectionMessage?: string;
  errorMessage?: string;
  isConnected?: boolean;
  isConnecting?: boolean;
  isValid?: boolean;
  syntaxErrorMessage?: string;
} & DispatchProps;

class FormActions extends React.Component<props> {
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

  onCancelClicked = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();
    this.props.toggleShowConnectForm();
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
          <div className={colorStyle}>
            <div className={styles['connection-message']}>{message}</div>
          </div>
        </div>
      );
    }
  }

  render(): React.ReactNode {
    const syntaxError = this.hasSyntaxError() ? 'disabled' : '';

    return (
      <FormGroup id="form-actions-group">
        {this.renderMessage()}
        <div className={styles['form-actions-buttons-container']}>
          <button
            name="cancel"
            id="cancelButton"
            className={classnames(styles.btn)}
            onClick={this.onCancelClicked}
          >
            {this.props.isConnected ? 'Close' : 'Cancel'}
          </button>
          <button
            type="submit"
            id="connectButton"
            name="connect"
            className={classnames(
              styles.btn,
              styles['btn-primary'],
              syntaxError
            )}
            onClick={this.onConnectClicked}
          >
            Connect
          </button>
        </div>
      </FormGroup>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onConnectClicked: (): ConnectAction => ({
    type: ActionTypes.CONNECT,
  }),
  toggleShowConnectForm: (): ToggleShowConnectionFormAction => ({
    type: ActionTypes.TOGGLE_SHOW_CONNECTION_FORM,
  }),
};

export default connect(null, mapDispatchToProps)(FormActions);
