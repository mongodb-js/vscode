import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { GeneralTab } from '../../../../../../../views/webview-app/components/connect-form/general-tab/general-tab';
import Authentication from '../../../../../../../views/webview-app/components/connect-form/general-tab/authentication/authentication';
import HostInput from '../../../../../../../views/webview-app/components/connect-form/general-tab/host-input';
import SRVInput from '../../../../../../../views/webview-app/components/connect-form/general-tab/srv-input';
import PortInput from '../../../../../../../views/webview-app/components/connect-form/general-tab/port-input';

describe('General Tab Component Test Suite', () => {
  test('it shows host input, srv input, and authentication', () => {
    const wrapper = shallow(<GeneralTab
      connectionMessage=""
      errorMessage=""
      isConnected
      isConnecting
      isSrvRecord
      isValid
      syntaxErrorMessage=""
      onConnectionFormChanged={(): void => { }}
    />);
    assert(wrapper.find(Authentication).exists());
    assert(wrapper.find(HostInput).exists());
    assert(wrapper.find(SRVInput).exists());
  });

  test('it does not show the port when srv record is true', () => {
    const wrapper = shallow(<GeneralTab
      connectionMessage=""
      errorMessage=""
      isConnected
      isConnecting
      isSrvRecord
      isValid
      syntaxErrorMessage=""
      onConnectionFormChanged={(): void => { }}
    />);
    assert(!wrapper.find(PortInput).exists());
  });

  test('it shows the port input when srv record is false', () => {
    const wrapper = shallow(<GeneralTab
      connectionMessage=""
      errorMessage=""
      isConnected
      isConnecting
      isSrvRecord={false}
      isValid
      syntaxErrorMessage=""
      onConnectionFormChanged={(): void => { }}
    />);
    assert(wrapper.find(PortInput).exists());
  });
});
