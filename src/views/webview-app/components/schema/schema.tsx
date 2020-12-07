/* eslint react/no-multi-comp:0 */
import React, { Component } from 'react';
import classnames from 'classnames';

import Field from './field/field';
import { SCHEMA_CONSTANTS } from '../../store/constants';
import Tooltip from './tooltip/tooltip';
import { Schema as SchemaType } from '../../models/schema';

import styles from './schema.less';

export enum SAMPLING_STATES {
  initial = 'initial',
  counting = 'counting',
  sampling = 'sampling',
  analyzing = 'analyzing',
  error = 'error',
  complete = 'complete',
  outdated = 'outdated',
  timeout = 'timeout'
}

type props = {
  samplingState: SAMPLING_STATES;
  schema: SchemaType;
};

class Schema extends Component<props> {
  renderFieldList() {
    const fields = this.props.schema.fields;
    // Sort fields alphabetically, since Object.keys() does not keep order.
    return Object.keys(fields).sort().map((key) => {
      const fieldToRender = fields[key as any];
      return (
        <Field
          key={key}
          name={fieldToRender.name}
          path={fieldToRender.path}
          types={fieldToRender.types}
          fields={fieldToRender.fields || []}
        />
      );
    });
  }

  /**
   * Renders the zero state during the initial state; renders the schema if not.
   * @returns {React.Component} Zero state or fields.
   */
  renderContent() {
    return (
      <div className="column-container">
        <div className="column main">
          <div className="schema-field-list">
            {this.renderFieldList()}
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className={classnames(styles.root)}>
        {this.renderContent()}
        <Tooltip
          id={SCHEMA_CONSTANTS.SCHEMA_PROBABILITY_PERCENT}
          className="opaque-tooltip"
        />
      </div>
    );
  }
}

export default Schema;
