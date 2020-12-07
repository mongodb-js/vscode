import React, { Component } from 'react';
import ValueBubble from '../value-bubble/value-bubble';
import { sampleSize } from 'lodash';
import { InnerFieldType } from '../../../models/field-type';

type props = {
  fieldName: string;
  type: InnerFieldType;
  width: number;
};

class UniqueMiniChart extends Component<props> {
  state = {
    sample: sampleSize(this.props.type.values, 20)
  };

  onRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.setState({
      sample: sampleSize(this.props.type.values, 20)
    });
  }

  /**
   * Render a single field;
   *
   * @returns {React.Component} A react component for a single field
   */
  render() {
    if (!this.props.type.values) {
      return <div />;
    }
    const samp = this.state.sample || [];
    const fieldName = this.props.fieldName.toLowerCase();
    const typeName = this.props.type.bsonType.toLowerCase();
    const randomValueList = samp.map((value, i) => {
      return (
        <ValueBubble
          key={`${fieldName}-${typeName}-${i}`}
          value={value}
          fieldName={this.props.fieldName}
        />
      );
    });
    const style = {
      width: this.props.width
    };

    return (
      <div className="minichart unique" style={style}>
        <dl className="dl-horizontal">
          <dt>
            <i
              onClick={this.onRefresh.bind(this)}
              className="mms-icon-continuous"
            />
          </dt>
          <dd>
            <ul className="list-inline">
              {randomValueList}
            </ul>
          </dd>
        </dl>
      </div>
    );
  }
}

export default UniqueMiniChart;
