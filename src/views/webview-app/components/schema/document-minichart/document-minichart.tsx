import React, { Component } from 'react';

import { ObjectFieldType } from '../../../models/field-type';

type props = {
  nestedDocType: ObjectFieldType;
};

class DocumentMinichart extends Component<props> {
  render() {
    let docFieldsMessage = '';
    if (this.props.nestedDocType) {
      const numFields = Object.keys(this.props.nestedDocType.fields).length;
      const nestedFields = numFields === 1 ? 'nested fields' : 'nested field';
      docFieldsMessage = `Document with ${numFields} ${nestedFields}.`;
    }

    return (
      <div>
        <dl>
          <dt>{docFieldsMessage}</dt>
          <dd/>
        </dl>
      </div>
    );
  }
}

export default DocumentMinichart;
