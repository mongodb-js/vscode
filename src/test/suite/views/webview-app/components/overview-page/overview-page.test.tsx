import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import OverviewPage from '../../../../../../views/webview-app/components/overview-page/overview-page';
import ConnectHelper from '../../../../../../views/webview-app/components/connect-helper/connect-helper';
import ConnectionStatus from '../../../../../../views/webview-app/components/connection-status/connection-status';
import OverviewHeader from '../../../../../../views/webview-app/components/overview-page/overview-header';

describe('Overview Page Component Test Suite', () => {
  describe('when rendered', () => {
    const wrapper = shallow(<OverviewPage />);

    test('it shows an overview header', () => {
      assert(wrapper.find(OverviewHeader).exists());
    });

    test('it shows the connection status', () => {
      assert(wrapper.find(ConnectionStatus).exists());
    });

    test('it shows the connect helper', () => {
      assert(wrapper.find(ConnectHelper).exists());
    });
  });
});
