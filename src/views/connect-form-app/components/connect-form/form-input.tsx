import * as React from 'react';
import classnames from 'classnames';

const styles = require('../../connect.module.less');

type props = {
  label: string;
  name: string;
  changeHandler: (evt: React.ChangeEvent) => void;
  linkHandler?: () => void;
  placeholder?: string;
  value?: string | number;
  type?: string;
  error?: boolean;
};

/**
 * Represents an input field within a form.
 */
class FormInput extends React.PureComponent<props> {
  static displayName = 'FormInput';

  /**
   * Gets the error id for the tooltip.
   *
   * @returns {String} The error id.
   */
  getErrorId(): string {
    return `form-error-tooltip-${this.props.name}`;
  }

  /**
   * Renders the info sprinkle if a link handler was provided.
   *
   * @returns {React.Component} The info sprinkle.
   */
  renderInfoSprinkle(): React.ReactNode {
    if (this.props.linkHandler) {
      return (
        <i className={classnames(styles.help)} onClick={this.props.linkHandler} />
      );
    }
  }

  /**
   * Renders the input field.
   *
   * @returns {React.Component} The input field.
   */
  render(): React.ReactNode {
    const {
      changeHandler,
      label,
      name,
      placeholder,
      type,
      value
    } = this.props;

    return (
      <div className={classnames({
        [styles['form-item']]: true,
        [styles['form-item-has-error']]: this.props.error
      })}>
        <label>
          <span className={styles['form-item-label']}>
            {label}
          </span>
          {this.renderInfoSprinkle()}
        </label>
        <input
          name={name}
          placeholder={placeholder}
          onChange={changeHandler}
          value={value}
          className={styles['form-control']}
          type={type || 'text'}
        />
      </div>
    );
  }
}

export default FormInput;
