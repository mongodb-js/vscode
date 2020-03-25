import React, { Component, ReactNode } from 'react';

import Actions from '../../../store/actions';
import { AUTH_STRATEGY_ID, AuthStrategies } from '../../../store/store';
import FormGroup from '../form-group';
import FormItemSelect from '../form-item-select';

type props = {
  authStrategy: AUTH_STRATEGY_ID;
  currentConnection: object;
  isValid: boolean;
};

// type state = {
//   authStrategy: props.currentConnection.authStrategy
// };

class Authentication extends Component<props> {
  static displayName = 'Authentication';

  // componentWillReceiveProps(nextProps): void {
  //   const authStrategy = nextProps.currentConnection.authStrategy;

  //   if (authStrategy !== this.state.authStrategy) {
  //     this.setState({ authStrategy });
  //   }
  // }

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
  renderAuthStrategy(): ReactNode {
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

  render(): ReactNode {
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
