import * as React from 'react';
import classnames from 'classnames';

import Actions from '../../store/actions';
import FormGroup from './form-group';

import styles from '../../connect.less';

type props = {
  currentConnection: any; // TODO: Connection model type.
  errorMessage: string;
  hasUnsavedChanges: boolean;
  isConnected: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

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
    Actions.onConnectClicked();
  };

  /**
   * Handles a disconnect click.
   *
   * @param {Object} evt - evt.
   */
  onDisconnectClicked = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();
    Actions.onDisconnectClicked();
  };

  /**
   * Discards changes.
   *
   * @param {Object} evt - evt.
   */
  onChangesDiscarded = (evt): void => {
    evt.preventDefault();
    Actions.onChangesDiscarded();
  };

  /**
   * Shows an editable URI input.
   *
   * @param {Object} evt - evt.
   */
  onEditURIClicked = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();
    Actions.onEditURIClicked();
  };

  /**
   * Shows a read-only URI.
   *
   * @param {Object} evt - evt.
   */
  onHideURIClicked = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();
    Actions.onHideURIClicked();
  };

  /**
   * Updates favorite attributes if a favorite already exists.
   *
   * @param {Object} evt - evt.
   */
  onSaveFavoriteClicked = (evt): void => {
    evt.preventDefault();
    Actions.onSaveFavoriteClicked();
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
   * Renders a warning that a saved connection was changed and
   * changes can be saved or discarded. For recents changes
   * can not be saved, only discarded.
   *
   * @returns {React.Component}
   */
  renderUnsavedMessage(): React.ReactNode {
    return (
      <div className={classnames(styles['unsaved-message-actions'])}>
        You have unsaved changes.
        <a id="discardChanges" onClick={this.onChangesDiscarded}>
          [discard]
        </a>
        {this.props.currentConnection.isFavorite ? (
          <a id="saveChanges" onClick={this.onSaveFavoriteClicked}>
            [save changes]
          </a>
        ) : null}
      </div>
    );
  }

  /**
   * Renders "Disconnect" button.
   *
   * @returns {React.Component}
   */
  renderDisconnect = (): React.ReactNode => {
    return (
      <button
        type="submit"
        name="disconnect"
        className="btn btn-sm btn-primary"
        onClick={this.onDisconnectClicked.bind(this)}
      >
        Disconnect
      </button>
    );
  };

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
        className={`btn btn-sm btn-primary ${syntaxError}`}
        onClick={this.onConnectClicked.bind(this)}
      >
        Connect
      </button>
    );
  };

  /**
   * Renders connect or disconnect button depending on state.
   *
   * @returns {React.Component}
   */
  renderConnectButtons(): React.ReactNode {
    return (
      <div className={classnames(styles.buttons)}>
        {this.props.isConnected
          ? this.renderDisconnect()
          : this.renderConnect()}
      </div>
    );
  }

  /**
   * Renders a component with messages.
   *
   * @returns {React.Component}
   */
  renderMessage(): React.ReactNode {
    const connection = this.props.currentConnection;
    const server = `${connection.hostname}:${connection.port}`;
    let message: React.ReactNode = `Connected to ${server}`;
    let colorStyle = styles['connection-message-container-success'];
    let hasMessage = false;

    if (this.hasError()) {
      hasMessage = true;
      message = this.props.errorMessage;
      colorStyle = styles['connection-message-container-error'];
    } else if (this.props.isConnected) {
      hasMessage = true;
    } else if (this.props.hasUnsavedChanges) {
      hasMessage = true;
      message = this.renderUnsavedMessage();
      colorStyle = styles['connection-message-container-unsaved-message'];
    }

    if (hasMessage === true) {
      return (
        <div className={styles['connection-message-container']}>
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
        {this.renderConnectButtons()}
      </FormGroup>
    );
  }
}

export default FormActions;
