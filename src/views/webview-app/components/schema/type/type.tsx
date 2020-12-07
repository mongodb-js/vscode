import React, { Component } from 'react';
import { sortBy, find } from 'lodash';
import numeral from 'numeral';
import ReactTooltip from 'react-tooltip';
import { SCHEMA_CONSTANTS } from '../../../store/constants';
import { ArrayFieldType, InnerFieldType, Types } from '../../../models/field-type';

// const debug = require('debug')('mongodb-compass:schema:type');

/**
 * The full schema component class.
 */
const TYPE_CLASS = 'schema-field-wrapper';


type props = {
  bsonType: Types;
  types?: InnerFieldType[];
  activeType: any;
  selfType: InnerFieldType; // ?
  probability: number;
  name: string;
  renderType: (type: InnerFieldType) => void;
  showSubTypes: boolean;
};

class Type extends Component<props> {
  /**
   * The type bar corresponding to this Type was clicked. Execute the
   * callback passed in from the parent (either <Field> or <Type> component
   * in case of subtypes).
   *
   * @param  {Object} e    click event (need to stop propagation)
   */
  typeClicked = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.props.renderType(this.props.selfType);
  };

  /**
   * A subtype was clicked (in case of an Array type). Pass up to the Field
   * so the entire type bar can be re-rendered.
   *
   * @param  {Object} subtype   The subtype object
   */
  subTypeClicked = (subtype: InnerFieldType) => {
    this.props.renderType(subtype);
  };

  /**
   * returns a list of subtype components for Array types.
   *
   * @return {ReactFragment}   array of <Type> components for subtype bar
   */
  _getArraySubTypes() {
    // only worry about subtypes if the type is Array
    if (this.props.bsonType !== 'Array') {
      return null;
    }
    // only show one level of subtypes, further Arrays inside Arrays don't
    // render their subtypes.
    if (!this.props.showSubTypes) {
      return null;
    }
    // sort the subtypes same as types (by probability, null last)
    const subtypes = sortBy(this.props.types, (type: InnerFieldType) => {
      if (type.name === 'Null') {
        return -Infinity;
      }
      return type.probability;
    }).reverse();
    // is one of the subtypes active?
    const activeSubType = find(subtypes, this.props.activeType);
    // generate the react fragment of subtypes, pass in showSubTypes=false
    // to stop the recursion after one step.
    const typeList = subtypes.map((subtype: ArrayFieldType) => {
      return (
        <Type
          key={'subtype-' + subtype.name}
          activeType={activeSubType}
          renderType={() => this.subTypeClicked(subtype)}
          selfType={subtype}
          showSubTypes={false}

          bsonType={subtype.bsonType}
          name={subtype.name}
          probability={subtype.probability}
          types={(subtype).types}
        />
      );
    });
    return (
      <div className="array-subtypes">
        <div className="schema-field-type-list">
          {typeList}
        </div>
      </div>
    );
  }

  /**
   * Render a single type
   *
   * @returns {React.Component}   A react component for a single type,
   * possibly with subtypes included for Array type.
   */
  render() {
    const type = this.props.bsonType
      ? this.props.bsonType.toLowerCase()
      : Types.UNDEFINED;
    let cls = `${TYPE_CLASS} schema-field-type-${type}`;
    if (this.props.activeType === this.props.selfType) {
      cls += ' active';
    }
    const handleClick = type === 'null' ? undefined : this.typeClicked;
    const percentage = (this.props.probability * 100) + '%';
    const style = {
      width: percentage
    };
    const subtypes = this._getArraySubTypes();
    const label = <span className="schema-field-type-label">{this.props.bsonType}</span>;
    // show integer accuracy by default, but show one decimal point accuracy
    // when less than 1% or greater than 99% but no 0% or 100%
    const format = (this.props.probability > 0.99 && this.props.probability < 1.0)
      || (this.props.probability > 0 && this.props.probability < 0.01) ? '0.0%' : '0%';
    const tooltipText = `${this.props.bsonType} (${numeral(this.props.probability).format(format)})`;
    const tooltipOptions = {
      'data-for': SCHEMA_CONSTANTS.SCHEMA_PROBABILITY_PERCENT,
      'data-tip': tooltipText,
      'data-effect': 'solid',
      'data-border': true,
      'data-offset': this.props.showSubTypes ?
        '{"top": -25, "left": 0}' : '{"top": 10, "left": 0}'
    };

    return (
      <div
        {...tooltipOptions}
        className={cls}
        style={style}
        onClick={handleClick}
      >
        <ReactTooltip id={SCHEMA_CONSTANTS.SCHEMA_PROBABILITY_PERCENT} />
        {this.props.showSubTypes ? label : null}
        <div className="schema-field-type" />
        {subtypes}
        {this.props.showSubTypes ? null : label}
      </div>
    );
  }
}

export default Type;
