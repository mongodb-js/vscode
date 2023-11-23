import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import ReadPreferenceSelect from '../../../../../../../../views/webview-app/legacy/components/connect-form/advanced-tab/read-preference-select';
import AdvancedTab from '../../../../../../../../views/webview-app/legacy/components/connect-form/advanced-tab/advanced-tab';

describe('Advanced Tab Component Test Suite', () => {
  test('it shows replica set input and read preference selection', () => {
    const wrapper = shallow(<AdvancedTab />);
    assert(wrapper.find(ReadPreferenceSelect).exists());
  });
});
