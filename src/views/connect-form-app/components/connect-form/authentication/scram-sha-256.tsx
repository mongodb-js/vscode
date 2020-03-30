import * as React from 'react';
import classnames from 'classnames';

import Actions from '../../../store/actions';
import FormInput from '../form-input';

const styles = require('../../../connect.module.less');

type props = {
  isValid: boolean;
  mongodbDatabaseName: string;
  mongodbPassword: string;
  mongodbUsername: string;
};

class ScramSha256 extends React.Component<props> {
  static displayName = 'ScramSha256';

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
      <div id="scram-sha-256" className={classnames(styles['form-group'])}>
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
          linkHandler={this.onSourceHelp}
        />
      </div>
    );
  }
}

export default ScramSha256;
