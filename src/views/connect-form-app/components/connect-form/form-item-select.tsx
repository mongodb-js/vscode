import * as React from 'react';

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
    const { changeHandler, label, name, options, value } = this.props;

    return (
      <div className={styles['form-item']}>
        <label>
          <span>{label}</span>
        </label>
        <select
          className={styles['form-control']}
          name={name}
          onChange={changeHandler}
          value={value}
        >
          {this.renderOptions(options)}
        </select>
      </div>
    );
  }
}

export default FormItemSelect;
