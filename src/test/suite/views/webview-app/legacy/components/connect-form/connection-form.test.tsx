import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { ConnectionForm } from '../../../../../../../views/webview-app/legacy/components/connect-form/connection-form';
import FormActions from '../../../../../../../views/webview-app/legacy/components/form/form-actions';
import { CONNECTION_FORM_TABS } from '../../../../../../../views/webview-app/legacy/store/constants';
import GeneralTab from '../../../../../../../views/webview-app/legacy/components/connect-form/general-tab/general-tab';
import SSLTab from '../../../../../../../views/webview-app/legacy/components/connect-form/ssl-tab/ssl-tab';
import SSHTunnelTab from '../../../../../../../views/webview-app/legacy/components/connect-form/ssh-tab/ssh-tunnel-tab';
import AdvancedTab from '../../../../../../../views/webview-app/legacy/components/connect-form/advanced-tab/advanced-tab';

describe('Webview Connection Form Component Test Suite', () => {
  test('it shows a connection form', () => {
    const wrapper = shallow(
      <ConnectionForm
        connectionMessage=""
        connectionFormTab={CONNECTION_FORM_TABS.GENERAL}
        errorMessage=""
        isConnected
        isConnecting
        isValid
        syntaxErrorMessage=""
        onConnectionFormChanged={(): void => {}}
      />
    );
    assert(wrapper.find('form').exists());
    assert(wrapper.find(FormActions).exists());
  });

  test('it shows the general tab when the connectionFormTab prop is GENERAL', () => {
    const wrapper = shallow(
      <ConnectionForm
        connectionMessage=""
        connectionFormTab={CONNECTION_FORM_TABS.GENERAL}
        errorMessage=""
        isConnected
        isConnecting
        isValid
        syntaxErrorMessage=""
        onConnectionFormChanged={(): void => {}}
      />
    );
    assert(wrapper.find(GeneralTab).exists());
  });

  test('it shows the ssl tab when the connectionFormTab prop is SSL', () => {
    const wrapper = shallow(
      <ConnectionForm
        connectionMessage=""
        connectionFormTab={CONNECTION_FORM_TABS.SSL}
        errorMessage=""
        isConnected
        isConnecting
        isValid
        syntaxErrorMessage=""
        onConnectionFormChanged={(): void => {}}
      />
    );
    assert(wrapper.find(SSLTab).exists());
    assert(!wrapper.find(GeneralTab).exists());
  });

  test('it shows the ssh tab when the connectionFormTab prop is SSH', () => {
    const wrapper = shallow(
      <ConnectionForm
        connectionMessage=""
        connectionFormTab={CONNECTION_FORM_TABS.SSH}
        errorMessage=""
        isConnected
        isConnecting
        isValid
        syntaxErrorMessage=""
        onConnectionFormChanged={(): void => {}}
      />
    );
    assert(wrapper.find(SSHTunnelTab).exists());
  });

  test('it shows the advanced tab when the connectionFormTab prop is ADVANCED', () => {
    const wrapper = shallow(
      <ConnectionForm
        connectionMessage=""
        connectionFormTab={CONNECTION_FORM_TABS.ADVANCED}
        errorMessage=""
        isConnected
        isConnecting
        isValid
        syntaxErrorMessage=""
        onConnectionFormChanged={(): void => {}}
      />
    );
    assert(wrapper.find(AdvancedTab).exists());
  });
});
