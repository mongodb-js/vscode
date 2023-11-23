import assert from 'assert';
import * as React from 'react';
import { mount } from 'enzyme';

import RadioBoxGroup from '../../../../../../../views/webview-app/legacy/components/form/radio-box-group/radio-box-group';

describe('Radio Box Group Component Test Suite', () => {
  describe('when rendered', () => {
    let didCallChangeHandler = false;
    let changeHandlerCalledValue;
    const changeHandler = (evt: React.ChangeEvent<HTMLInputElement>): void => {
      didCallChangeHandler = true;
      changeHandlerCalledValue = evt.target.value;
    };

    const wrapper = mount(
      <RadioBoxGroup
        name=""
        label="Box form label"
        options={[
          {
            value: 'pineapple',
            label: 'Pineapple!!',
          },
          {
            value: 'watermelon',
            label: 'Watermelon!!',
          },
        ]}
        onChange={changeHandler}
        value={'watermelon'}
      />
    );

    test('it shows an input for each option', () => {
      assert(wrapper.find('input').length === 2);
    });

    test('it shows the group label', () => {
      assert(wrapper.find('label').at(0).text() === 'Box form label');
    });

    test('when an option is clicked it calls the onChange prop with that value', () => {
      assert(!didCallChangeHandler);
      wrapper.find('input').at(0).simulate('change');
      assert(didCallChangeHandler);
      assert(changeHandlerCalledValue === 'pineapple');
    });
  });
});
