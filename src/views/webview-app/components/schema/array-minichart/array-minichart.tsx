import React, { Component } from 'react';
import { min, max } from 'lodash';
import numeral from 'numeral';
import { ArrayFieldType, InnerFieldType, ObjectFieldType } from '../../../models/field-type';

type props = {
  type: ArrayFieldType;
  nestedDocType: InnerFieldType;
};

class ArrayMinichart extends Component<props> {
  render() {
    let arrayOfFieldsMessage = '';
    if (this.props.nestedDocType) {
      const numFields = Object.keys((this.props.nestedDocType as ObjectFieldType).fields).length;
      const nestedFields = numFields === 1 ? 'nested fields' : 'nested field';
      arrayOfFieldsMessage = `Array of documents with ${numFields} ${nestedFields}.`;
    }

    const minLength = min(this.props.type.lengths);
    const average = this.props.type.lengths
      .reduce((a, b) => a + b, 0) / this.props.type.lengths.length;
    const averageLength = numeral(average).format('0.0[0]');
    const maxLength = max(this.props.type.lengths);

    return (
      <div>
        <dl>
          <dt>{arrayOfFieldsMessage}</dt>
          <dd />
          <dt>Array lengths</dt>
          <dd>
            <ul className="list-inline">
              <li>min: {minLength}</li>
              <li>average: {averageLength}</li>
              <li>max: {maxLength}</li>
            </ul>
          </dd>
        </dl>
      </div>
    );
  }
}

export default ArrayMinichart;
