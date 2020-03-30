import * as React from 'react';

import Actions from '../../../store/actions';
import FormInput from '../form-input';
import FormGroup from '../form-group';

type props = {
  isValid: boolean;
  mongodbDatabaseName: string;
  mongodbPassword: string;
  mongodbUsername: string;
};

class MongoDBAuthentication extends React.Component<props> {
  static displayName = 'MongoDBAuthentication';

  /**
   * Handles username change.
   *
   * @param {Object} evt - evt.
   */
  onUsernameChanged = (evt): void => {
    Actions.onUsernameChanged(evt.target.value.trim());
  };

  /**
   * Handles password change.
   *
   * @param {Object} evt - evt.
   */
  onPasswordChanged = (evt): void => {
    Actions.onPasswordChanged(evt.target.value);
  };

  /**
   * Handles authSource change.
   *
   * @param {Object} evt - evt.
   */
  onAuthSourceChanged = (evt): void => {
    Actions.onAuthSourceChanged(evt.target.value);
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

export default MongoDBAuthentication;
