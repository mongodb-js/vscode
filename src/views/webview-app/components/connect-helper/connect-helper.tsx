import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { ActionTypes, LinkClickedAction } from '../../store/actions';

const styles = require('./connect-helper.less');

type dispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = dispatchProps;

class ConnectHelper extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  render(): React.ReactNode {
    return (
      <div className={styles['connect-helper']}>
        <div className={styles['connect-helper-connect-area']}>
          <div className={classnames(styles['connect-helper-connect-option'], styles['connect-connection-string-area'])}>
            <div>
              Connect with
            </div>
            <div>
              <strong>Connection String</strong>
            </div>
            <button className={styles['connect-helper-connect-option-button']}>
              Connect
            </button>
          </div>
          <div className={classnames(styles['connect-helper-connect-option'], styles['connect-connection-form-area'])}>
            <div>
              Advanced
            </div>
            <div>
              <strong>Connection Settings</strong>
            </div>
            <button className={styles['connect-helper-connect-option-button']}>
              Open Form
            </button>
          </div>
        </div>
        <div className={styles['connect-helper-message']}>
          {/* TODO: Pull in user's hotkey for command prompt. */}
          <strong>Cmd + Shift + P</strong> for all MongoDB Command Palette options
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId
  })
};

export default connect(() => ({}), mapDispatchToProps)(ConnectHelper);
