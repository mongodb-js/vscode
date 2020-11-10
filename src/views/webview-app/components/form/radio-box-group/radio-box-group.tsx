import classnames from 'classnames';
import * as React from 'react';

const styles = require('./radio-box-group.less');
const formStyles = require('../form.less');

type props = {
  label: string;
  name: string;
  options: {
    label: string;
    value: string;
  }[];
  onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
};

class RadioBoxGroup extends React.Component<props> {
  handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { onChange, value } = this.props;

    // Stopped propagation to prevent event from bubbling with new target, and thus value coming back as undefined
    e.stopPropagation();
    // e.preventDefault(); // TODO Rhys

    onChange(e);

    if (!value) {
      this.setState({ value: e.target.value });
    }
  };

  /**
   * Prepares options for the box item select.
   *
   * @param {Array} options - A list of options for boxes to select.
   *
   * @returns {React.Component}
   */
  renderOptions(): React.ReactNode {
    const {
      options,
      value
    } = this.props;

    return options.map((option, i) => {
      const checked = value === option.value;

      return (
        <label
          className={classnames(styles['radio-box-item'], {
            [styles['radio-box-item-selected']]: checked
          })}
          key={i}
          htmlFor={`radio-box-group-${option.value}`}
        >
          <input
            className={styles['radio-box-item-input']}
            checked={checked}
            aria-selected={checked}
            type="radio"
            id={`radio-box-group-${option.value}`}
            name={`radio-box-group-${option.value}`}
            onChange={this.handleChange}
            value={option.value}
          />
          <div
            className={styles['radio-box-item-label']}
          >{option.label}</div>
        </label>
      );
    });
  }

  render(): React.ReactNode {
    const { label, name } = this.props;

    return (
      <div className={formStyles['form-item']}>
        <label>
          <span>{label}</span>
        </label>
        <div
          className={styles['radio-box-group']}
          aria-label={name}
          role="group"
        >
          {this.renderOptions()}
        </div>
      </div>
    );
  }
}

export default RadioBoxGroup;
