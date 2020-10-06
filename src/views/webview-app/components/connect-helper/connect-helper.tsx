import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import {
  ActionTypes,
  LinkClickedAction,
  OpenConnectionStringInputAction
} from '../../store/actions';
import Button from '@leafygreen-ui/button';
import { WEBVIEW_VIEWS } from '../../extension-app-message-constants';

const styles = require('./connect-helper.less');

type dispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
  onOpenConnectionStringInput: () => void;
  onOpenConnectionFrom: () => void;
};

type props = dispatchProps;

class ConnectHelper extends React.Component<props> {
  render(): React.ReactNode {
    const {
      onOpenConnectionFrom,
      onOpenConnectionStringInput
    } = this.props;

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
            <Button
              className={styles['connect-helper-connect-option-button']}
              variant="dark"
              onClick={() => onOpenConnectionStringInput()}
            >
              Connect
            </Button>
          </div>
          <div className={classnames(styles['connect-helper-connect-option'], styles['connect-connection-form-area'])}>
            <div>
              Advanced
            </div>
            <div>
              <strong>Connection Settings</strong>
            </div>

            <Button
              className={styles['connect-helper-connect-option-button']}
              variant="info"
              onClick={() => onOpenConnectionFrom()}
            >
              Open form
            </Button>
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
  }),
  onOpenConnectionStringInput: (): OpenConnectionStringInputAction => ({
    type: ActionTypes.OPEN_CONNECTION_STRING_INPUT
  }),
  onOpenConnectionFrom: (): SetCurrentViewAction => ({
    type: ActionTypes.SET_CURRENT_VIEW,
    currentView: WEBVIEW_VIEWS.CONNECT
  })
};

export default connect(() => ({}), mapDispatchToProps)(ConnectHelper);
