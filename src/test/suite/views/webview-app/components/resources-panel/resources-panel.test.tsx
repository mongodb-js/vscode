import assert from 'assert';
import * as React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import type { AppState } from '../../../../../../views/webview-app/store/store';
import {
  initialState,
  rootReducer,
} from '../../../../../../views/webview-app/store/store';
import ResourcesPanel from '../../../../../../views/webview-app/components/resources-panel/resources-panel';

describe('Resources Panel Component Test Suite', () => {
  describe('when rendered', () => {
    let fakeVscodeWindowPostMessage;
    let wrapper;
    let store;

    beforeEach(() => {
      fakeVscodeWindowPostMessage = sinon.fake.returns(null);

      sinon.replace(
        (global as any).vscodeFake,
        'postMessage',
        fakeVscodeWindowPostMessage
      );

      store = createStore(rootReducer, {
        ...initialState,
        showResourcesPanel: true,
      } as AppState);

      wrapper = mount(
        <Provider store={store}>
          <ResourcesPanel />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('when the x is clicked it closes the panel', () => {
      assert(store.getState().showResourcesPanel === true);
      wrapper.find('button').at(0).simulate('click');
      assert(store.getState().showResourcesPanel === false);
    });

    test('when a link is clicked it sends a telemetry event to the extension', () => {
      assert(!fakeVscodeWindowPostMessage.called);
      wrapper.find('a').at(0).simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert(
        fakeVscodeWindowPostMessage.firstCall.args[0].command ===
          'EXTENSION_LINK_CLICKED'
      );
    });
  });
});
