import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import {
  App
} from '../../../../../views/webview-app/components/app';
import ConnectionForm from '../../../../../views/webview-app/components/connect-form/connection-form';
import OverviewPage from '../../../../../views/webview-app/components/overview-page/overview-page';
import { WEBVIEW_VIEWS } from '../../../../../views/webview-app/extension-app-message-constants';

describe('App Component Test Suite', () => {
  describe('when passed currentView=CONNECT', () => {
    test('it shows a connection form', () => {
      const wrapper = shallow(<App
        currentView={WEBVIEW_VIEWS.CONNECT}
        onConnectedEvent={() => { }}
        onFilePickerEvent={() => { }}
      />);
      assert(wrapper.find(ConnectionForm).exists());
      assert(!wrapper.find(OverviewPage).exists());
    });
  });

  describe('when passed currentView=CONNECT', () => {
    test('it shows a connection form', () => {
      const wrapper = shallow(<App
        currentView={WEBVIEW_VIEWS.OVERVIEW}
        onConnectedEvent={() => { }}
        onFilePickerEvent={() => { }}
      />);
      assert(wrapper.find(OverviewPage).exists());
      assert(!wrapper.find(ConnectionForm).exists());
    });
  });
});
