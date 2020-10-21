import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import ConnectionModel from '../../../../../../views/webview-app/connection-model/connection-model';
import {
  ConnectionForm
} from '../../../../../../views/webview-app/components/connect-form/connection-form';
import FormActions from '../../../../../../views/webview-app/components/form/form-actions';

describe('Webview Connection Form Component Test Suite', () => {
  test('it shows a connection form', () => {
    const wrapper = shallow(<ConnectionForm
      connectionMessage=""
      currentConnection={new ConnectionModel()}
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
