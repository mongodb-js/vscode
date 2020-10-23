import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import {
  ConnectionForm
} from '../../../../../../views/webview-app/components/connect-form/connection-form';
import FormActions from '../../../../../../views/webview-app/components/form/form-actions';
import { CONNECTION_FORM_TABS } from '../../../../../../views/webview-app/store/constants';

describe('Webview Connection Form Component Test Suite', () => {
  test('it shows a connection form', () => {
    const wrapper = shallow(<ConnectionForm
      connectionMessage=""
      connectionFormTab={CONNECTION_FORM_TABS.GENERAL}
      errorMessage=""
      isConnected
      isConnecting
      isValid
      syntaxErrorMessage=""
      onConnectionFormChanged={(): void => { }}
    />);
    assert(wrapper.find('form').exists());
    assert(wrapper.find(FormActions).exists());
  });
});
