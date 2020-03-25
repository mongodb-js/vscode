import * as React from 'react';
import classnames from 'classnames';

import styles from '../../connect.less';

const OPEN = 'openFile';
const HIDDEN = 'showHiddenFiles';
const MULTI = 'multiSelections';

type props = {
  label: string;
  changeHandler: (newFilesInputted: any) => void;
  id: string;
  values: any[];
  multi: boolean;
  link: string;
  error: boolean;
};

type state = {
  values: any[];
};

class FormFileInput extends React.Component<props, state> {
  static displayName = 'FormFileInput';

  constructor(initialProps) {
    super(initialProps);
    this.state = { values: initialProps.values };
  }

  UNSAFE_componentWillReceiveProps(nextProps): void {
    if (nextProps.values !== this.state.values) {
      this.setState({ values: nextProps.values });
    }
  }

  /**
   * Handles a form item file button click.
   *
   * @param {Object} evt - evt.
   */
  onClick(evt): void {
    evt.preventDefault();
    evt.stopPropagation();

    const properties = [OPEN, HIDDEN];

    if (this.props.multi) {
      properties.push(MULTI);
    }

    const options = { properties };

    // eslint-disable-next-line no-undef
    window.alert('Show file picker.');

    // dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), options, (values) => {
    //   this.props.changeHandler(values);
    //   this.setState({ values });
    // });
  }

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
   * Gets ReactTooltip id.
   *
   * @returns {String} ReactTooltip id.
   */
  getErrorId(): string {
    return `form-error-tooltip-${this.props.id}`;
  }
  /**
   * Renders a button text.
   *
   * @returns {String}
   */
  getButtonText(): string {
    if (this.state.values && this.state.values.length > 0) {
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
   * Opens a tooltip link.
   */
  openLink(): void {
    // shell.openExternal(this.props.link);
  }

  /**
   * Renders an info sprinkle.
   *
   * @returns {React.Component}
   */
  renderInfoSprinkle(): React.ReactNode {
    if (this.props.link) {
      return (
        <i
          className={classnames(styles.help)}
          onClick={this.openLink.bind(this)}
        />
      );
    }
  }

  render(): React.ReactNode {
    const buttonClassName = `${classnames(styles['form-item-file-button'])} btn btn-sm btn-default`;

    return (
      <div className={this.getClassName()}>
        <label>
          <span>{this.props.label}</span>
          {this.renderInfoSprinkle()}
        </label>
        <button
          id={this.props.id}
          className={buttonClassName}
          onClick={this.onClick.bind(this)}
        >
          <i className="fa fa-upload" aria-hidden />
          {this.getButtonText()}
        </button>
      </div>
    );
  }
}

export default FormFileInput;
