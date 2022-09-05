import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { Authentication } from '../../../../../../../../views/webview-app/components/connect-form/general-tab/authentication/authentication';
import RadioBoxGroup from '../../../../../../../../views/webview-app/components/form/radio-box-group/radio-box-group';
import MongodbAuthentication from '../../../../../../../../views/webview-app/components/connect-form/general-tab/authentication/mongodb-authentication';
import AUTH_STRATEGIES from '../../../../../../../../views/webview-app/connection-model/constants/auth-strategies';
import ScramSha256 from '../../../../../../../../views/webview-app/components/connect-form/general-tab/authentication/scram-sha-256';

describe('Authentication Component Test Suite', () => {
  test('it shows a select for the authentication method', () => {
    const wrapper = shallow(
      <Authentication
        authStrategy={AUTH_STRATEGIES.NONE}
        isValid
        kerberosCanonicalizeHostname
        onAuthStrategyChanged={(): void => {}}
      />
    );
    assert(wrapper.find(RadioBoxGroup).exists());
    assert(!wrapper.find(MongodbAuthentication).exists());
    assert(!wrapper.find(ScramSha256).exists());
  });

  test('it renders mongodb auth when the authStrategy is set', () => {
    const wrapper = shallow(
      <Authentication
        authStrategy={AUTH_STRATEGIES.MONGODB}
        isValid
        kerberosCanonicalizeHostname
        onAuthStrategyChanged={(): void => {}}
      />
    );
    assert(wrapper.find(MongodbAuthentication).exists());
  });

  test('it renders SCRAM-SHA-256 when the auth strategy is set', () => {
    const wrapper = shallow(
      <Authentication
        authStrategy={AUTH_STRATEGIES['SCRAM-SHA-256']}
        isValid
        kerberosCanonicalizeHostname
        onAuthStrategyChanged={(): void => {}}
      />
    );
    assert(wrapper.find(ScramSha256).exists());
  });
});
