import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { Overview } from '../../../../../../views/webview-app/components/overview-page/overview-page';
import ConnectHelper from '../../../../../../views/webview-app/components/connect-helper/connect-helper';
import ConnectionStatus from '../../../../../../views/webview-app/components/connection-status/connection-status';
import OverviewHeader from '../../../../../../views/webview-app/components/overview-page/overview-header';
import ConnectionFormModal from '../../../../../../views/webview-app/components/connect-form-modal/connect-form-modal';

describe('Overview Page Component Test Suite', () => {
  describe('when rendered', () => {
    const wrapper = shallow(<Overview showConnectForm={false} />);

    test('it shows an overview header', () => {
      assert(wrapper.find(OverviewHeader).exists());
    });

    test('it shows the connection status', () => {
      assert(wrapper.find(ConnectionStatus).exists());
    });

    test('it shows the connect helper', () => {
      assert(wrapper.find(ConnectHelper).exists());
    });

    test('it does not show the connect form modal', () => {
      assert(!wrapper.find(ConnectionFormModal).exists());
    });
  });

  describe('when rendered with showConnectForm', () => {
    const wrapper = shallow(<Overview showConnectForm />);

    test('it shows the connect form', () => {
      assert(wrapper.find(ConnectionFormModal).exists());
    });
  });
});
