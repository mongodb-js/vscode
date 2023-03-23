import * as React from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import styles from './form.less';

type props = {
  changeHandler: (evt: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  error?: boolean;
  id?: string;
  label?: string;
  linkTo?: string;
  name: string;
  placeholder?: string;
  type?: string;
  value?: string | number;
};

/**
 * Represents an input field within a form.
 */
class FormInput extends React.PureComponent<props> {
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
    if (this.props.linkTo) {
      return (
        <a target="_blank" rel="noopener" href={this.props.linkTo}>
          <FontAwesomeIcon
            icon={faInfoCircle}
            className={styles['help-icon']}
          />
        </a>
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
      className,
      id,
      label,
      name,
      placeholder,
      type,
      value,
    } = this.props;

    return (
      <div
        className={classnames(className, {
          [styles['form-item']]: true,
          [styles['form-item-has-error']]: this.props.error,
        })}
      >
        {label && (
          <label>
            <span className={styles['form-item-label']}>{label}</span>
            {this.renderInfoSprinkle()}
          </label>
        )}
        <input
          id={id}
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
