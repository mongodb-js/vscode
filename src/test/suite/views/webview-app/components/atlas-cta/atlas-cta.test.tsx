import assert from 'assert';
import * as React from 'react';
import { mount } from 'enzyme';
import * as sinon from 'sinon';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import {
  initialState,
  rootReducer
} from '../../../../../../views/webview-app/store/store';
import AtlasCTA from '../../../../../../views/webview-app/components/atlas-cta/atlas-cta';

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

      store = createStore(rootReducer, initialState);

      wrapper = mount(
        <Provider
          store={store}
        >
          <AtlasCTA />
        </Provider>
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('when a link is clicked it sends a telemetry event to the extension', () => {
      assert(!fakeVscodeWindowPostMessage.called);
      wrapper.find('a').at(0).simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert(fakeVscodeWindowPostMessage.firstCall.args[0].command === 'EXTENSION_LINK_CLICKED');
    });

    test('when a trusted link is clicked it sends an event to the extension', () => {
      assert(!fakeVscodeWindowPostMessage.called);
      wrapper.find('a').at(1).simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert(fakeVscodeWindowPostMessage.firstCall.args[0].command === 'OPEN_TRUSTED_LINK');
      assert(fakeVscodeWindowPostMessage.firstCall.args[0].linkTo === 'https://www.mongodb.com/cloud/atlas/register?utm_source=vscode&utm_medium=product&utm_campaign=VS%20code%20extension');
    });
  });
});
