import assert from 'assert';
import * as React from 'react';
import { mount } from 'enzyme';
import * as sinon from 'sinon';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import {
  initialState,
  rootReducer,
} from '../../../../../../views/webview-app/store/store';
import AtlasCTA from '../../../../../../views/webview-app/components/atlas-cta/atlas-cta';
import { VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID } from '../../../../../../views/webview-app/extension-app-message-constants';

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
        <Provider store={store}>
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
      assert.strictEqual(
        fakeVscodeWindowPostMessage.firstCall.args[0].command,
        'EXTENSION_LINK_CLICKED'
      );
    });

    test('when a trusted link is clicked it sends an event to the extension', () => {
      assert(!fakeVscodeWindowPostMessage.called);
      window[VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID] = 'mockAnonymousID';
      wrapper.find('a').at(1).simulate('click');
      assert(fakeVscodeWindowPostMessage.called);
      assert.strictEqual(
        fakeVscodeWindowPostMessage.firstCall.args[0].command,
        'OPEN_TRUSTED_LINK'
      );
      assert.strictEqual(
        fakeVscodeWindowPostMessage.firstCall.args[0].linkTo,
        'https://mongodb.com/products/vs-code/vs-code-atlas-signup?utm_campaign=vs-code-extension&utm_source=visual-studio&utm_medium=product&ajs_aid=mockAnonymousID'
      );
      // The assert below is a bit redundant but will prevent us from redirecting to a non-https URL by mistake
      assert(
        fakeVscodeWindowPostMessage.firstCall.args[0].linkTo.startsWith(
          'https://'
        ) === true
      );
    });
  });
});
