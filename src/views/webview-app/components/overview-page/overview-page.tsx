import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, LinkClickedAction } from '../../store/actions';
import OverviewHeader from './overview-header';
import ConnectHelper from '../connect-helper/connect-helper';
import ConnectionStatus from '../connection-status/connection-status';
import HelpPanel from '../help-panel/help-panel';

const styles = require('./overview-page.less');

type dispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = dispatchProps;

class Overview extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  render(): React.ReactNode {
    return (
      <div className={styles.overview}>
        <OverviewHeader />
        <ConnectionStatus />
        <ConnectHelper />
        <div className={styles['overview-help-panel-container']}>
          <HelpPanel />
        </div>
        {/* TODO: Call it overview or home */}
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

export default connect(() => ({}), mapDispatchToProps)(Overview);
