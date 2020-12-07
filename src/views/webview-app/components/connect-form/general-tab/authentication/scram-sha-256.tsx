import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';

import {
  ActionTypes,
  AuthSourceChangedAction,
  PasswordChangedAction,
  UsernameChangedAction
} from '../../../../store/actions';
import FormInput from '../../../form/form-input';

const styles = require('../../../../connect.module.less');

type DispatchProps = {
  onAuthSourceChanged: (newAuthSource: string) => void;
  onPasswordChanged: (newPassword: string) => void;
  onUsernameChanged: (newUsername: string) => void;
};

type props = {
  isValid: boolean;
  mongodbDatabaseName?: string;
  mongodbPassword?: string;
  mongodbUsername?: string;
} & DispatchProps;

class ScramSha256 extends React.Component<props> {
  /**
   * Handles username change.
   *
   * @param {Object} evt - evt.
   */
  onUsernameChanged = (evt): void => {
    this.props.onUsernameChanged(evt.target.value.trim());
  };

  /**
   * Handles password change.
   *
   * @param {Object} evt - evt.
   */
  onPasswordChanged = (evt): void => {
    this.props.onPasswordChanged(evt.target.value);
  };

  /**
   * Handles authSource change.
   *
   * @param {Object} evt - evt.
   */
  onAuthSourceChanged = (evt): void => {
    this.props.onAuthSourceChanged(evt.target.value);
  };

  render(): React.ReactNode {
    const {
      isValid,
      mongodbDatabaseName,
      mongodbPassword,
      mongodbUsername
    } = this.props;

    return (
      <div>
        <FormInput
          label="Username"
          name="username"
          error={!isValid && mongodbUsername === undefined}
          changeHandler={this.onUsernameChanged}
          value={mongodbUsername || ''}
        />
        <FormInput
          label="Password"
          name="password"
          type="password"
          error={!isValid && mongodbPassword === undefined}
          changeHandler={this.onPasswordChanged}
          value={mongodbPassword || ''}
        />
        <FormInput
          label="Authentication Database"
          placeholder="admin"
          name="authSource"
          changeHandler={this.onAuthSourceChanged}
          value={mongodbDatabaseName || ''}
          // Opens "Authentication Database" documentation.
          linkTo="https://docs.mongodb.com/manual/core/security-users/#user-authentication-database"
        />
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onAuthSourceChanged: (newAuthSource: string): AuthSourceChangedAction => ({
    type: ActionTypes.AUTH_SOURCE_CHANGED,
    mongodbDatabaseName: newAuthSource
  }),
  onPasswordChanged: (newPassword: string): PasswordChangedAction => ({
    type: ActionTypes.PASSWORD_CHANGED,
    mongodbPassword: newPassword
  }),
  onUsernameChanged: (newPassword: string): UsernameChangedAction => ({
    type: ActionTypes.USERNAME_CHANGED,
    mongodbUsername: newPassword
  })
};

export default connect(null, mapDispatchToProps)(ScramSha256);
