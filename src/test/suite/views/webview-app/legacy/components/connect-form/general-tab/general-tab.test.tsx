import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { GeneralTab } from '../../../../../../../../views/webview-app/legacy/components/connect-form/general-tab/general-tab';
import Authentication from '../../../../../../../../views/webview-app/legacy/components/connect-form/general-tab/authentication/authentication';
import HostInput from '../../../../../../../../views/webview-app/legacy/components/connect-form/general-tab/host/host';

describe('General Tab Component Test Suite', () => {
  test('it shows host input, srv input, and authentication', () => {
    const wrapper = shallow(<GeneralTab />);
    assert(wrapper.find(Authentication).exists());
    assert(wrapper.find(HostInput).exists());
  });
});
