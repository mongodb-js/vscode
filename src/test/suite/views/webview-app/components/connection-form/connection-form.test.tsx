import * as assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import ConnectionModel from '../../../../../../views/webview-app/connection-model/connection-model';
import {
  ConnectionForm
} from '../../../../../../views/webview-app/components/connect-form/connection-form';

suite('Webview Connection Form Component Test Suite', () => {
  test('ensure the state updates on an action call', () => {
    // const resultingState = rootReducer(undefined, {
    //   type: 'CONNECTION_EVENT_OCCURED',
    //   successfullyConnected: true
    // } as any);
    // assert(resultingState.isConnected);

    // ConnectionForm
    const wrapper = shallow(<ConnectionForm
      connectionMessage=""
      currentConnection={new ConnectionModel()}
      errorMessage=""
      isConnected
      isConnecting
      isValid
      syntaxErrorMessage=""
      onConnectionFormChanged={(): void => {}}
      onOpenConnectionStringInput={(): void => {}}
    />);
    assert(wrapper.find('Connect to MongoDB').exists());
  });
});
