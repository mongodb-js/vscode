import * as React from 'react';
import classnames from 'classnames';

const styles = require('../../connect.module.less');

type props = {
  label: string;
  name: string;
  options: object[];
  changeHandler: (evt: React.ChangeEvent<HTMLSelectElement>) => void;
  value: string;
};

class FormItemSelect extends React.Component<props> {
  static displayName = 'FormItemSelect';

  /**
   * Prepares options for the form item select.
   *
   * @param {Array} options - A list of otions for select.
   *
   * @returns {React.Component}
   */
  renderOptions(options): React.ReactNode {
    return options.map((option, i) => {
      const select = Object.keys(option)[0];

      return (
        <option key={i} value={select}>
          {option[select]}
        </option>
      );
    });
  }

  render(): React.ReactNode {
    return (
      <div className={classnames(styles['form-item'])}>
        <label className={classnames(styles['select-label'])}><span>{this.props.label}</span></label>
        <select
          name={this.props.name}
          onChange={this.props.changeHandler}
          className={classnames(styles['form-control'])}
          value={this.props.value}
        >
          {this.renderOptions(this.props.options)}
        </select>
      </div>
    );
  }
}

export default FormItemSelect;
