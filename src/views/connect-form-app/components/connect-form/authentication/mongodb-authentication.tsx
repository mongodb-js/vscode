import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  AuthSourceChangedAction,
  PasswordChangedAction,
  UsernameChangedAction
} from '../../../store/actions';
import FormInput from '../form-input';
import FormGroup from '../form-group';

type dispatchProps = {
  onAuthSourceChanged: (newAuthSource: string) => void;
  onPasswordChanged: (newPassword: string) => void;
  onUsernameChanged: (newUsername: string) => void;
};

type props = {
  isValid: boolean;
  mongodbDatabaseName?: string;
  mongodbPassword?: string;
  mongodbUsername?: string;
} & dispatchProps;

class MongoDBAuthentication extends React.Component<props> {
  static displayName = 'MongoDBAuthentication';

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

  /**
   * Opens "Authentication Database" documentation.
   */
  onSourceHelp = (): void => {
    window.open(
      'https://docs.mongodb.com/manual/core/security-users/#user-authentication-database'
    );
  };

  render(): React.ReactNode {
    const {
      isValid,
      mongodbDatabaseName,
      mongodbPassword,
      mongodbUsername
    } = this.props;

    return (
      <FormGroup id="mongodb-authenticatio">
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
          name="auth-source"
          changeHandler={this.onAuthSourceChanged}
          value={mongodbDatabaseName || ''}
          linkHandler={this.onSourceHelp}
        />
      </FormGroup>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
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

export default connect(null, mapDispatchToProps)(MongoDBAuthentication);
