import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  AuthSourceChangedAction,
  PasswordChangedAction,
  UsernameChangedAction
} from '../../../../store/actions';
import FormInput from '../../../form/form-input';
import FormGroup from '../../../form/form-group';

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

class MongoDBAuthentication extends React.Component<props> {
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
          // Opens "Authentication Database" documentation.
          linkTo="https://docs.mongodb.com/manual/core/security-users/#user-authentication-database"
        />
      </FormGroup>
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

export default connect(null, mapDispatchToProps)(MongoDBAuthentication);
