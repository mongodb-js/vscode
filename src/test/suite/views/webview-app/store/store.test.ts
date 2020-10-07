import * as assert from 'assert';

import {
  rootReducer
} from '../../../../../views/webview-app/store/store';

suite('Webview Store Test Suite', () => {
  test('ensure the state updates on an action call', () => {
    const resultingState = rootReducer(undefined, {
      type: 'CONNECTION_EVENT_OCCURED',
      successfullyConnected: true
    } as any);
    assert(resultingState.isConnected);
  });
});
