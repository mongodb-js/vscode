import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import d3 from 'd3';
import bson from 'bson';

import { InnerFieldType } from '../../../models/field-type';
import { UpdateFilterMethod, UPDATE_FILTER_TYPE } from '../../../modules/update-filter-types';

/**
 * Convert back to BSON types from the raw JS.
 */
const TO_BSON_CONVERSIONS = {
  'Long': (value: number) => bson.Long.fromNumber(value),
  'Decimal128': (value: string) => bson.Decimal128.fromString(value),
  'Date': (value: string) => new Date(value),
  'UtcDatetime': (value: string) => new Date(value),
  'ObjectId': (value: string) => bson.ObjectId.createFromHexString(value)
};

/**
 * Default conversion.
 */
const DEFAULT = (value: any) => { return value; };

type Props = {
  fieldName: string;
  type: InnerFieldType;
  renderMode: string; // oneOf(['svg', 'div']),
  width: number;
  height: number;
  fn: (updateFilter: UpdateFilterMethod) => any;
  query: any;
};

type StateType = {
  chart: any;
};

class D3Component extends Component<Props> {
  state: StateType = {
    chart: null
  };

  componentWillMount() {
    this.mounted = true;
    this.setState({
      chart: this.props.fn(this.updateFilter)
    });
  }

  componentDidMount() {
    this._redraw();
  }

  componentDidUpdate() {
    this._redraw();
  }

  componentWillUnmount() {
    this.mounted = false;
    this._cleanup();
  }

  containerRef: any = null;
  mounted = false;
  wrapperRef: any = null;

  // TODO - better pairing with types in update-filter-types in modules for this.
  updateFilter: UpdateFilterMethod = (
    options: any,
    updateFilterType: UPDATE_FILTER_TYPE
  ) => {
    return;
  };

  _getContainer() {
    const sizeOptions = {
      width: this.props.width,
      height: this.props.height
    };
    if (this.props.renderMode === 'svg') {
      return (
        <svg
          className="minichart"
          ref={(ref): void => { this.containerRef = ref; }}
          width={this.props.width}
          height={this.props.height}
        >
          <defs>
            <pattern id="diagonal-stripes" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.5" height="4" transform="translate(0,0)" fill="white" />
            </pattern>
            <mask id="mask-stripe">
              <rect x="0" y="0" width="100%" height="100%" fill="url(#diagonal-stripes)" />
            </mask>
          </defs>
        </svg>
      );
    }
    return (<div
      className="minichart"
      ref={(ref): void => { this.containerRef = ref; }}
      style={sizeOptions}
    />);
  }

  _cleanup() {
    if (this.state.chart) {
      this.state.chart.cleanup();
    }
  }

  _redraw() {
    const el = ReactDOM.findDOMNode(this.containerRef);
    this.state.chart
      .width(this.props.width)
      .height(this.props.height);

    // @todo: Durran: add the original type here.
    //
    // @todo: Irina: figure out if we need the promoter, since all the values
    // are already converted to acceptable JS values. bsonType can be stored in
    // options as well
    this.state.chart.options({
      fieldName: this.props.fieldName,
      unique: this.props.type.unique || 0,
      query: this.props.query,
      promoter: (TO_BSON_CONVERSIONS as any)[this.props.type.bsonType] || DEFAULT
    });

    d3.select(el as any) // TODO: was erroring without any
      .datum(this.props.type.values)
      .call(this.state.chart);
  }

  render() {
    const container = this._getContainer();
    return (
      <div className="minichart-wrapper" ref={(ref): void => { this.wrapperRef = ref; }}>
        {container}
      </div>
    );
  }
}

export default D3Component;
