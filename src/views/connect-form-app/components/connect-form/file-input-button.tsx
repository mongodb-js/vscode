import * as React from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const styles = require('../../connect.module.less');

// const OPEN = 'openFile';
// const HIDDEN = 'showHiddenFiles';
// const MULTI = 'multiSelections';

type props = {
  error: boolean;
  id: string;
  label: string;
  link?: string;
  multi?: boolean;
  onClick: () => void;
  values: null | string[] | Buffer[];
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

    // const properties = [OPEN, HIDDEN];

    // if (this.props.multi) {
    //   properties.push(MULTI);
    // }

    // const options = { properties };

    // eslint-disable-next-line no-undef
    window.alert('Show file picker.');

    // dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), options, (values) => {
    //   this.props.changeHandler(values);
    //   this.setState({ values });
    // });
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
    // const baseFiles = this.state.values.map((file) => path.basename(file));

    return ''; // baseFiles.join(', ');
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
            className={classnames(styles['help-icon'])}
          />
        </a>
      );
    }
  }

  render(): React.ReactNode {
    const { id, label } = this.props;

    const buttonClassName = `${classnames(
      styles['form-item-file-button']
    )} btn btn-sm btn-default`;

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
        <button id={id} className={buttonClassName} onClick={this.onClick}>
          <i className="fa fa-upload" aria-hidden />
          {this.getButtonText()}
        </button>
      </div>
    );
  }
}

export default FileInputButton;
