import * as React from 'react';

import Actions from '../../../store/actions';
import { AUTH_STRATEGY_ID, AuthStrategies } from '../../../store/auth-strategies';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';

type props = {
  authStrategy: AUTH_STRATEGY_ID;
  isValid: boolean;
};

class Authentication extends React.Component<props> {
  static displayName = 'Authentication';

  /**
   * Changes an authentication strategy.
   *
   * @param {Object} evt - evt.
   */
  onAuthStrategyChanged(evt): void {
    Actions.onAuthStrategyChanged(evt.target.value);
  }

  /**
   * Renders an authentication strategy component.
   *
   * @returns {React.Component}
   */
  renderAuthStrategy(): React.ReactNode {
    // const currentAuthStrategy = AuthStrategies.find(
    //   role => role.id === this.state.authStrategy
    // );

    // if (currentAuthStrategy.component) {
    //   return <currentRole.component {...this.props} />;
    // }

    const {
      authStrategy
    } = this.props;

    return (
      <div>
        Todo: Show the {authStrategy} auth component.
      </div>
    );
  }

  render(): React.ReactNode {
    const {
      authStrategy
    } = this.props;

    return (
      <FormGroup id="authStrategy" separator>
        <FormItemSelect
          label="Authentication"
          name="authStrategy"
          options={AuthStrategies.map(authStrat => ({
            [`${authStrat.id}`]: authStrat.title
          }))}
          changeHandler={this.onAuthStrategyChanged.bind(this)}
          value={authStrategy}
        />
        {this.renderAuthStrategy()}
      </FormGroup>
    );
  }
}

export default Authentication;
