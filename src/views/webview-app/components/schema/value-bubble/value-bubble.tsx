import React, { Component } from 'react';
import { has, includes, isString } from 'lodash';

import { Types } from '../../../models/field-type';

type props = {
  fieldName: string;
  value: any;
};

class ValueBubble extends Component<props> {
  onBubbleClicked = () => { };

  /**
   * Converts the passed in value into a string, supports the 4 numeric
   * BSON types as well.
   *
   * @param {Any} value     value to be converted to a string
   * @return {String}       converted value
   */
  _extractStringValue(value: any) {
    if (has(value, '_bsontype')) {
      if (includes([Types.DECIMAL_128, Types.LONG], value._bsontype)) {
        return value.toString();
      }
      if (includes([Types.DOUBLE, Types.INT_32], value._bsontype)) {
        return String(value.value);
      }
    }
    if (isString(value)) {
      return value;
    }
    return String(value);
  }

  render() {
    const value = this._extractStringValue(this.props.value);

    return (
      <li className="bubble">
        <code
          className="selectable"
          onClick={this.onBubbleClicked}
        >
          {value}
        </code>
      </li>
    );
  }
}

export default ValueBubble;
