import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import {
  ActionTypes,
  OpenConnectionStringInputAction,
  ToggleShowConnectionFormAction,
} from '../../store/actions';

import styles from './connect-helper.less';

type DispatchProps = {
  onOpenConnectionStringInput: () => void;
  onOpenConnectionForm: () => void;
};

type props = DispatchProps;

function getOSCommandShortcutName(): string {
  if (navigator.userAgent.includes('Win')) {
    return 'Ctrl';
  }

  return 'Cmd';
}

export class ConnectHelper extends React.Component<props> {
  render(): React.ReactNode {
    const { onOpenConnectionForm, onOpenConnectionStringInput } = this.props;

    return (
      <div className={styles['connect-helper']}>
        <div className={styles['connect-helper-connect-area']}>
          <div
            className={classnames(
              styles['connect-helper-connect-option'],
              styles['connect-connection-string-area']
            )}
          >
            <div>Connect with</div>
            <div>
              <strong>Connection String</strong>
            </div>
            <button
              className={classnames(
                styles['connect-helper-connect-option-button'],
                styles['connect-helper-connection-string-button']
              )}
              onClick={(): void => onOpenConnectionStringInput()}
            >
              Connect
            </button>
          </div>
          <div
            className={classnames(
              styles['connect-helper-connect-option'],
              styles['connect-connection-form-area']
            )}
          >
            <div>Advanced</div>
            <div>
              <strong>Connection Settings</strong>
            </div>

            <button
              className={classnames(
                styles['connect-helper-connect-option-button'],
                styles['connect-helper-connection-form-button']
              )}
              onClick={(): void => onOpenConnectionForm()}
            >
              Open form
            </button>
          </div>
        </div>
        <div className={styles['connect-helper-message']}>
          <strong>{getOSCommandShortcutName()} + Shift + P</strong> for all
          MongoDB Command Palette options
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onOpenConnectionStringInput: (): OpenConnectionStringInputAction => ({
    type: ActionTypes.OPEN_CONNECTION_STRING_INPUT,
  }),
  onOpenConnectionForm: (): ToggleShowConnectionFormAction => ({
    type: ActionTypes.TOGGLE_SHOW_CONNECTION_FORM,
  }),
};

export default connect(() => ({}), mapDispatchToProps)(ConnectHelper);
