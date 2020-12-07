import React, { Component } from 'react';
import { includes } from 'lodash';

import UniqueMiniChart from '../unique-minichart/unique-minichart';
import DocumentMinichart from '../document-minichart/document-minichart';
import ArrayMinichart from '../array-minichart/array-minichart';
import CoordinatesMinichart from '../coordinates-minichart/coordinates-minichart';
import D3Component from '../d3-component/d3-component';
import { ArrayFieldType, InnerFieldType, ObjectFieldType, Types } from '../../../models/field-type';
import vizFns from '../../../modules';

type props = {
  fieldName: string;
  type: InnerFieldType;
  nestedDocType: InnerFieldType | null;
};

type StateType = {
  containerWidth: number | null;
  // valid: boolean,
  // userTyping: boolean
};

class MiniChart extends Component<props> {
  state: StateType = {
    containerWidth: null
    // valid: true,
    // userTyping: false
  };

  componentDidMount() {
    // yes, this is not ideal, we are rendering the empty container first to
    // measure the size, then render the component with content a second time,
    // but it is not noticable to the user.
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    // const QueryStore = this.props.localAppRegistry.getStore('Query.Store');
    // const onQueryChanged = (store) => {
    //   this.setState({
    //     filter: store.filter,
    //     valid: store.valid,
    //     userTyping: store.userTyping
    //   });
    // };

    // // Also populate initial values
    // onQueryChanged(QueryStore.state);

    // this.unsubscribeQueryStore = QueryStore.listen(onQueryChanged);
    // this.unsubscribeMiniChartResize = this.props.actions.resizeMiniCharts.listen(this.resizeListener);
  }

  // shouldComponentUpdate(nextProps: props, nextState: StateType) {
  //   return nextState.valid && !nextState.userTyping;
  // }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    // this.unsubscribeQueryStore();
    // this.unsubscribeMiniChartResize();
  }

  _mc: HTMLDivElement | null = null;

  /**
   * Called when the window size changes or via the resizeMiniCharts action,
   * triggered by index.jsx. Only redraw if the size is > 0.
   */
  handleResize = () => {
    if (!this._mc) {
      return;
    }

    const rect = this._mc.getBoundingClientRect();
    if (rect.width > 0) {
      this.setState({
        containerWidth: rect.width
      });
    }
  };

  minichartFactory() {
    // Cast all numeric types to Number pseudo-type,
    // when drawing charts, group all the types of dates together.
    const typeName = includes([Types.DECIMAL_128, Types.DOUBLE, Types.INT_32, Types.LONG], this.props.type.name)
      ? Types.NUMBER : includes([Types.UTCDATETIME, Types.TIMESTAMP], this.props.type.name)
        ? Types.DATE : this.props.type.name;

    const fieldName = this.props.fieldName;
    const hasDuplicates = this.props.type.has_duplicates;
    const fn = (vizFns as any)[typeName.toLowerCase()];
    const width = this.state.containerWidth;

    if (!width) {
      // ADDED @Rhys
      return;
    }

    if (includes([Types.STRING, Types.NUMBER], typeName) && !hasDuplicates) {
      return (
        <UniqueMiniChart
          key={typeName}
          fieldName={fieldName}
          type={this.props.type}
          width={width}
        />
      );
    }
    if (typeName === Types.COORDINATES) {
      const height = width / 1.618; // = golden ratio
      return (
        <CoordinatesMinichart
          fieldName={fieldName}
          type={this.props.type}
          width={width}
          height={height}
        />
      );
    }
    if (typeName === Types.DOCUMENT) {
      return (
        <DocumentMinichart
          nestedDocType={this.props.nestedDocType as ObjectFieldType}
        />
      );
    }
    if (typeName === Types.ARRAY) {
      return (
        <ArrayMinichart
          type={this.props.type as ArrayFieldType}
          nestedDocType={this.props.nestedDocType as InnerFieldType}
        />
      );
    }
    if (typeName === 'Null') {
      return <div>Null</div>;
    }
    if (!fn) {
      return null;
    }
    return (
      <D3Component
        fieldName={this.props.fieldName}
        type={this.props.type}
        renderMode="svg"
        width={width}
        height={100}
        fn={fn}
      />
    );
  }

  render() {
    return (
      <div ref={(chart) => { this._mc = chart; }}>
        {this.state.containerWidth && this.minichartFactory()}
      </div>
    );
  }
}

export default MiniChart;
