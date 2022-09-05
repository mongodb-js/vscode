import assert from 'assert';

import { rootReducer } from '../../../../../views/webview-app/store/store';

describe('Webview Store Test Suite', () => {
  test('ensure the state updates on an action call', () => {
    const resultingState = rootReducer(undefined, {
      type: 'CONNECTION_EVENT_OCCURED',
      connectionAttemptId: null,
      successfullyConnected: true,
    } as any);
    assert(resultingState.isConnected);
  });

  test("ensure we don't update connection status when the connectionAttemptId doesnt match the current one", () => {
    const resultingState = rootReducer(undefined, {
      type: 'CONNECTION_EVENT_OCCURED',
      connectionAttemptId: 'aaa',
      successfullyConnected: true,
    } as any);
    assert(!resultingState.isConnected);
  });
});
