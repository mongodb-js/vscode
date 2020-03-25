import React, { PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

import styles from '../connect.less';

type props = {
  label: string;
  name: string;
  changeHandler: () => {};
  blurHandler?: () => {};
  linkHandler?: () => {};
  placeholder?: string;
  value?: string | number;
  type?: string;
  error?: boolean;
};

/**
 * Represents an input field within a form.
 */
class FormInput extends PureComponent<props> {
  static displayName = 'FormInput';

  /**
   * Gets the class name for the input wrapper.
   *
   * @returns {String} The class name.
   */
  getClassName(): string {
    const className = {
      [styles['form-item']]: true,
      [styles['form-item-has-error']]: this.props.error
    };

    return classnames(className);
  }

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
  renderInfoSprinkle(): ReactNode {
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
  render(): ReactNode {
    return (
      <div className={this.getClassName()}>
        <label>
          <span className={classnames(styles['form-item-label'])}>
            {this.props.label}
          </span>
          {this.renderInfoSprinkle()}
        </label>
        <input
          name={this.props.name}
          placeholder={this.props.placeholder}
          onChange={this.props.changeHandler}
          onBlur={this.props.blurHandler}
          value={this.props.value}
          className={classnames(styles['form-control'])}
          type={this.props.type || 'text'} />
      </div>
    );
  }
}

export default FormInput;
