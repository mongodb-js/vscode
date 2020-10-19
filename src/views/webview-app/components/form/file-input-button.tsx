import * as React from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faFileUpload } from '@fortawesome/free-solid-svg-icons';

const styles = require('./form.less');

type props = {
  error: boolean;
  id: string;
  label: string;
  link?: string;
  multi?: boolean;
  onClick: () => void;
  values?: string[];
};

class FileInputButton extends React.Component<props> {
  static displayName = 'FormFileInput';

  /**
   * Handles a form item file button click.
   *
   * @param {Object} evt - evt.
   */
  onClick = (evt): void => {
    evt.preventDefault();
    evt.stopPropagation();

    this.props.onClick();
  };

  /**
   * Renders a button text.
   *
   * @returns {String}
   */
  getButtonText(): string {
    if (this.props.values && this.props.values.length > 0) {
      return this.getFileNames();
    }

    return this.props.multi ? 'Select files...' : 'Select a file...';
  }

  /**
   * Renders file names.
   *
   * @returns {String}
   */
  getFileNames(): string {
    const fileNames = this.props.values || [];

    return fileNames.join(', ');
  }

  /**
   * Renders the info sprinkle if a link handler was provided.
   *
   * @returns {React.Component} The info sprinkle.
   */
  renderInfoSprinkle(): React.ReactNode {
    if (this.props.link) {
      return (
        <a target="_blank" rel="noopener" href={this.props.link}>
          <FontAwesomeIcon
            icon={faInfoCircle}
            className={styles['help-icon']}
          />
        </a>
      );
    }
  }

  render(): React.ReactNode {
    const { id, label } = this.props;

    const buttonClassName = `${classnames(
      styles.btn,
      styles['btn-sm'],
      styles['form-item-file-button']
    )}`;

    return (
      <div
        className={classnames({
          [styles['form-item']]: true,
          [styles['form-item-has-error']]: this.props.error
        })}
      >
        <label>
          <span>{label}</span>
          {this.renderInfoSprinkle()}
        </label>
        <button
          id={id}
          className={buttonClassName}
          onClick={this.onClick}
        >
          <FontAwesomeIcon
            icon={faFileUpload}
            className={styles['file-icon']}
          />
          {this.getButtonText()}
        </button>
      </div>
    );
  }
}

export default FileInputButton;
